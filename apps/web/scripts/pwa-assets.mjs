// Renders the PWA icons and iOS launch screens from public/icons/favicon.svg.
// Run after changing the glyph: `node scripts/pwa-assets.mjs` (from apps/web). Output is committed.
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const BG = "#0a0a0a";
const glyph = readFileSync(new URL("../public/icons/favicon.svg", import.meta.url));
const screens = JSON.parse(
	readFileSync(new URL("../src/features/pwa/lib/splash-screens.json", import.meta.url), "utf8"),
);
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

/** The glyph at `scale` of the shorter side, centred on the app background. */
async function render(width, height, scale, file, background = BG) {
	const size = Math.round(Math.min(width, height) * scale);
	const mark = await sharp(glyph, { density: 600 }).resize(size, size).png().toBuffer();
	await sharp({ create: { width, height, channels: 4, background } })
		.composite([{ input: mark, gravity: "centre" }])
		.png({ compressionLevel: 9 })
		.toFile(out(file));
}

await mkdir(out("splash"), { recursive: true });
await render(180, 180, 0.7, "apple-touch-icon.png");
await render(192, 192, 0.7, "icon-192.png");
await render(512, 512, 0.7, "icon-512.png");
// Maskable icons get cropped to a circle or squircle: keep the glyph inside the 80% safe zone.
await render(512, 512, 0.5, "icon-maskable-512.png");
// Android tints the badge itself: a bare glyph on transparent.
await render(96, 96, 0.9, "badge-96.png", { r: 0, g: 0, b: 0, alpha: 0 });
for (const { width, height, ratio } of screens) {
	await render(width * ratio, height * ratio, 0.22, `splash/${width}x${height}@${ratio}.png`);
}
