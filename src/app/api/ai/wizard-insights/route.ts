import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/ai/client";
import type { WizardInsightResponse } from "@/lib/ai/types";

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

  const prompt = `Analyze this new project being set up and return a JSON object matching the schema below.

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
    { "name": "<task name>", "category": "PRE_PRODUCTION|PRODUCTION|POST_PRODUCTION|ADMIN", "estimatedHours": <number>, "reasoning": "<why this task is needed>" }
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

Provide 3-6 milestones logically distributed across the timeline.
Suggest 3-8 additional tasks the user may have missed based on project type.
If no historical benchmarks exist, set benchmarks.available to false with empty comparisons.
If no team members provided, return empty teamAllocation array.
For hours estimate, use sensible defaults per task category for a creative studio.`;

  try {
    const insights = await callClaude<WizardInsightResponse>(prompt);
    return NextResponse.json(insights);
  } catch (error) {
    console.error("Wizard AI insight error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI insights. Please try again." },
      { status: 500 }
    );
  }
}
