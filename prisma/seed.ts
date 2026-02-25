import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create users
  const dana = await prisma.user.upsert({
    where: { email: "dana@replica.works" },
    update: {},
    create: {
      email: "dana@replica.works",
      name: "Dana",
    },
  });

  const rubi = await prisma.user.upsert({
    where: { email: "rubi@replica.works" },
    update: {},
    create: {
      email: "rubi@replica.works",
      name: "Rubi",
    },
  });

  const gilad = await prisma.user.upsert({
    where: { email: "gilad@replica.works" },
    update: {},
    create: {
      email: "gilad@replica.works",
      name: "Gilad",
    },
  });

  console.log("Users created:", dana.name, rubi.name, gilad.name);

  // Create projects
  const brandCampaign = await prisma.project.upsert({
    where: { id: "proj-brand-campaign" },
    update: {},
    create: {
      id: "proj-brand-campaign",
      name: "Brand Campaign",
      description: "Q1 brand awareness campaign for client launch",
      color: "#EF4444",
    },
  });

  const pipelineRD = await prisma.project.upsert({
    where: { id: "proj-pipeline-rd" },
    update: {},
    create: {
      id: "proj-pipeline-rd",
      name: "Pipeline R&D",
      description: "Internal rendering pipeline improvements and experiments",
      color: "#C8FF00",
    },
  });

  const studioOps = await prisma.project.upsert({
    where: { id: "proj-studio-ops" },
    update: {},
    create: {
      id: "proj-studio-ops",
      name: "Studio Ops",
      description: "Studio administration and operational tasks",
      color: "#8B5CF6",
    },
  });

  console.log(
    "Projects created:",
    brandCampaign.name,
    pipelineRD.name,
    studioOps.name
  );

  // Helpers for dates
  const now = new Date();
  const addDays = (d: Date, days: number) =>
    new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

  // Create tasks
  const tasks = [
    {
      title: "Finalize hero animation sequence",
      description:
        "Complete the main hero animation for the brand campaign landing page. Needs final color grading pass and timing adjustments.",
      type: "CLIENT" as const,
      priority: "URGENT_IMPORTANT" as const,
      status: "IN_PROGRESS" as const,
      ownerId: dana.id,
      reviewerId: rubi.id,
      projectId: brandCampaign.id,
      startDate: addDays(now, -3),
      deadline: addDays(now, 2),
      emergency: false,
    },
    {
      title: "Client feedback round 2 revisions",
      description:
        "Apply second round of client feedback to the product walkthrough animation.",
      type: "CLIENT" as const,
      priority: "URGENT_IMPORTANT" as const,
      status: "TODO" as const,
      ownerId: rubi.id,
      reviewerId: dana.id,
      projectId: brandCampaign.id,
      startDate: addDays(now, -1),
      deadline: addDays(now, 3),
      emergency: true,
      todoSince: addDays(now, -1),
    },
    {
      title: "Storyboard social media teasers",
      description:
        "Create 3 storyboard options for 15-second social teasers.",
      type: "CLIENT" as const,
      priority: "IMPORTANT_NOT_URGENT" as const,
      status: "TODO" as const,
      ownerId: gilad.id,
      reviewerId: dana.id,
      projectId: brandCampaign.id,
      startDate: addDays(now, 1),
      deadline: addDays(now, 7),
      todoSince: now,
    },
    {
      title: "Test real-time shader pipeline",
      description:
        "Benchmark the new real-time shader compilation approach. Compare render times with current pipeline.",
      type: "INTERNAL_RD" as const,
      priority: "IMPORTANT_NOT_URGENT" as const,
      status: "IN_PROGRESS" as const,
      ownerId: rubi.id,
      reviewerId: gilad.id,
      projectId: pipelineRD.id,
      startDate: addDays(now, -5),
      deadline: addDays(now, 5),
    },
    {
      title: "Prototype AI-assisted keyframing",
      description:
        "Build a proof-of-concept for ML-based keyframe interpolation using the new model.",
      type: "INTERNAL_RD" as const,
      priority: "URGENT_NOT_IMPORTANT" as const,
      status: "TODO" as const,
      ownerId: gilad.id,
      projectId: pipelineRD.id,
      startDate: addDays(now, 2),
      deadline: addDays(now, 10),
      todoSince: now,
    },
    {
      title: "Review and approve invoice batch",
      description:
        "Review October invoices for freelancers and approve for payment.",
      type: "ADMIN" as const,
      priority: "URGENT_NOT_IMPORTANT" as const,
      status: "IN_REVIEW" as const,
      ownerId: gilad.id,
      reviewerId: dana.id,
      projectId: studioOps.id,
      startDate: addDays(now, -2),
      deadline: addDays(now, 1),
    },
    {
      title: "Update software license renewals",
      description:
        "Check which software licenses are expiring this quarter and prepare renewal requests.",
      type: "ADMIN" as const,
      priority: "NEITHER" as const,
      status: "TODO" as const,
      ownerId: dana.id,
      projectId: studioOps.id,
      startDate: addDays(now, 3),
      deadline: addDays(now, 14),
      todoSince: addDays(now, -2),
    },
    {
      title: "Render farm capacity planning",
      description:
        "Analyze current render farm utilization and plan for Q2 scaling needs.",
      type: "INTERNAL_RD" as const,
      priority: "IMPORTANT_NOT_URGENT" as const,
      status: "IN_REVIEW" as const,
      ownerId: dana.id,
      reviewerId: rubi.id,
      projectId: pipelineRD.id,
      startDate: addDays(now, -4),
      deadline: addDays(now, 4),
    },
    {
      title: "Onboard new freelance animator",
      description:
        "Set up accounts, share asset library access, and run through studio workflow guide.",
      type: "ADMIN" as const,
      priority: "IMPORTANT_NOT_URGENT" as const,
      status: "TODO" as const,
      ownerId: rubi.id,
      projectId: studioOps.id,
      startDate: addDays(now, 0),
      deadline: addDays(now, 5),
      todoSince: now,
    },
    {
      title: "Export final deliverables pack",
      description:
        "Export all final files in client-specified formats. Package with documentation.",
      type: "CLIENT" as const,
      priority: "URGENT_IMPORTANT" as const,
      status: "TODO" as const,
      ownerId: dana.id,
      reviewerId: gilad.id,
      projectId: brandCampaign.id,
      startDate: addDays(now, 4),
      deadline: addDays(now, 6),
      todoSince: addDays(now, 0),
    },
  ];

  for (const taskData of tasks) {
    await prisma.task.create({ data: taskData });
  }

  console.log(`Created ${tasks.length} tasks`);
  console.log("Seed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
