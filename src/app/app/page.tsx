import Link from "next/link";
import { currentUser } from "@/server/current-user";
import { availableMillicredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { pageMeta } from "@/server/meta";
import { listProjects } from "@/server/projects";
import { formatCredits } from "@/shared/economy";
import { routes } from "@/shared/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("app");

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ verified?: string }> }) {
  const user = await currentUser();
  if (!user) redirect(routes.login);
  const query = await searchParams;
  const db = getDb();
  const projects = listProjects(db, user.id);
  const balance = availableMillicredits(db, user.id);
  return (
    <div className="wrap section">
      <p className="kicker">Projects</p>
      <h1>Your desk</h1>
      <p className="lede">
        {formatCredits(balance)} credits available.
        {user.email_verified_at ? "" : " Verify email before the first generation."}
        {query.verified ? " Email verified." : ""}
      </p>
      {projects.length === 0 ? (
        <div className="panel">
          <h2>Nothing on the board yet</h2>
          <p>Write one brief. Narrator will draft a shot list you can edit before anything is generated.</p>
          <Link className="btn" href={routes.newProject}>Write a brief</Link>
        </div>
      ) : (
        <div>
          <p><Link className="btn" href={routes.newProject}>New brief</Link></p>
          {projects.map((project) => (
            <article key={project.id} className="project-row">
              <h2><Link href={routes.project(project.id)}>{project.title}</Link></h2>
              <p className="muted">{project.shots} shots, {project.outputs} finished files. {project.brief.slice(0, 140)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
