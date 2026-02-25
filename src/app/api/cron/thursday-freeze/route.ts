import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyThursdayFreeze } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Freeze all active tasks
    await prisma.task.updateMany({
      where: { status: { not: "DONE" } },
      data: { isFrozen: true },
    });

    // Notify all users
    await notifyThursdayFreeze();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Thursday freeze failed:", error);
    return NextResponse.json({ error: "Freeze failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
