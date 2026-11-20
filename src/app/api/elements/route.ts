import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { attachAsset, createElement, linkElement } from "@/server/projects";
import { assertSameOrigin } from "@/server/rate";

export const runtime = "nodejs";

const createSchema = z.object({
  action: z.literal("create"),
  projectId: z.string().min(8),
  kind: z.enum(["character", "location", "prop"]),
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(400).optional(),
});

const linkSchema = z.object({
  action: z.literal("link"),
  shotId: z.string().min(8),
  elementId: z.string().min(8),
  linked: z.boolean(),
});

const attachSchema = z.object({
  action: z.literal("attach"),
  elementId: z.string().min(8),
  assetId: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const body = await readJson(req);
    const created = createSchema.safeParse(body);
    if (created.success) {
      const id = createElement(db, user.id, { ...created.data, notes: created.data.notes ?? "" });
      return Response.json({ id });
    }
    const linked = linkSchema.safeParse(body);
    if (linked.success) {
      linkElement(db, user.id, linked.data.shotId, linked.data.elementId, linked.data.linked);
      return Response.json({ ok: true });
    }
    const attached = attachSchema.safeParse(body);
    if (attached.success) {
      attachAsset(db, user.id, attached.data.elementId, attached.data.assetId);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "invalid_body", message: "That reference could not be saved." }, { status: 400 });
  } catch (err) {
    return jsonError(err);
  }
}
