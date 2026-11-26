/**
 * Writes the header logo at the size the header shows it (#brand is a 168x42 box) for 1x, 2x and 3x screens:
 * public/brand/logo-header.png, logo-header@2x.png, logo-header@3x.png. Lossless PNG, Lanczos resampling.
 * The WebGL sign texture keeps using the full-resolution public/brand/logo.png.
 *
 *   npx tsx scripts/make-header-logo.ts
 */
import path from "node:path";
import sharp from "sharp";

const dir = path.join(__dirname, "..", "public", "brand");
const src = path.join(dir, "logo.png");

(async () => {
  for (const [scale, suffix] of [[1, ""], [2, "@2x"], [3, "@3x"]] as const) {
    const out = path.join(dir, `logo-header${suffix}.png`);
    const info = await sharp(src).resize({ width: 168 * scale, height: 42 * scale, kernel: "lanczos3" })
      .png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toFile(out);
    console.log(`${path.relative(process.cwd(), out)}: ${info.width}x${info.height}, ${info.size} bytes`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
