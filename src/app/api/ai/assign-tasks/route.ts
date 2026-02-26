import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";

interface AssignmentSuggestion {
  taskId: string;
  suggestedAssignee: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

interface AssignmentResponse {
  assignments: AssignmentSuggestion[];
}

const ASSIGNMENT_SYSTEM_PROMPT = `You are a task assignment AI for Replica Studio, a 3-person animation studio.
Assign tasks to team members based on:
1. Skill match (match task type/category to member skills)
2. Current workload (prefer members with fewer active tasks)
3. Past patterns (if someone usually handles this type of task, weight them higher)
4. Project continuity (if already assigned to same project, slight preference)
Return ONLY valid JSON matching the schema. Each assignment needs a confidence level and brief reasoning.`;

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

  const body = await request.json();
  const { taskIds, projectId } = body as {
    taskIds?: string[];
    projectId?: string;
  };

  try {
    // 1. Fetch all team members with workload info
    const teamMembers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        skills: true,
        weeklyCapacityHours: true,
        ownedTasks: {
          where: {
            status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
          },
          select: {
            id: true,
            type: true,
            projectId: true,
          },
        },
      },
    });

    // 2. Fetch tasks needing assignment
    let tasksToAssign;
    if (taskIds && taskIds.length > 0) {
      tasksToAssign = await prisma.task.findMany({
        where: { id: { in: taskIds } },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectType: { select: { name: true } },
            },
          },
        },
      });
    } else {
      // Fetch all unassigned/TODO tasks, optionally filtered by project
      const where: Record<string, unknown> = { status: "TODO" };
      if (projectId) where.projectId = projectId;

      tasksToAssign = await prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectType: { select: { name: true } },
            },
          },
        },
        orderBy: { displayScore: "desc" },
      });
    }

    if (tasksToAssign.length === 0) {
      return NextResponse.json({
        assignments: [],
        message: "No tasks found to assign.",
      });
    }

    // 3. Fetch recent assignment history (last 20 assigned tasks)
    const recentAssignments = await prisma.task.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "DONE", "IN_REVIEW"] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        ownerId: true,
        owner: { select: { name: true } },
        projectId: true,
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    // 4. Build context for the prompt
    const teamContext = teamMembers.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role || "Not specified",
      skills: member.skills.length > 0 ? member.skills : ["General"],
      weeklyCapacityHours: member.weeklyCapacityHours,
      activeTaskCount: member.ownedTasks.length,
      activeTasksByType: {
        CLIENT: member.ownedTasks.filter((t) => t.type === "CLIENT").length,
        INTERNAL_RD: member.ownedTasks.filter((t) => t.type === "INTERNAL_RD").length,
        ADMIN: member.ownedTasks.filter((t) => t.type === "ADMIN").length,
      },
      activeProjectIds: Array.from(new Set(member.ownedTasks.map((t) => t.projectId).filter(Boolean))),
    }));

    const taskContext = tasksToAssign.map((task) => ({
      taskId: task.id,
      title: task.title,
      type: task.type,
      priority: task.priority,
      deadline: task.deadline.toISOString().split("T")[0],
      projectId: task.projectId,
      projectName: task.project?.name || null,
      projectType: task.project?.projectType?.name || null,
    }));

    const historyContext = recentAssignments.map((task) => ({
      taskType: task.type,
      assigneeName: task.owner.name,
      assigneeId: task.ownerId,
      projectName: task.project?.name || null,
    }));

    // 5. Build the user prompt
    const userPrompt = `Analyze the following and suggest task assignments.

TEAM MEMBERS:
${JSON.stringify(teamContext, null, 2)}

TASKS NEEDING ASSIGNMENT:
${JSON.stringify(taskContext, null, 2)}

RECENT ASSIGNMENT HISTORY (last 20 tasks):
${JSON.stringify(historyContext, null, 2)}

Return JSON in this exact format:
{
  "assignments": [
    {
      "taskId": "the-task-id",
      "suggestedAssignee": "the-user-id",
      "confidence": "high|medium|low",
      "reasoning": "Brief 1-sentence explanation"
    }
  ]
}

Provide one assignment suggestion per task. Use actual IDs from the data above.`;

    // 6. Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: ASSIGNMENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    // 7. Parse JSON response (strip potential code fences)
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed: AssignmentResponse = JSON.parse(raw);

    // Validate the response structure
    if (!parsed.assignments || !Array.isArray(parsed.assignments)) {
      throw new Error("Invalid AI response structure");
    }

    // Validate that suggested assignee IDs exist in our team
    const validUserIds = new Set(teamMembers.map((m) => m.id));
    const validTaskIds = new Set(tasksToAssign.map((t) => t.id));

    const validatedAssignments = parsed.assignments.filter(
      (a) => validUserIds.has(a.suggestedAssignee) && validTaskIds.has(a.taskId)
    );

    return NextResponse.json({
      assignments: validatedAssignments,
      totalTasks: tasksToAssign.length,
      totalSuggestions: validatedAssignments.length,
    });
  } catch (error: unknown) {
    console.error("AI assign-tasks error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number; message?: string };
      if (apiError.status === 400 && String(apiError.message || "").includes("credit balance")) {
        return NextResponse.json(
          { error: "Anthropic API credit balance is too low. Add credits at console.anthropic.com/settings/billing" },
          { status: 503 }
        );
      }
      if (apiError.status === 401) {
        return NextResponse.json(
          { error: "Anthropic API key is invalid." },
          { status: 503 }
        );
      }
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: "Anthropic API rate limit reached. Please try again in a moment." },
          { status: 429 }
        );
      }
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "AI returned invalid JSON. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "AI task assignment failed. Please try again." },
      { status: 500 }
    );
  }
}
