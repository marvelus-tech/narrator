"use client";

import { useState } from "react";

export function ResendButton() {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn small"
        type="button"
        onClick={() => {
          void fetch("/api/auth/resend", { method: "POST" })
            .then((res) => res.json())
            .then((data: { message?: string; devVerifyUrl?: string; already?: boolean }) => {
              if (data.already) setMessage("This email is already verified.");
              else if (data.devVerifyUrl) setMessage(data.devVerifyUrl);
              else setMessage(data.message ?? "Check the server outbox for the new link.");
            });
        }}
      >
        Send verification link
      </button>
      {message ? <p className="panel">{message}</p> : null}
    </div>
  );
}
