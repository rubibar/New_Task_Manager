import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { taskIds, action, value } = body;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds array is required" }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  try {
    switch (action) {
      case "changeStatus":
        if (!value) {
          return NextResponse.json({ error: "value (status) is required" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { status: value },
        });
        break;

      case "changePriority":
        if (!value) {
          return NextResponse.json({ error: "value (priority) is required" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { priority: value },
        });
        break;

      case "changeOwner":
        if (!value) {
          return NextResponse.json({ error: "value (ownerId) is required" }, { status: 400 });
        }
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { ownerId: value },
        });
        break;

      case "changeProject":
        await prisma.task.updateMany({
          where: { id: { in: taskIds } },
          data: { projectId: value || null },
        });
        break;

      case "delete":
        await prisma.task.deleteMany({
          where: { id: { in: taskIds } },
        });
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, affected: taskIds.length });
  } catch (error) {
    console.error("Batch action error:", error);
    return NextResponse.json({ error: "Batch action failed" }, { status: 500 });
  }
}
