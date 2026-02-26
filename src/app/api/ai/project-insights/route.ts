import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/ai/client";
import type { ProjectInsightResponse } from "@/lib/ai/types";

function hashInput(data: unknown): string {
  return createHash("md5").update(JSON.stringify(data)).digest("hex");
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables." },
      { status: 503 }
    );
  }

  const { projectId, refresh } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // Fetch project data
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectType: true,
      tasks: {
        include: {
          owner: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } },
        },
      },
      deliverables: {
        include: {
          assignee: { select: { id: true, name: true } },
        },
      },
      milestones: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const taskSummary = project.tasks.map((t) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    owner: t.owner.name,
    startDate: t.startDate.toISOString().split("T")[0],
    deadline: t.deadline.toISOString().split("T")[0],
    isOverdue: t.deadline < new Date() && t.status !== "DONE",
  }));

  const deliverableSummary = project.deliverables.map((d) => ({
    name: d.name,
    status: d.status,
    dueDate: d.dueDate.toISOString().split("T")[0],
    assignee: d.assignee?.name || "Unassigned",
    isOverdue: d.dueDate < new Date() && d.status !== "DELIVERED" && d.status !== "APPROVED",
  }));

  const inputData = {
    name: project.name,
    clientName: project.clientName,
    type: project.projectType?.name,
    status: project.status,
    startDate: project.startDate?.toISOString().split("T")[0],
    targetFinishDate: project.targetFinishDate?.toISOString().split("T")[0],
    budget: project.budget,
    hourlyRate: project.hourlyRate,
    currentDate: now.split("T")[0],
    tasks: taskSummary,
    deliverables: deliverableSummary,
    milestones: project.milestones.map((m) => ({
      name: m.name,
      dueDate: m.dueDate.toISOString().split("T")[0],
      completed: m.completed,
    })),
  };

  const inputHash = hashInput(inputData);

  // Check DB cache (skip if explicit refresh)
  if (!refresh) {
    const cached = await prisma.aIInsightCache.findUnique({
      where: {
        entityType_entityId: {
          entityType: "project",
          entityId: projectId,
        },
      },
    });

    if (cached && cached.inputHash === inputHash) {
      return NextResponse.json({
        ...(cached.data as object),
        cached: true,
        generatedAt: cached.generatedAt.toISOString(),
      });
    }
  }

  const prompt = `Analyze this project and return a JSON object matching the schema below.

PROJECT DATA:
${JSON.stringify(inputData, null, 2)}

REQUIRED JSON SCHEMA:
{
  "progressAnalysis": {
    "overallPercent": <number 0-100>,
    "taskBreakdown": { "done": <int>, "inProgress": <int>, "todo": <int>, "total": <int> },
    "deliverableBreakdown": { "completed": <int>, "total": <int> },
    "assessment": "<1-2 sentence plain language progress assessment>"
  },
  "budgetBurnRate": {
    "estimatedTotalHours": <number>,
    "estimatedCost": <number>,
    "budgetRemaining": <number or null if no budget>,
    "projectedOvershoot": <number or null>,
    "assessment": "<1 sentence budget assessment>"
  },
  "bottlenecks": {
    "overdueTasks": ["<task names that are overdue>"],
    "unassignedTasks": ["<task names with no meaningful owner>"],
    "atRiskDeliverables": ["<deliverable names approaching due date with incomplete work>"],
    "overloadedMembers": ["<team member names with disproportionate workload>"],
    "assessment": "<1-2 sentence bottleneck summary>"
  },
  "timelineRisk": {
    "level": "LOW" | "MEDIUM" | "HIGH",
    "explanation": "<1-2 sentence explanation>"
  },
  "recommendations": [
    { "text": "<specific actionable recommendation referencing actual task/deliverable names>", "priority": "HIGH" | "MEDIUM" | "LOW" }
  ]
}

Return 3-5 recommendations. Reference actual task names and dates. If budget data is missing, set budgetBurnRate to null.`;

  try {
    const insights = await callClaude<ProjectInsightResponse>(prompt);

    // Upsert DB cache
    const generatedAt = new Date();
    await prisma.aIInsightCache.upsert({
      where: {
        entityType_entityId: {
          entityType: "project",
          entityId: projectId,
        },
      },
      update: {
        inputHash,
        data: insights as unknown as import("@prisma/client").Prisma.JsonObject,
        generatedAt,
      },
      create: {
        entityType: "project",
        entityId: projectId,
        inputHash,
        data: insights as unknown as import("@prisma/client").Prisma.JsonObject,
        generatedAt,
      },
    });

    return NextResponse.json({
      ...insights,
      cached: false,
      generatedAt: generatedAt.toISOString(),
    });
  } catch (error) {
    console.error("AI insight error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights. Please try again." },
      { status: 500 }
    );
  }
}
