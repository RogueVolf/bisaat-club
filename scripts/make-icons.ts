// Regenerates the icons and the Open Graph logo from the brand kit in brand/.
// Run: npx tsx scripts/make-icons.ts
import path from "node:path";
import sharp from "sharp";

const CREAM = "#F3EBDD";
const root = path.resolve(__dirname, "..");
const mark = path.join(root, "brand/icon-on-cream.png");
const cover = path.join(root, "brand/facebook-cover.png");
const ICON_PADDING = 0.12; // fraction of the side, each edge

/**
 * Finds the mark in the square brand icon: its bounding box and an optical centre halfway between the
 * box centre and the ink-mass centroid (the heavy lower-right block pulls the centroid off centre, and
 * centring on either one alone reads as off-centre at favicon size).
 */
async function locateMark(file: string) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [br, bg, bb] = [data[0], data[1], data[2]]; // background colour from the top-left pixel
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, sx = 0, sy = 0, n = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) < 48) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      sx += x; sy += y; n++;
    }
  }
  const box = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return {
    side: Math.max(maxX - minX + 1, maxY - minY + 1),
    centre: { x: Math.round((box.x + sx / n) / 2), y: Math.round((box.y + sy / n) / 2) },
    imageSide: info.width,
  };
}

async function makeIcon(size: number, out: string) {
  const { side: markSide, centre, imageSide } = await locateMark(mark);
  const side = Math.min(imageSide, Math.round(markSide / (1 - 2 * ICON_PADDING)));
  const left = Math.max(0, Math.min(imageSide - side, centre.x - Math.round(side / 2)));
  const top = Math.max(0, Math.min(imageSide - side, centre.y - Math.round(side / 2)));
  await sharp(mark)
    .extract({ left, top, width: side, height: side })
    .resize(size, size)
    .flatten({ background: CREAM })
    .png()
    .toFile(path.join(root, "src/app", out));
}

// Full logo (mark, wordmark, CLUB) from the 1640x924 cover: ink pixels span x 420-1240, y 298-530.
// The crop keeps the cover's ink background, which equals the OG background (#1F2A44).
async function makeOgLogo() {
  await sharp(cover)
    .extract({ left: 400, top: 278, width: 861, height: 273 })
    .png()
    .toFile(path.join(root, "public/brand/og-logo.png"));
}

void Promise.all([makeIcon(512, "icon.png"), makeIcon(180, "apple-icon.png"), makeOgLogo()]);
