// One-off: crops the logo mark (the symbol, not the wordmark) from public/brand/logo.png
// onto the ink background. Run: npx tsx scripts/make-icons.ts
import path from "node:path";
import sharp from "sharp";

const INK = "#1F2A44";
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/brand/logo.png");
// The mark occupies roughly x 112-320, y 12-208 of the 1024x256 logo.
const MARK = { left: 112, top: 12, width: 208, height: 196 };

async function make(size: number, out: string) {
  const inner = Math.round(size * 0.68);
  const mark = await sharp(src)
    .extract(MARK)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(path.join(root, "src/app", out));
}

void Promise.all([make(512, "icon.png"), make(180, "apple-icon.png")]);
