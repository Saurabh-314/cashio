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
          justifyContent: "center",
          padding: 80,
          background: "#F7F7F5",
          color: "#171717",
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#737373" }}>
          Private ledger
        </div>
        <div style={{ fontSize: 72, fontWeight: 500, marginTop: 16 }}>Cashio</div>
        <div style={{ fontSize: 28, color: "#737373", marginTop: 16 }}>
          Personal finance, written with care
        </div>
      </div>
    ),
    { ...size },
  );
}
