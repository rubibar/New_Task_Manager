import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import type { Priority, TaskType } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropic = getAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to environment variables." },
      { status: 503 }
    );
  }

  const { message, conversationHistory } = await request.json();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Gather current state for context
  const [projects, tasks, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        projectType: true,
        tasks: { select: { id: true, title: true, status: true, priority: true, ownerId: true, startDate: true, deadline: true } },
        deliverables: { select: { id: true, name: true, status: true, dueDate: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { displayScore: "desc" },
    }),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);

  const studioContext = JSON.stringify({
    currentDate: new Date().toISOString().split("T")[0],
    teamMembers: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      client: p.clientName,
      type: p.projectType?.name,
      status: p.status,
      startDate: p.startDate?.toISOString().split("T")[0],
      targetFinishDate: p.targetFinishDate?.toISOString().split("T")[0],
      budget: p.budget,
      taskCount: p.tasks.length,
      tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
      deliverableCount: p.deliverables.length,
    })),
    recentTasks: tasks.slice(0, 30).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      owner: t.owner.name,
      ownerId: t.owner.id,
      project: t.project?.name,
      projectId: t.project?.id,
      startDate: t.startDate.toISOString().split("T")[0],
      deadline: t.deadline.toISOString().split("T")[0],
    })),
  });

  const systemPrompt = `You are the AI assistant for Replica Studio's task manager. You help manage projects, tasks, and team workflow for a 3-person animation studio (Dana, Rubi, Gilad).

CURRENT STUDIO STATE:
${studioContext}

You can take actions by including JSON action blocks in your response. When you want to perform an action, include it in your response like this:

\`\`\`action
{"type": "create_task", "title": "...", "projectId": "...", "ownerId": "...", "priority": "IMPORTANT_NOT_URGENT", "startDate": "YYYY-MM-DD", "deadline": "YYYY-MM-DD"}
\`\`\`

\`\`\`action
{"type": "update_task", "taskId": "...", "updates": {"status": "IN_PROGRESS", "ownerId": "...", "priority": "...", "startDate": "...", "deadline": "..."}}
\`\`\`

\`\`\`action
{"type": "create_milestone", "projectId": "...", "name": "...", "dueDate": "YYYY-MM-DD"}
\`\`\`

\`\`\`action
{"type": "suggest_timeline", "projectId": "...", "tasks": [{"taskId": "...", "suggestedStart": "YYYY-MM-DD", "suggestedDeadline": "YYYY-MM-DD"}]}
\`\`\`

RULES:
- Always explain what you're about to do before including action blocks
- For task assignment suggestions, explain your reasoning
- For timeline suggestions, consider task dependencies and team workload
- Be concise and actionable
- Use the actual IDs from the studio state when referencing entities
- If you suggest a timeline, list each task with its proposed dates
- Always ask for confirmation before destructive actions (deleting)
- You can include multiple action blocks in one response`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...(conversationHistory || []),
    { role: "user" as const, content: message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response");
    }

    const responseText = textBlock.text;

    // Extract and execute action blocks
    const actionRegex = /```action\n([\s\S]*?)```/g;
    const actions: { type: string; data: Record<string, unknown>; result: string }[] = [];
    let match;

    while ((match = actionRegex.exec(responseText)) !== null) {
      try {
        const actionData = JSON.parse(match[1].trim());
        const result = await executeAction(actionData);
        actions.push({ type: actionData.type, data: actionData, result });
      } catch (err) {
        actions.push({
          type: "error",
          data: {},
          result: `Failed to execute action: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
    }

    // Clean response text (remove action blocks for display)
    const cleanResponse = responseText.replace(/```action\n[\s\S]*?```/g, "").trim();

    return NextResponse.json({
      response: cleanResponse,
      actions,
    });
  } catch (error: unknown) {
    console.error("AI assistant error:", error);
    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number; message?: string };
      if (apiError.status === 400 && String(apiError.message || "").includes("credit balance")) {
        return NextResponse.json(
          { error: "Anthropic API credit balance is too low. Add credits at console.anthropic.com/settings/billing" },
          { status: 503 }
        );
      }
    }
    return NextResponse.json(
      { error: "AI assistant failed. Please try again." },
      { status: 500 }
    );
  }
}

async function executeAction(action: Record<string, unknown>): Promise<string> {
  switch (action.type) {
    case "create_task": {
      const task = await prisma.task.create({
        data: {
          title: action.title as string,
          projectId: (action.projectId as string) || undefined,
          ownerId: action.ownerId as string,
          priority: ((action.priority as string) || "IMPORTANT_NOT_URGENT") as Priority,
          type: ((action.taskType as string) || "CLIENT") as TaskType,
          startDate: new Date(action.startDate as string),
          deadline: new Date(action.deadline as string),
        },
      });
      return `Created task "${task.title}" (${task.id})`;
    }

    case "update_task": {
      const updates = action.updates as Record<string, unknown>;
      const updateData: Record<string, unknown> = {};
      if (updates.status) updateData.status = updates.status;
      if (updates.ownerId) updateData.ownerId = updates.ownerId;
      if (updates.priority) updateData.priority = updates.priority;
      if (updates.startDate) updateData.startDate = new Date(updates.startDate as string);
      if (updates.deadline) updateData.deadline = new Date(updates.deadline as string);

      await prisma.task.update({
        where: { id: action.taskId as string },
        data: updateData,
      });
      return `Updated task ${action.taskId}`;
    }

    case "create_milestone": {
      const milestone = await prisma.milestone.create({
        data: {
          projectId: action.projectId as string,
          name: action.name as string,
          dueDate: new Date(action.dueDate as string),
        },
      });
      return `Created milestone "${milestone.name}"`;
    }

    case "suggest_timeline": {
      const taskUpdates = action.tasks as { taskId: string; suggestedStart: string; suggestedDeadline: string }[];
      for (const tu of taskUpdates) {
        await prisma.task.update({
          where: { id: tu.taskId },
          data: {
            startDate: new Date(tu.suggestedStart),
            deadline: new Date(tu.suggestedDeadline),
          },
        });
      }
      return `Updated timeline for ${taskUpdates.length} tasks`;
    }

    default:
      return `Unknown action type: ${action.type}`;
  }
}
