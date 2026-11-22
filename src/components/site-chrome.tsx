"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clientHasAuthFlag } from "@/shared/auth-flag";
import { footerNav, headerNav, routes } from "@/shared/routes";

export function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#000000" />
      <path d="M4 8.2V4.4h3.8M24 8.2V4.4h-3.8M4 19.8v3.8h3.8M24 19.8v3.8h-3.8" fill="none" stroke="#d1fe17" strokeWidth="1.3" />
      <path d="M7 19V9h3.2l3.8 6.2L17.8 9H21v10h-2.4v-6.1L15.2 19h-2.4l-3.4-6.1V19H7z" fill="#d1fe17" />
    </svg>
  );
}

export function SiteHeader() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setAuthed(clientHasAuthFlag()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link className="brand" href={routes.home}>
          <Mark />
          Nr8tr
        </Link>
        <nav className="nav" aria-label="Primary">
          {headerNav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
          {authed ? (
            <Link className="btn small" href={routes.app}>
              Open Studio
            </Link>
          ) : (
            <>
              <Link className="header-login" href={routes.login}>
                Log in
              </Link>
              <Link className="btn small" href={routes.signup}>
                Start a brief
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <p className="muted">Nr8tr prices a shot before it spends a credit.</p>
        <nav className="nav" aria-label="Footer">
          {footerNav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
