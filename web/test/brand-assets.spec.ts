// brand-assets.spec.ts
// Guards the installed-app assets against drifting off Creva's brand: the
// icons must carry the crimson card gradient and no teal, stay opaque (iOS
// paints alpha black), and keep the maskable safe area. Decodes the PNGs
// with node:zlib so the check is on real pixels, not on file size.

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  readonly pixels: Buffer;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// Minimal decoder for the one shape we emit: 8-bit RGBA, non-interlaced.
function decodePng(file: Buffer): DecodedPng {
  expect(file.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];

  let offset = 8;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.subarray(offset + 4, offset + 8).toString('ascii');
    const data = file.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data.readUInt8(8), 'bit depth').toBe(8);
      expect(data.readUInt8(9), 'colour type (6 = RGBA)').toBe(6);
      expect(data.readUInt8(12), 'interlace').toBe(0);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? pixels[y * stride + x - bpp]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= bpp ? pixels[(y - 1) * stride + x - bpp]! : 0;

      let value = line[x]!;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);

      pixels[y * stride + x] = value & 0xff;
    }
  }

  return { width, height, pixels };
}

function loadIcon(name: string): DecodedPng {
  return decodePng(readFileSync(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url))));
}

// The teal that shipped before the brand pass. Creva's palette has no teal at
// all, so any pixel in this range is the old mark coming back.
function isTeal(r: number, g: number, b: number): boolean {
  return g > 140 && b > 140 && r < 130;
}

// The --cr-card-gradient band: #E12355 → #C41E3A.
function isCrimson(r: number, g: number, b: number): boolean {
  return r > 150 && g >= 20 && g < 80 && b >= 30 && b <= 110;
}

const ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'] as const;

describe.each(ICONS)('%s', (name) => {
  const icon = loadIcon(name);

  it('carries the crimson card gradient and no teal', () => {
    let teal = 0;
    let crimson = 0;

    for (let i = 0; i < icon.pixels.length; i += 4) {
      const [r, g, b] = [icon.pixels[i]!, icon.pixels[i + 1]!, icon.pixels[i + 2]!];
      if (isTeal(r, g, b)) teal += 1;
      if (isCrimson(r, g, b)) crimson += 1;
    }

    expect(teal, 'teal pixels').toBe(0);
    expect(crimson, 'crimson pixels').toBeGreaterThan(0);
  });

  it('is fully opaque, since iOS paints transparency black', () => {
    for (let i = 3; i < icon.pixels.length; i += 4) {
      if (icon.pixels[i] !== 255) {
        expect.fail(`transparent pixel at byte ${i}`);
      }
    }
  });
});

describe('icon-maskable-512.png', () => {
  it('keeps the mark inside the 80% safe circle', () => {
    const icon = loadIcon('icon-maskable-512.png');
    const centre = (icon.width - 1) / 2;
    let maxRadius = 0;

    for (let y = 0; y < icon.height; y += 1) {
      for (let x = 0; x < icon.width; x += 1) {
        const i = (y * icon.width + x) * 4;
        const [r, g, b] = [icon.pixels[i]!, icon.pixels[i + 1]!, icon.pixels[i + 2]!];
        if (r > 200 && g > 200 && b > 200) {
          maxRadius = Math.max(maxRadius, Math.hypot(x - centre, y - centre));
        }
      }
    }

    expect(maxRadius).toBeGreaterThan(0);
    // Safe area: a centred circle 80% of the canvas across, so radius <= 40%.
    expect(maxRadius / icon.width).toBeLessThanOrEqual(0.4);
  });
});

describe('manifest.webmanifest', () => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf8'),
  );

  it('carries the Creva ink background and theme colour', () => {
    // --cr-bg on the dark/ink palette, the same value creva_finance's
    // layout.tsx sets as its viewport themeColor.
    expect(manifest.theme_color).toBe('#17130F');
    expect(manifest.background_color).toBe('#17130F');
  });

  it('declares every icon this repo ships, including a maskable one', () => {
    const sources = manifest.icons.map((icon: { src: string }) => icon.src);
    for (const name of ICONS) expect(sources).toContain(`/icons/${name}`);

    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain('maskable');
  });
});
