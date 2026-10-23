"""Prepare small, offline colour palettes from the same FlagCDN images used in Forma.
Requires Pillow. Run from the repository root; no network requests are needed at runtime.
"""
import io
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

countries = json.loads(Path("public/data/countries-50m.json").read_text(encoding="utf-8"))
codes = sorted({c["code"] for c in countries if re.fullmatch(r"[A-Z]{2}", c["code"])})

def palette(code):
    try:
        request = urllib.request.Request(f"https://flagcdn.com/w80/{code.lower()}.png", headers={"User-Agent": "Forma palette preparation"})
        with urllib.request.urlopen(request, timeout=25) as response:
            image = Image.open(io.BytesIO(response.read())).convert("RGB")
        image = image.quantize(colors=8, dither=Image.Dither.NONE).convert("RGB")
        pixels = image.width * image.height
        colors = sorted(image.getcolors(pixels), reverse=True)
        return code, ["#%02x%02x%02x" % color for count, color in colors if count / pixels >= 0.015]
    except Exception as error:
        print(f"No palette for {code}: {type(error).__name__}")
        return code, []

with ThreadPoolExecutor(max_workers=10) as executor:
    palettes = dict(executor.map(palette, codes))
output = {c["id"]: palettes.get(c["code"], []) for c in countries}
Path("src/flagPalettes.json").write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")
print(f"Prepared {sum(bool(p) for p in output.values())} country flag palettes.")
