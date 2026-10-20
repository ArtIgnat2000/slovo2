"""Prepare generated pencil illustrations: remove connected paper, export WebP.
Usage: .venv/bin/python scripts/process-electronics-art.py path/to/source/*.png
Requires Pillow. Original PNGs are not needed by the application.
"""
from collections import deque
from pathlib import Path
import sys
from PIL import Image, ImageFilter

for source in map(Path, sys.argv[1:]):
    image = Image.open(source).convert('RGBA')
    image.thumbnail((960, 960), Image.Resampling.LANCZOS)
    w, h = image.size
    pixels = image.load()
    seen = bytearray(w * h)
    queue = deque((x, y) for x in range(w) for y in (0, h - 1))
    queue.extend((x, y) for y in range(h) for x in (0, w - 1))
    # The open space inside the headband is also paper.
    if source.stem == 'headphones-max':
        queue.append((w // 2, h * 35 // 100))
    while queue:
        x, y = queue.popleft()
        pos = y * w + x
        if seen[pos]:
            continue
        seen[pos] = 1
        r, g, b, _ = pixels[x, y]
        if min(r, g, b) < 230:
            continue
        pixels[x, y] = (r, g, b, 0)
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx]:
                queue.append((nx, ny))
    # Slightly soften the cut edge, not the fine detail of the drawing.
    image.putalpha(image.getchannel('A').filter(ImageFilter.GaussianBlur(.35)))
    target = Path('public/electronics') / (source.stem + '.webp')
    image.save(target, quality=90, method=6)
    print(target, target.stat().st_size)
