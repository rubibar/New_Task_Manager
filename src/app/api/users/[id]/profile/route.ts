import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { role, skills, weeklyCapacityHours } = body as {
    role?: string;
    skills?: string[];
    weeklyCapacityHours?: number;
  };

  // Validate inputs
  const updateData: Record<string, unknown> = {};

  if (role !== undefined) {
    if (typeof role !== "string") {
      return NextResponse.json(
        { error: "role must be a string" },
        { status: 400 }
      );
    }
    updateData.role = role || null;
  }

  if (skills !== undefined) {
    if (!Array.isArray(skills) || !skills.every((s) => typeof s === "string")) {
      return NextResponse.json(
        { error: "skills must be an array of strings" },
        { status: 400 }
      );
    }
    updateData.skills = skills;
  }

  if (weeklyCapacityHours !== undefined) {
    if (typeof weeklyCapacityHours !== "number" || weeklyCapacityHours < 0 || weeklyCapacityHours > 168) {
      return NextResponse.json(
        { error: "weeklyCapacityHours must be a number between 0 and 168" },
        { status: 400 }
      );
    }
    updateData.weeklyCapacityHours = weeklyCapacityHours;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update. Provide role, skills, or weeklyCapacityHours." },
      { status: 400 }
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      skills: true,
      weeklyCapacityHours: true,
      atCapacity: true,
    },
  });

  return NextResponse.json(updatedUser);
}
