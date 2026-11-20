import { getDb } from "@/server/db";
import { ApiError, jsonError } from "@/server/errors";
import { processQueue } from "@/server/jobs";
import { demoMode } from "@/server/ids";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = process.env.JOB_TICK_SECRET;
    const header = req.headers.get("authorization");
    const demoDev = demoMode() && process.env.NODE_ENV !== "production";
    if (!(secret && header === `Bearer ${secret}`) && !demoDev) throw new ApiError(401, "invalid_login");
    await processQueue(getDb(), 5);
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
