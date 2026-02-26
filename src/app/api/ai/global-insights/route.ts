import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/ai/client";
import type { GlobalInsightResponse } from "@/lib/ai/types";

function hashInput(data: unknown): string {
  return createHash("md5").update(JSON.stringify(data)).digest("hex");
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Anthropic API key not configured." },
      { status: 503 }
    );
  }

  // Fetch all active project data
  const projects = await prisma.project.findMany({
    where: { status: { notIn: ["ARCHIVED"] } },
    include: {
      projectType: true,
      tasks: {
        include: {
          owner: { select: { id: true, name: true } },
        },
      },
      deliverables: true,
    },
  });

  const users = await prisma.user.findMany({
    select: { id: true, name: true },
  });

  const summary = projects.map((p) => ({
    name: p.name,
    client: p.clientName,
    type: p.projectType?.name,
    status: p.status,
    startDate: p.startDate?.toISOString().split("T")[0],
    targetFinishDate: p.targetFinishDate?.toISOString().split("T")[0],
    budget: p.budget,
    taskCount: p.tasks.length,
    tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
    tasksOverdue: p.tasks.filter((t) => t.deadline < new Date() && t.status !== "DONE").length,
    deliverableCount: p.deliverables.length,
    deliverablesComplete: p.deliverables.filter((d) =>
      d.status === "DELIVERED" || d.status === "APPROVED"
    ).length,
  }));

  const teamWorkload = users.map((u) => {
    const assignedTasks = projects.flatMap((p) =>
      p.tasks.filter((t) => t.owner.id === u.id && t.status !== "DONE")
    );
    return {
      name: u.name,
      activeTasks: assignedTasks.length,
      overdueTasks: assignedTasks.filter((t) => t.deadline < new Date()).length,
    };
  });

  const inputData = {
    currentDate: new Date().toISOString().split("T")[0],
    projects: summary,
    teamWorkload,
  };

  const inputHash = hashInput(inputData);

  // Check DB cache
  const cached = await prisma.aIInsightCache.findUnique({
    where: {
      entityType_entityId: {
        entityType: "global",
        entityId: "",
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

  const prompt = `Analyze the overall studio portfolio and return a JSON object.

STUDIO DATA:
${JSON.stringify(inputData, null, 2)}

REQUIRED JSON SCHEMA:
{
  "workloadAssessment": "<2-3 sentence overview of studio workload>",
  "atRiskProjects": [
    { "projectName": "<name>", "riskLevel": "HIGH" | "MEDIUM" | "LOW", "reason": "<why>" }
  ],
  "deadlineClusters": [
    { "dateRange": "<e.g., Mar 5-7>", "items": ["<task/deliverable names>"], "warning": "<what to watch out for>" }
  ],
  "budgetHealth": "<1-2 sentence overview of budget across projects>",
  "weeklyPriorityActions": [
    { "action": "<specific action>", "project": "<project name>", "urgency": "HIGH" | "MEDIUM" | "LOW" }
  ]
}

Focus on actionable insights. Reference actual project and task names. Provide 3-5 priority actions for the week.`;

  try {
    const insights = await callClaude<GlobalInsightResponse>(prompt);

    // Upsert DB cache
    const generatedAt = new Date();
    await prisma.aIInsightCache.upsert({
      where: {
        entityType_entityId: {
          entityType: "global",
          entityId: "",
        },
      },
      update: {
        inputHash,
        data: insights as unknown as import("@prisma/client").Prisma.JsonObject,
        generatedAt,
      },
      create: {
        entityType: "global",
        entityId: "",
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
    console.error("Global AI insight error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights." },
      { status: 500 }
    );
  }
}
