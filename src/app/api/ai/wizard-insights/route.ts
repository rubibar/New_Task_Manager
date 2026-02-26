import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/ai/client";
import type { WizardInsightResponse } from "@/lib/ai/types";

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
      { error: "Anthropic API key not configured." },
      { status: 503 }
    );
  }

  const body = await request.json();
  const {
    name, clientName, description, projectType,
    startDate, targetFinishDate, budget, hourlyRate, shiftRate,
    deliverables, selectedTaskNames, teamMembers,
  } = body;

  // Build input data for hashing (before DB queries for benchmarks)
  const wizardInputData = {
    name, clientName, description, projectType,
    startDate, targetFinishDate, budget, hourlyRate, shiftRate,
    deliverables, selectedTaskNames, teamMembers,
  };
  const inputHash = hashInput(wizardInputData);

  // Check DB cache — wizard has no persistent project ID, so entityId is ""
  const cached = await prisma.aIInsightCache.findUnique({
    where: {
      entityType_entityId: {
        entityType: "wizard",
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

  // Fetch historical projects of same type for benchmarks
  let benchmarkData: { name: string; startDate: Date | null; targetFinishDate: Date | null; budget: number | null; _count: { tasks: number } }[] = [];
  if (projectType) {
    const typeRecord = await prisma.projectType.findFirst({
      where: { name: projectType },
    });
    if (typeRecord) {
      benchmarkData = await prisma.project.findMany({
        where: {
          projectTypeId: typeRecord.id,
          status: { in: ["COMPLETED", "ARCHIVED"] },
        },
        select: {
          name: true,
          startDate: true,
          targetFinishDate: true,
          budget: true,
          _count: { select: { tasks: true } },
        },
      });
    }
  }

  const prompt = `You are an expert project manager for a 3-person animation/creative studio (Replica Studio). Analyze this new project and return a JSON object.

NEW PROJECT DATA:
${JSON.stringify({
  name,
  clientName,
  description,
  projectType,
  startDate,
  targetFinishDate,
  budget: budget || null,
  hourlyRate: hourlyRate || null,
  shiftRate: shiftRate || null,
  deliverables: deliverables || [],
  selectedTasks: selectedTaskNames || [],
  teamMembers: teamMembers || [],
  currentDate: new Date().toISOString().split("T")[0],
  historicalBenchmarks: benchmarkData.map((p) => ({
    name: p.name,
    duration: p.startDate && p.targetFinishDate
      ? Math.ceil((p.targetFinishDate.getTime() - p.startDate.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    taskCount: p._count.tasks,
    budget: p.budget,
  })),
}, null, 2)}

REQUIRED JSON SCHEMA:
{
  "projectSummary": "<2-3 sentence synthesis of the project>",
  "riskFlags": [
    { "flag": "<description of risk>", "severity": "HIGH" | "MEDIUM" | "LOW" }
  ],
  "suggestedMilestones": [
    { "name": "<milestone name>", "suggestedDate": "<YYYY-MM-DD>", "reasoning": "<why>" }
  ],
  "benchmarks": {
    "available": <boolean>,
    "comparisons": [
      { "projectName": "<name>", "duration": <days>, "taskCount": <int>, "budget": <number or null> }
    ]
  },
  "suggestedTasks": [
    { "name": "<task name>", "category": "PRE_PRODUCTION|PRODUCTION|POST_PRODUCTION|ADMIN", "estimatedHours": <number>, "reasoning": "<why this task is needed>", "suggestedStartDate": "<YYYY-MM-DD>", "suggestedDeadline": "<YYYY-MM-DD>" }
  ],
  "hoursEstimate": {
    "totalHours": <number>,
    "breakdown": [{ "category": "<category>", "hours": <number> }],
    "assumptions": "<brief explanation of how hours were estimated>"
  },
  "teamAllocation": [
    { "memberId": "<id>", "memberName": "<name>", "suggestedTasks": ["<task names>"], "reasoning": "<why this person>" }
  ]
}

CRITICAL RULES FOR SUGGESTED TASKS:
- Look at the project type (${projectType || "unknown"}), client name, description, and deliverables to suggest tasks SPECIFIC to this project — not generic boilerplate.
- For example: if the project is "Motion Graphics" for a tech client, suggest tasks like "Logo animation", "Lower thirds design", "Kinetic typography", not generic tasks.
- If the project is "Brand Film", suggest "Interview filming", "B-roll shoot", "Voiceover recording", "Music licensing", etc.
- If it's "Social Media Content", suggest "Platform-specific aspect ratios", "Caption/subtitle overlay", "Thumbnail design", etc.
- DO NOT suggest tasks the user already selected (check the "selectedTasks" list). Only suggest tasks that are missing but would make sense.
- Each suggested task MUST have suggestedStartDate and suggestedDeadline within the project timeline (${startDate} to ${targetFinishDate}).
- Distribute suggested task dates logically: PRE_PRODUCTION tasks early, PRODUCTION in the middle, POST_PRODUCTION near the end, ADMIN spread around key milestones.
- Suggest 3-8 additional tasks.

MILESTONE RULES:
- Provide 3-6 milestones logically distributed across the timeline.
- Milestones should reflect real creative production checkpoints (e.g. "Concept Lock", "First Draft Delivery", "Client Review", "Final Delivery").

OTHER RULES:
- If no historical benchmarks exist, set benchmarks.available to false with empty comparisons.
- If no team members provided, return empty teamAllocation array.
- For hours estimate, use realistic defaults for a small creative studio (3 people, animation/motion/design focus).`;

  try {
    const insights = await callClaude<WizardInsightResponse>(prompt);

    // Upsert DB cache
    const generatedAt = new Date();
    await prisma.aIInsightCache.upsert({
      where: {
        entityType_entityId: {
          entityType: "wizard",
          entityId: "",
        },
      },
      update: {
        inputHash,
        data: insights as unknown as import("@prisma/client").Prisma.JsonObject,
        generatedAt,
      },
      create: {
        entityType: "wizard",
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
    console.error("Wizard AI insight error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights. Please try again." },
      { status: 500 }
    );
  }
}
