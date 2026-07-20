from PIL import Image, ImageDraw, ImageFont
import os

ACCENT = (76, 79, 224, 255)  # --color-accent light value
CONTRAST = (255, 255, 255, 255)  # --color-accent-contrast light value

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT_DIR, exist_ok=True)


def make_icon(size: int, maskable: bool, filename: str) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        # Maskable icons need the safe zone filled edge-to-edge (no transparency
        # at the corners), per the manifest maskable-icon spec.
        draw.rectangle([0, 0, size, size], fill=ACCENT)
        pad = size * 0.22
    else:
        radius = size * 0.22
        draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=ACCENT)
        pad = size * 0.24

    mark_box = [pad, pad, size - pad, size - pad]
    stroke = max(2, int(size * 0.06))
    draw.rounded_rectangle(mark_box, radius=size * 0.06, outline=CONTRAST, width=stroke)

    inset = pad + (size - 2 * pad) * 0.32
    draw.line([inset, size / 2, size - inset, size / 2], fill=CONTRAST, width=stroke)
    draw.line([size / 2, inset, size / 2, size - inset], fill=CONTRAST, width=stroke)

    img.save(os.path.join(OUT_DIR, filename))


make_icon(192, False, "icon-192.png")
make_icon(512, False, "icon-512.png")
make_icon(512, True, "icon-512-maskable.png")
print("Icons written to", OUT_DIR)
