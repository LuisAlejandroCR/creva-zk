#!/usr/bin/env python3
# generate-icons.py
# Regenerates web/public/icons/*.png on Creva's brand tokens. Every colour
# here is copied by value from creva_finance/frontend/app/globals.css; no
# image asset is taken from that repo, only the token values.
# Requires Pillow (`pip install Pillow`); run manually, not part of the build.

import math
from pathlib import Path
from PIL import Image, ImageDraw

# --- Brand tokens, verbatim from globals.css -------------------------------
# --cr-card-gradient: linear-gradient(135deg, #E12355 0%, #C41E3A 100%)
GRADIENT_START = (0xE1, 0x23, 0x55)
GRADIENT_END = (0xC4, 0x1E, 0x3A)
# --cr-on-brand: #FFFFFF — the mark that sits on the brand surface.
ON_BRAND = (0xFF, 0xFF, 0xFF)

SUPERSAMPLE = 4  # shapes are drawn at 4x and downsampled for clean edges

# The mark is Creva's C, not a check: the same letter the product's own app
# icon carries, so the two read as one family on a home screen. Coordinates are
# normalised to the box it is drawn in; angles follow Pillow's convention, 0 at
# three o'clock and growing clockwise, so the aperture sits on the right.
# Pillow's arc grows inward from the bounding box, so this is the OUTER radius
# of the stroke, not its centreline.
C_RADIUS = 0.32
C_STROKE = 0.115
C_START_DEG = 40
C_END_DEG = 320

# Every icon is a full-bleed gradient square, opaque edge to edge. No baked
# corner radius: the launcher (and, in the app header, a CSS border-radius)
# rounds it, and a baked-in field colour would show as a ring around the tile
# wherever the two radii disagree. Opaque throughout also keeps iOS from
# painting transparency black on the apple-touch-icon.
MARK_SCALE = 0.95
# Maskable icons must keep their content inside a centred circle 80% of the
# canvas across. The mark is scaled down so its farthest corner stays inside.
MASKABLE_MARK_SCALE = 0.85

ICONS_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"


def gradient(size):
    """The 135deg card gradient: start at top-left, end at bottom-right."""
    image = Image.new("RGB", (size, size))
    span = max(1, 2 * (size - 1))
    pixels = []
    for y in range(size):
        for x in range(size):
            t = (x + y) / span
            pixels.append(
                tuple(
                    round(start + (end - start) * t)
                    for start, end in zip(GRADIENT_START, GRADIENT_END)
                )
            )
    image.putdata(pixels)
    return image


def c_mask(size, scale=1.0):
    """A white-on-black mask of the C, antialiased by downsampling."""
    big = size * SUPERSAMPLE
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)

    centre = big / 2
    radius = C_RADIUS * scale * big
    width = C_STROKE * scale * big
    box = [centre - radius, centre - radius, centre + radius, centre + radius]
    draw.arc(box, C_START_DEG, C_END_DEG, fill=255, width=round(width))

    # Round terminals: Pillow's arc has square ends, so cap them by hand. The
    # cap sits on the stroke's centreline — half a stroke inside the outer
    # radius — or it bulges past the curve on one side and misses it on the
    # other.
    for degrees in (C_START_DEG, C_END_DEG):
        angle = math.radians(degrees)
        mid = radius - width / 2
        x = centre + mid * math.cos(angle)
        y = centre + mid * math.sin(angle)
        r = width / 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=255)

    return mask.resize((size, size), Image.LANCZOS)


def build_icon(size, mark_scale):
    """Full-bleed gradient with the white C centred on it."""
    canvas = gradient(size).convert("RGBA")
    mark = Image.new("RGBA", (size, size), ON_BRAND + (255,))
    canvas.paste(mark, (0, 0), c_mask(size, scale=mark_scale))
    return canvas


def main():
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    outputs = {
        "icon-192.png": build_icon(192, MARK_SCALE),
        "icon-512.png": build_icon(512, MARK_SCALE),
        "icon-maskable-512.png": build_icon(512, MASKABLE_MARK_SCALE),
    }
    for name, image in outputs.items():
        path = ICONS_DIR / name
        image.save(path, "PNG")
        print(f"wrote {path} ({image.size[0]}x{image.size[1]})")


if __name__ == "__main__":
    main()
