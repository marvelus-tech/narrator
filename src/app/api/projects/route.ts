import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { jsonError } from "@/server/errors";
import { readJson } from "@/server/http";
import { briefSchema, createProject, listProjects } from "@/server/projects";
import { assertSameOrigin } from "@/server/rate";
import { routes } from "@/shared/routes";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const db = getDb();
    const user = requireUser(db, req);
    return Response.json({ projects: listProjects(db, user.id) });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const db = getDb();
    const user = requireUser(db, req);
    const parsed = briefSchema.safeParse(await readJson(req));
    if (!parsed.success) return Response.json({ error: "invalid_body", message: "Write a brief of at least 12 characters." }, { status: 400 });
    const id = await createProject(db, user, parsed.data);
    return Response.json({ id, next: routes.project(id) });
  } catch (err) {
    return jsonError(err);
  }
}
