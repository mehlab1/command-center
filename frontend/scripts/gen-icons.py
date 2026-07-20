from PIL import Image, ImageDraw
import os

INK = (14, 17, 22, 255)  # --ink dark value (graphite background)
SIGNAL = (232, 163, 61, 255)  # --signal (terminal amber)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT_DIR, exist_ok=True)


def draw_bracket(draw, x, top, bottom, width, stroke, mirror: bool) -> None:
    # One half of the signature "[ ]" bracket-tag mark.
    tie = width if not mirror else -width
    draw.line([x, top, x + tie, top], fill=SIGNAL, width=stroke)
    draw.line([x, top, x, bottom], fill=SIGNAL, width=stroke)
    draw.line([x, bottom, x + tie, bottom], fill=SIGNAL, width=stroke)


def make_icon(size: int, maskable: bool, filename: str) -> None:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        draw.rectangle([0, 0, size, size], fill=INK)
        pad = size * 0.30
    else:
        radius = size * 0.22
        draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=INK)
        pad = size * 0.26

    stroke = max(2, round(size * 0.055))
    tie_width = (size - 2 * pad) * 0.22
    top, bottom = pad, size - pad

    draw_bracket(draw, pad, top, bottom, tie_width, stroke, mirror=False)
    draw_bracket(draw, size - pad, top, bottom, tie_width, stroke, mirror=True)

    img.save(os.path.join(OUT_DIR, filename))


make_icon(192, False, "icon-192.png")
make_icon(512, False, "icon-512.png")
make_icon(512, True, "icon-512-maskable.png")
print("Icons written to", OUT_DIR)
