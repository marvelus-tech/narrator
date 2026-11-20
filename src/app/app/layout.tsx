import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { currentUser } from "@/server/current-user";
import { appNav, routes } from "@/shared/routes";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect(routes.login);
  return (
    <div>
      <nav className="app-nav" aria-label="Account">
        <div>
          {appNav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
