"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, followUrl } from "@/shared/api-base";
import { readPending } from "@/shared/pending-prompt";
import { routes } from "@/shared/routes";

const TOOLS = [
  { id: "googledrive", label: "Google Drive" },
  { id: "dropbox", label: "Dropbox" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "X" },
  { id: "tiktok", label: "TikTok" },
] as const;

type Row = { toolkit: string; label: string; status: string };

export function StackConnect() {
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setPrompt(readPending()?.prompt ?? null), 0);
    void fetch(apiUrl("/api/integrations"), { credentials: "include" })
      .then((res) => res.json())
      .then((data: { connections?: Row[]; message?: string }) => {
        if (data.connections) setRows(data.connections);
        else if (data.message) setNote(data.message);
      })
      .catch(() => setNote("Connections load when you are signed in on the Nr8tr server."));
    return () => window.clearTimeout(timer);
  }, []);

  async function connect(toolkit: string) {
    setPending(toolkit);
    setNote(null);
    const res = await fetch(apiUrl("/api/integrations/connect"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit, next: routes.onboarding }),
    });
    const data = (await res.json().catch(() => ({}))) as { redirectUrl?: string | null; status?: string; message?: string };
    setPending(null);
    if (data.redirectUrl) {
      followUrl(data.redirectUrl);
      return;
    }
    setNote(data.message ?? "Add COMPOSIO_API_KEY to connect this toolkit. The studio still runs without it.");
  }

  async function disconnect(toolkit: string) {
    await fetch(apiUrl("/api/integrations"), {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit }),
    });
    setRows((current) => current.map((row) => (row.toolkit === toolkit ? { ...row, status: "disconnected" } : row)));
  }

  return (
    <div className="studio">
      <p className="kicker">After sign-in</p>
      <h1>Connect your creative stack</h1>
      <p className="lede">One click starts the Composio connection. Generation and credits stay on Nr8tr.</p>
      {prompt ? <p className="muted">Queued prompt: {prompt}</p> : null}
      <div className="stack-grid">
        {TOOLS.map((tool) => {
          const row = rows.find((item) => item.toolkit === tool.id);
          const on = row?.status === "active";
          return (
            <article key={tool.id} className="shot-card">
              <h2>{tool.label}</h2>
              <p className="muted">{on ? "Connected" : "Not connected"}</p>
              {on ? (
                <button className="btn-ghost" type="button" onClick={() => void disconnect(tool.id)}>Disconnect</button>
              ) : (
                <button className="btn" type="button" disabled={pending === tool.id} onClick={() => void connect(tool.id)}>
                  Connect {tool.label}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {note ? <p className="panel">{note}</p> : null}
      <p>
        <Link className="btn" href={`${routes.app}?autorun=1`}>Continue to Studio</Link>
      </p>
    </div>
  );
}
