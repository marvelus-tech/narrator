import { z } from "zod";
import { requireUser } from "@/server/auth";
import { startCheckout } from "@/server/billing";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), plan: z.enum(["starter", "maker", "studio"]) }),
  z.object({ kind: z.literal("pack"), pack: z.enum(["pack_200", "pack_500", "pack_1000"]) }),
]);

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: "invalid_body", message: "Choose a plan or a pack." }, { status: 400 });
    const result = await startCheckout(db, user, parsed.data);
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
