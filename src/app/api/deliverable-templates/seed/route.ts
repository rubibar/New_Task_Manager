import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SEED_TEMPLATES = [
  {
    name: "FigJam",
    phase: "PRE_PRODUCTION" as const,
    sortOrder: 1,
    defaultTasks: [
      { title: "Mood Board", phase: "PRE_PRODUCTION", sortOrder: 1 },
      { title: "Reference Collection", phase: "PRE_PRODUCTION", sortOrder: 2 },
      { title: "Concept Mapping", phase: "PRE_PRODUCTION", sortOrder: 3 },
      { title: "Client Brief Review", phase: "PRE_PRODUCTION", sortOrder: 4 },
    ],
  },
  {
    name: "Storyboard",
    phase: "PRE_PRODUCTION" as const,
    sortOrder: 2,
    defaultTasks: [
      { title: "Script Breakdown", phase: "PRE_PRODUCTION", sortOrder: 1 },
      { title: "Thumbnail Sketches", phase: "PRE_PRODUCTION", sortOrder: 2 },
      { title: "Storyboard Frames", phase: "PRE_PRODUCTION", sortOrder: 3 },
      { title: "Director Review", phase: "PRE_PRODUCTION", sortOrder: 4 },
      { title: "Revisions", phase: "PRE_PRODUCTION", sortOrder: 5 },
    ],
  },
  {
    name: "Ideaboard",
    phase: "PRODUCTION" as const,
    sortOrder: 3,
    defaultTasks: [
      { title: "Visual Style Exploration", phase: "PRODUCTION", sortOrder: 1 },
      { title: "Asset Collection", phase: "PRODUCTION", sortOrder: 2 },
      { title: "Layout Drafts", phase: "PRODUCTION", sortOrder: 3 },
      { title: "Team Review", phase: "PRODUCTION", sortOrder: 4 },
    ],
  },
  {
    name: "Videoboard",
    phase: "PRODUCTION" as const,
    sortOrder: 4,
    defaultTasks: [
      { title: "Animatic Assembly", phase: "PRODUCTION", sortOrder: 1 },
      { title: "Timing Pass", phase: "PRODUCTION", sortOrder: 2 },
      { title: "Sound Design Draft", phase: "PRODUCTION", sortOrder: 3 },
      { title: "Motion Tests", phase: "PRODUCTION", sortOrder: 4 },
      { title: "Internal Review", phase: "PRODUCTION", sortOrder: 5 },
    ],
  },
  {
    name: "Full Video",
    phase: "POST_PRODUCTION" as const,
    sortOrder: 5,
    defaultTasks: [
      { title: "Final Animation", phase: "POST_PRODUCTION", sortOrder: 1 },
      { title: "Color Grading", phase: "POST_PRODUCTION", sortOrder: 2 },
      { title: "Sound Mix", phase: "POST_PRODUCTION", sortOrder: 3 },
      { title: "Client Review", phase: "POST_PRODUCTION", sortOrder: 4 },
      { title: "Export & Delivery", phase: "POST_PRODUCTION", sortOrder: 5 },
    ],
  },
];

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if templates already exist
  const existing = await prisma.deliverableTemplate.count();
  if (existing > 0) {
    return NextResponse.json(
      { message: `Already seeded (${existing} templates exist)` },
      { status: 200 }
    );
  }

  const created = [];
  for (const tmpl of SEED_TEMPLATES) {
    const t = await prisma.deliverableTemplate.create({ data: tmpl });
    created.push(t);
  }

  return NextResponse.json({ message: `Seeded ${created.length} templates`, templates: created }, { status: 201 });
}
