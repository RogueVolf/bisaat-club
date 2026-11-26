import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { formatOpensLabel } from "@/content/format";
import { SEED } from "@/content/seed";
import { getSiteContent } from "@/server/content/repository";

export const alt = "Bisaat Club. Play. Read. Stay.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [font, logo] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/DMSans-Bold.ttf")),
  readFile(join(process.cwd(), "public/brand/logo.png")),
]);
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

export default async function Image() {
  const { settings } = await getSiteContent()
    .then((r) => r.content)
    .catch(() => SEED);
  const opens = formatOpensLabel(settings.openingAt, settings.timezone);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1F2A44",
          padding: "70px 80px",
          fontFamily: "DM Sans",
          fontWeight: 700,
        }}
      >
        <img src={logoSrc} width={560} height={140} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 44, color: "#E3A33B" }}>{opens}</div>
          <div style={{ fontSize: 104, color: "#F3EBDD", letterSpacing: -3, marginTop: 8 }}>Play. Read. Stay.</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "DM Sans", data: font, style: "normal", weight: 700 }] },
  );
}
