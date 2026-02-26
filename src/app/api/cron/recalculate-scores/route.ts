import { NextRequest, NextResponse } from "next/server";
import { recalculateAndPersistScores } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await recalculateAndPersistScores();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Score recalculation failed:", error);
    return NextResponse.json(
      { error: "Recalculation failed" },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggers during development
export async function GET(request: NextRequest) {
  return POST(request);
}
