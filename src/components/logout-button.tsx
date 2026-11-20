"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost small"
      type="button"
      onClick={() => {
        void fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/");
          router.refresh();
        });
      }}
    >
      Log out
    </button>
  );
}
