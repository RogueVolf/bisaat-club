// Regenerates the icons and the Open Graph logo from the brand kit in brand/.
// Run: npx tsx scripts/make-icons.ts
import path from "node:path";
import sharp from "sharp";

const CREAM = "#F3EBDD";
const root = path.resolve(__dirname, "..");
const avatar = path.join(root, "brand/profile-picture-cream.png");
const cover = path.join(root, "brand/facebook-cover.png");

// Mark bounding box in the 1080x1080 avatar (x 283-795, y 299-779), 512 wide, 480 tall.
// The ink mass centroid sits at (553, 514), right of and above the box centre (539, 539),
// because the lower-right block is heavy. Centre on the midpoint of the two so it reads centred.
const MARK_SIDE = 512;
const OPTICAL_CENTRE = { x: 546, y: 526 };
const ICON_PADDING = 0.12; // fraction of the side, each edge

async function makeIcon(size: number, out: string) {
  const side = Math.round(MARK_SIDE / (1 - 2 * ICON_PADDING));
  await sharp(avatar)
    .extract({
      left: OPTICAL_CENTRE.x - Math.round(side / 2),
      top: OPTICAL_CENTRE.y - Math.round(side / 2),
      width: side,
      height: side,
    })
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
