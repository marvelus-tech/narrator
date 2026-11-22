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
          background: "#09090b",
          color: "#f5f3ee",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, letterSpacing: 4 }}>
          <div style={{ display: "flex", color: "#f5f3ee" }}>Nr8tr</div>
          <div style={{ display: "flex", color: "#f5a524" }}>TC 00:00:03:14</div>
        </div>
        <div style={{ display: "flex", fontSize: 64, lineHeight: 1.05, maxWidth: 1000 }}>{landing.title}</div>
        <div style={{ display: "flex", color: "#34d399", fontSize: 32 }}>
          {draft.credits} cr · {draft.dollars} for a 5 second 480p clip
        </div>
      </div>
    ),
    size,
  );
}
