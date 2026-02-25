import { NextRequest, NextResponse } from "next/server";
import { syncCalendarEvents } from "@/lib/calendar";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await syncCalendarEvents();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
