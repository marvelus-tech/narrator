import { ImageResponse } from "next/og";
import { creditExamples, landing } from "@/shared/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const draft = creditExamples[1];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          color: "#f4f6f8",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", color: "#ff5000", fontSize: 28, letterSpacing: 4 }}>
          <div style={{ display: "flex" }}>Nr8tr</div>
          <div style={{ display: "flex" }}>REC 00:00:05:00</div>
        </div>
        <div style={{ display: "flex", fontSize: 68, lineHeight: 1.05, maxWidth: 980 }}>{landing.title}</div>
        <div style={{ display: "flex", color: "#d1fe17", fontSize: 32 }}>
          {draft.credits} cr · {draft.dollars} for a 5 second 480p clip
        </div>
      </div>
    ),
    size,
  );
}
