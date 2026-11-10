import { NextRequest, NextResponse } from "next/server";
import { syncMedia } from "@/lib/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
async function run(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, results: await syncMedia() });
}
