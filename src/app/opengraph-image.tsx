import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1c1916",
          color: "#f3efe6",
          padding: 64,
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4 }}>NARRATOR</div>
        <div style={{ fontSize: 68, lineHeight: 1.05, maxWidth: 900 }}>One brief. A shot list you can price.</div>
      </div>
    ),
    size,
  );
}
