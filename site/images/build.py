#!/usr/bin/env python3
"""
Builds the website's images from the screenshot captures of the qremote-ios repository
(checked out next to this one):

    python3 images/build.py            # from site/
    SCREENSHOTS=/path/to/docs/screenshots python3 images/build.py

- iphone-<name>-light.png / -dark.png   (raw/en-light and raw/en)
- watch-<name>.png                      (raw/en; the watch is always dark)
- mac-relay-light.png / -dark.png       (the presentation in a browser window + the QRemote Relay menu)
- logo.png, favicon.png

The pages show the light or dark image with Quarto's .light-content / .dark-content classes.
Needs Pillow (pip install pillow).
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SHOTS = Path(os.environ.get("SCREENSHOTS", HERE / "../../../qremote-ios/docs/screenshots")).resolve()
LOGO = SHOTS / "../../Logo/qremote-logo-1024.png"

# Window chrome: Rosé Pine Dawn / Moon "surface"
CHROME = {"light": (255, 250, 243), "dark": (42, 39, 63)}


def save(img, name):
    img.save(HERE / name, optimize=True)
    print("wrote", name)


def iphones():
    for theme, folder in (("light", "en-light"), ("dark", "en")):
        for raw, name in (("1-remote", "remote"), ("3-timesup", "timesup"), ("2-pairing", "pairing")):
            im = Image.open(SHOTS / "raw" / folder / f"iphone-{raw}.png").convert("RGB")
            save(im.resize((660, round(im.height * 660 / im.width)), Image.LANCZOS), f"iphone-{name}-{theme}.png")


def watches():
    for raw in ("1-countdown", "2-steps", "3-timesup", "4-untimed"):
        # RGBA: keeps the rounded shape of the watch screen
        save(Image.open(SHOTS / "raw" / "en" / f"watch-{raw}.png").convert("RGBA"), f"watch-{raw.split('-', 1)[1]}.png")


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def shadow(canvas, box, radius, blur=36, opacity=110):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius, fill=(0, 0, 0, opacity))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def macs():
    """Browser window with the slide, and the relay menu over its right edge, on a transparent background."""
    for theme in ("light", "dark"):
        suffix = "-light" if theme == "light" else ""
        slide = Image.open(SHOTS / "raw" / "en" / f"mac-slide{suffix}.png").convert("RGB")
        menu = Image.open(SHOTS / "raw" / "en" / f"mac-menu{suffix}.png").convert("RGBA")
        W, H = 1800, 1060
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))

        ww, bar = 1300, 40
        slide = slide.resize((ww, round(slide.height * ww / slide.width)), Image.LANCZOS)
        wx, wy, wh = 60, 110, slide.height + bar
        shadow(canvas, [wx, wy + 16, wx + ww, wy + wh + 16], 18)
        win = Image.new("RGBA", (ww, wh), CHROME[theme])
        d = ImageDraw.Draw(win)
        for i, color in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
            cx = 26 + i * 24
            d.ellipse([cx - 7, bar / 2 - 7, cx + 7, bar / 2 + 7], fill=color)
        win.paste(slide, (0, bar))
        canvas.alpha_composite(rounded(win, 18), (wx, wy))

        mw = 560
        menu = menu.resize((mw, round(menu.height * mw / menu.width)), Image.LANCZOS)
        mx, my = W - mw - 60, 50
        shadow(canvas, [mx, my + 16, mx + mw, my + menu.height + 16], 24, opacity=140)
        canvas.alpha_composite(menu, (mx, my))
        save(canvas.crop(canvas.getbbox()), f"mac-relay-{theme}.png")   # trim the empty margins


def logos():
    logo = Image.open(LOGO)
    save(logo.resize((256, 256), Image.LANCZOS), "logo.png")
    save(logo.resize((64, 64), Image.LANCZOS), "favicon.png")


if __name__ == "__main__":
    iphones()
    watches()
    macs()
    logos()
