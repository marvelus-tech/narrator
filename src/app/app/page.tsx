import Link from "next/link";
import { DeskClient } from "@/components/desk-client";
import { currentUser } from "@/server/current-user";
import { availableMillicredits } from "@/server/credits";
import { pageMeta } from "@/server/meta";
import { listProjects } from "@/server/projects";
import { getDb } from "@/server/db";
import { routes } from "@/shared/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("app");

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect(routes.login);
  const db = getDb();
  const projects = listProjects(db, user.id);
  const canPublish = user.plan === "maker" || user.plan === "studio";
  return (
    <div className="wrap section">
      <DeskClient
        verified={Boolean(user.email_verified_at)}
        canPublish={canPublish}
        startingBalance={availableMillicredits(db, user.id)}
        initialProjectId={projects[0]?.id ?? null}
      />
      <div className="section">
        <p><Link href={routes.newProject}>New brief</Link></p>
        {projects.map((project) => (
          <p key={project.id}><Link href={routes.project(project.id)}>{project.title}</Link></p>
        ))}
      </div>
    </div>
  );
}
