import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { enqueueGeneration, kickWorker } from "@/server/jobs";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["still", "video"]),
  resolution: z.enum(["480p", "720p"]),
  takes: z.number().int().min(1).max(4),
  confirm: z.literal(true),
  expectedMillicredits: z.number().int().positive(),
  requestId: z.string().min(8).max(80),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: "invalid_body", message: "Confirm the quote before generating." }, { status: 400 });
    const { id } = await context.params;
    const result = enqueueGeneration(db, { user, shotId: id, ...parsed.data });
    kickWorker(db);
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
