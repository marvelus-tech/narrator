import { notFound, redirect } from "next/navigation";
import { ProjectWorkspace } from "@/components/project-workspace";
import { currentUser } from "@/server/current-user";
import { getDb } from "@/server/db";
import { pageMeta } from "@/server/meta";
import { projectPayload } from "@/server/projects";
import { routes } from "@/shared/routes";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("project");

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect(routes.login);
  const { id } = await params;
  const payload = projectPayload(getDb(), user, id);
  if (!payload) notFound();
  return <ProjectWorkspace initial={payload} />;
}
