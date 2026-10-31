#!/usr/bin/env python3
"""Знак НААШ: вырезаем канон из листа замков в PNG с прозрачным фоном.

Почему так, а не «нарисовать заново»: знак уже перерисован вектором по
присланному логотипу и лежит листом в `docs/merch/img/mark-lockups.webp`.
Любая ручная перерисовка — это снова «похоже, но не то» (так и вышло в 0.89.4
с фотографиями: на кепке, худи и значке стоял треугольник вместо крыши
с оконцем, четырёх букв и линейки).

Скрипт берёт чистый цветной знак с листа замков, делает альфу по фону и
сохраняет две версии:

  • `docs/naash/mark-color.png` — красная Н, янтарная А, зелёная А, синяя Ш,
    синяя крыша с оконцем и линейка: для эмали и печати по светлому;
  • `docs/naash/mark-mono.png` — тот же контур одним кремовым цветом
    #F4EFE4: вышивка, печать по синему, тиснение (правило naash-shop.md:
    «знак всегда кремовый на синем»).

Запуск: python3 scripts/make-naash-mark.py
"""
from PIL import Image

SRC = 'docs/merch/img/mark-lockups.webp'
# Чистый знак в правой верхней части листа (буквы 1152…1351, крыша 1107…1396).
BOX = (1098, 172, 1405, 476)
CREAM = '#F4EFE4'
BG = (0xEF, 0xE9, 0xDD)     # кремовая бумага листа
TOL = 18                    # насколько пиксель может отличаться от бумаги
UPSCALE = 2                 # 307 px → 614 px: запас для съёмки и печати


def alpha_from_bg(im, bg=BG, tol=TOL):
    """Альфа по расстоянию до цвета бумаги: знак сплошной, полутонов нет."""
    px = im.load()
    w, h = im.size
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            a = 0 if d <= tol else min(255, round((d - tol) * 255 / 60))
            op[x, y] = (r, g, b, a)
    return out


def trim(im, pad=6):
    """Обрезаем по знаку и оставляем прозрачный запас: иначе острие крыши
    липнет к краю кадра и при сборке снимком режется."""
    box = im.getbbox()
    x0, y0, x1, y1 = box
    out = Image.new('RGBA', (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    out.paste(im.crop(box), (pad, pad))
    return out


def main():
    sheet = Image.open(SRC).convert('RGB').crop(BOX)
    color = trim(alpha_from_bg(sheet))
    mono = Image.new('RGBA', color.size, (0, 0, 0, 0))
    mono.paste(CREAM, (0, 0, *color.size), color.split()[3])
    for name, im in (('mark-color', color), ('mark-mono', mono)):
        big = im.resize((im.width * UPSCALE, im.height * UPSCALE), Image.LANCZOS)
        path = f'docs/naash/{name}.png'
        big.save(path)
        print(f'✓ {path} {big.width}×{big.height}')


if __name__ == '__main__':
    main()
