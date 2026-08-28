// packages/gainmap/e2e/generate-fixtures.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const input = join(root, "test/fixtures/input");

async function main() {
  await mkdir(join(input, "tree/nested"), { recursive: true });
  await mkdir(join(input, "tree/skip"), { recursive: true });

  await sharp({
    create: { width: 8, height: 8, channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 } }
  }).png().toFile(join(input, "white.png"));

  await sharp({
    create: { width: 8, height: 8, channels: 3,
      background: { r: 200, g: 160, b: 100 } }
  }).jpeg({ quality: 90 }).toFile(join(input, "photo.jpg"));

  await writeFile(join(input, "mark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="white"/></svg>');

  await sharp({
    create: { width: 8, height: 8, channels: 3,
      background: { r: 100, g: 150, b: 200 } }
  }).gif().toFile(join(input, "frame.gif"));

  await sharp({
    create: { width: 8, height: 8, channels: 4,
      background: { r: 80, g: 120, b: 200, alpha: 1 } }
  }).webp().toFile(join(input, "shot.webp"));

  await sharp({
    create: { width: 8, height: 8, channels: 3,
      background: { r: 220, g: 180, b: 140 } }
  }).jpeg({ quality: 90 }).toFile(join(input, "tree/a.jpg"));

  await sharp({
    create: { width: 8, height: 8, channels: 3,
      background: { r: 140, g: 180, b: 220 } }
  }).jpeg({ quality: 90 }).toFile(join(input, "tree/nested/b.jpg"));

  await sharp({
    create: { width: 8, height: 8, channels: 3,
      background: { r: 60, g: 60, b: 60 } }
  }).jpeg({ quality: 90 }).toFile(join(input, "tree/skip/c.jpg"));

  console.log("Fixture inputs generated.");
}

main().catch((e) => { console.error(e); process.exit(1); });
