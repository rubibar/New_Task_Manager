import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { clientName: { not: null } },
    select: { clientName: true },
    distinct: ["clientName"],
    orderBy: { clientName: "asc" },
  });

  const names = projects
    .map((p) => p.clientName)
    .filter((n): n is string => n !== null);

  return NextResponse.json(names);
}
