#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Слайды к релизу «СЛОВО 2.0» — для родительского чата.

Пять картинок 1080×1350 (4:5 — в мессенджере читаются с телефона без зума)
в палитре приложения (src/styles/tokens.css): обложка со списком класса,
сами 26 слов, три режима, отчёт по словам, «что ещё внутри» и как начать.

Только проверенные факты продукта: src/content/preset-lists.ts (26 слов),
src/engine/word-lists.ts (размеры тренировки 4/6/8/12/весь список),
docs/RELEASE-0.59.0.md (список одной кнопкой), 0.62.0 (три режима и отчёт),
0.63.0 (история и трудные слова), README.md (257 слов и 49 уроков, 1–4 класс).
Картинки слов — настоящие, из public/words/. Сова БУК — рендер того же
<Mascot>, что в приложении (scripts/promo/make_mascot.mjs), если файлы есть.

Запуск:
    python3 -m venv /tmp/promo && /tmp/promo/bin/pip install pillow segno
    /tmp/promo/bin/python scripts/promo/make_release_slides.py

Шрифт — Nunito из scripts/promo/fonts (SIL OFL, латиница + кириллица);
если папки нет, берётся системный DejaVu Sans: вёрстка та же, вид проще.
Стрелки и галочки рисуются линиями: в Nunito нет этих символов.
"""
import argparse
import os
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------- палитра (src/styles/tokens.css)
BG = (255, 248, 236)        # --bg
CARD = (255, 255, 255)      # --card
INK = (36, 31, 54)          # --ink
INK2 = (107, 100, 128)      # --ink-2
# --ink-3 из tokens.css на тёплом фоне даёт 3,2:1 — для слайда на телефоне
# мелко и бледно, поэтому подписи взяты на ступень темнее (4,5:1 на --bg).
INK3 = (118, 112, 132)
VIOLET = (119, 87, 251)     # --primary
VIOLET_INK = (106, 79, 218)  # --primary-ink
V_SOFT = (236, 231, 255)    # --primary-soft
ORANGE = (255, 159, 10)     # --orange
O_SOFT = (255, 237, 213)    # --orange-soft
O_INK = (145, 91, 6)        # --orange-ink
GREEN = (34, 197, 94)       # --green
G_SOFT = (220, 252, 231)    # --green-soft
G_INK = (21, 122, 58)       # --good-ink
RED = (244, 63, 94)         # --red
R_SOFT = (255, 228, 230)    # --red-soft
R_INK = (185, 48, 71)       # --bad-ink
LINE = (239, 233, 221)      # --line
PLATE = (251, 238, 218)     # фон картинок слов
GLOW_A = (255, 233, 199)
GLOW_B = (230, 224, 255)

URL = "https://artignat2000.github.io/slovo2/"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORDS_DIR = os.path.join(ROOT, "public", "words")
OUT_DEFAULT = os.path.join(ROOT, "docs", "promo", "2026-10-26")

S = 2                        # рисуем в 2×, в конце уменьшаем LANCZOS
W, H = 1080, 1350
PAD = 72
BOTTOM = H - 92              # линия подвала

# ---------------------------------------------------------------- шрифты
# Nunito (SIL OFL) лежит в scripts/promo/fonts/ — уже урезанный до латиницы,
# кириллицы и типографских знаков (по ~50 КБ на начертание). Так слайды
# собираются на чистой машине без npm и без сети; PROMO_FONT_DIR перекрывает путь.
WEIGHTS = {400: "400Regular", 600: "600SemiBold", 700: "700Bold", 800: "800ExtraBold", 900: "900Black"}
FONT_CANDIDATES = [
    os.environ.get("PROMO_FONT_DIR", ""),
    os.path.join(ROOT, "scripts", "promo", "fonts"),
]
DEJAVU = {
    400: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    600: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    700: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    800: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    900: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
}


def font_path(weight):
    for base in FONT_CANDIDATES:
        if not base:
            continue
        for name in (f"Nunito-{WEIGHTS[weight]}.ttf", f"{WEIGHTS[weight]}/Nunito_{WEIGHTS[weight]}.ttf"):
            p = os.path.join(base, name)
            if os.path.exists(p):
                return p
    return DEJAVU[weight]


_fc = {}


def F(size, weight=400):
    key = (size, weight)
    if key not in _fc:
        _fc[key] = ImageFont.truetype(font_path(weight), px(size))
    return _fc[key]


def px(v):
    return int(round(v * S))


def tw(font, text):
    return font.getlength(text)


# ---------------------------------------------------------------- примитивы
def new_canvas():
    img = Image.new("RGB", (px(W), px(H)), BG)
    layer = Image.new("RGBA", (px(W), px(H)), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    dl.ellipse([px(W * 0.50), px(-H * 0.24), px(W * 1.28), px(H * 0.36)], fill=GLOW_A + (135,))
    dl.ellipse([px(-W * 0.28), px(H * 0.60), px(W * 0.52), px(H * 1.24)], fill=GLOW_B + (170,))
    dl.ellipse([px(W * 0.62), px(H * 0.82), px(W * 1.1), px(H * 1.14)], fill=GLOW_A + (85,))
    layer = layer.filter(ImageFilter.GaussianBlur(px(74)))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    return img, ImageDraw.Draw(img)


def shadow(img, box, r, blur=9, dy=10, alpha=26):
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.rounded_rectangle([px(box[0] + 2), px(box[1] + dy), px(box[2] + 2), px(box[3] + dy)],
                         radius=px(r), fill=(36, 31, 54, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(px(blur)))
    img.paste(sh, (0, 0), sh)


def card(img, d, x, y, w, h, r=26, fill=CARD, outline=LINE, with_shadow=True):
    if with_shadow:
        shadow(img, (x, y, x + w, y + h), r)
    d.rounded_rectangle([px(x), px(y), px(x + w), px(y + h)], radius=px(r), fill=fill,
                        outline=outline, width=max(1, px(1.4)))


def chip(d, x, y, text, font, fg=VIOLET_INK, bg=V_SOFT, padx=20, pady=11):
    w = tw(font, text) / S + padx * 2
    h = font.size / S + pady * 2
    d.rounded_rectangle([px(x), px(y), px(x + w), px(y + h)], radius=px(h / 2), fill=bg)
    d.text((px(x + padx), px(y + pady - font.size / S * 0.12)), text, font=font, fill=fg)
    return w


def flow(d, x, y, maxw, runs, lh):
    """Перенос строк из кусочков разного стиля. Возвращает y после последней строки."""
    right = px(x + maxw)
    cx, cy = px(x), px(y)
    for text, font, color in runs:
        for word in text.split(" "):
            if word == "":
                continue
            if cx + tw(font, word) > right and cx > px(x):
                cx, cy = px(x), cy + px(lh)
            d.text((cx, cy), word, font=font, fill=color)
            cx += tw(font, word + " ")
    return cy / S + lh


def ctext(d, cx, y, text, font, fill):
    d.text((px(cx - tw(font, text) / S / 2), px(y)), text, font=font, fill=fill)


def header(d, num, kicker, title, sub=None, title_size=58, kicker_bg=V_SOFT, kicker_fg=VIOLET_INK):
    chip(d, PAD, 74, kicker, F(22, 700), fg=kicker_fg, bg=kicker_bg)
    fn = F(21, 600)
    d.text((px(W - PAD - tw(fn, num) / S), px(86)), num, font=fn, fill=INK3)
    y = 152
    d.text((px(PAD), px(y)), title, font=F(title_size, 800), fill=INK)
    y += title_size * 1.26
    if sub:
        y = flow(d, PAD, y, W - 2 * PAD, [(sub, F(26, 400), INK2)], lh=36) + 6
    return y


def footer(d, note):
    d.line([px(PAD), px(BOTTOM), px(W - PAD), px(BOTTOM)], fill=LINE, width=px(1.5))
    f = F(20, 600)
    d.text((px(PAD), px(BOTTOM + 20)), "artignat2000.github.io/slovo2", font=f, fill=INK3)
    d.text((px(W - PAD - tw(f, note) / S), px(BOTTOM + 20)), note, font=f, fill=INK3)


def center_icon_tile(d, x, y, size, bg, glyph):
    d.rounded_rectangle([px(x), px(y), px(x + size), px(y + size)], radius=px(size * 0.28), fill=bg)
    glyph(d, x + size / 2, y + size / 2, size * 0.5)


# ---------------------------------------------------------------- стрелки, галочки (нет в шрифте)
def arrow_right(d, x, y, length, color, weight=4):
    d.line([px(x), px(y), px(x + length), px(y)], fill=color, width=px(weight))
    d.line([px(x + length - 7), px(y - 6), px(x + length), px(y)], fill=color, width=px(weight))
    d.line([px(x + length - 7), px(y + 6), px(x + length), px(y)], fill=color, width=px(weight))


def check_mark(d, cx, cy, s, color, weight=None):
    weight = s * 0.24 if weight is None else weight
    d.line([px(cx - s * 0.42), px(cy + 0.02 * s), px(cx - s * 0.10), px(cy + s * 0.36)],
           fill=color, width=px(weight))
    d.line([px(cx - s * 0.10), px(cy + s * 0.36), px(cx + s * 0.46), px(cy - s * 0.34)],
           fill=color, width=px(weight))


def cross_mark(d, cx, cy, s, color, weight=None):
    weight = s * 0.24 if weight is None else weight
    d.line([px(cx - s * 0.34), px(cy - s * 0.34), px(cx + s * 0.34), px(cy + s * 0.34)],
           fill=color, width=px(weight))
    d.line([px(cx + s * 0.34), px(cy - s * 0.34), px(cx - s * 0.34), px(cy + s * 0.34)],
           fill=color, width=px(weight))


def trend_up(d, cx, cy, s, color):
    d.line([px(cx - s * 0.46), px(cy + s * 0.30), px(cx + s * 0.46), px(cy - s * 0.30)],
           fill=color, width=px(s * 0.17))
    d.line([px(cx + s * 0.14), px(cy - s * 0.32), px(cx + s * 0.46), px(cy - s * 0.30)],
           fill=color, width=px(s * 0.17))
    d.line([px(cx + s * 0.46), px(cy - s * 0.30), px(cx + s * 0.42), px(cy + s * 0.06)],
           fill=color, width=px(s * 0.17))


def slash(d, cx, cy, length, color, halo=None, weight=None):
    """Косая черта «нет»: цветная, с зазором цвета плитки — знак остаётся читаемым."""
    weight = length * 0.10 if weight is None else weight
    x0, x1 = cx - length / 2, cx + length / 2
    y0, y1 = cy + length / 2, cy - length / 2
    if halo:
        d.line([px(x0), px(y0), px(x1), px(y1)], fill=halo, width=px(weight * 2.4))
    d.line([px(x0), px(y0), px(x1), px(y1)], fill=color, width=px(weight))


# ---------------------------------------------------------------- глифы
def g_target(d, cx, cy, s, color=VIOLET):
    for rr in (s * 0.62, s * 0.30):
        d.ellipse([px(cx - rr), px(cy - rr), px(cx + rr), px(cy + rr)],
                  outline=color, width=px(s * 0.15))
    d.ellipse([px(cx - s * 0.10), px(cy - s * 0.10), px(cx + s * 0.10), px(cy + s * 0.10)], fill=color)


def g_checklist(d, cx, cy, s, color=ORANGE):
    x0, y0, x1, y1 = cx - s * 0.46, cy - s * 0.56, cx + s * 0.46, cy + s * 0.60
    d.rounded_rectangle([px(x0), px(y0), px(x1), px(y1)], radius=px(s * 0.14),
                        outline=color, width=px(s * 0.13))
    d.line([px(cx - s * 0.16), px(y0 - s * 0.03), px(cx + s * 0.16), px(y0 - s * 0.03)],
           fill=color, width=px(s * 0.15))
    for yy in (-0.24, 0.04, 0.32):
        check_mark(d, cx - s * 0.18, cy + s * yy, s * 0.30, color, weight=s * 0.11)
        d.line([px(cx + s * 0.06), px(cy + s * (yy - 0.04)), px(cx + s * 0.30), px(cy + s * (yy - 0.04))],
               fill=color, width=px(s * 0.09))


def g_redo(d, cx, cy, s, color=GREEN):
    r = s * 0.50
    d.arc([px(cx - r), px(cy - r), px(cx + r), px(cy + r)], start=40, end=320,
          fill=color, width=px(s * 0.16))
    d.polygon([(px(cx + r * 0.62), px(cy - r * 0.95)), (px(cx + r * 1.22), px(cy - r * 0.55)),
               (px(cx + r * 0.55), px(cy - r * 0.18))], fill=color)


def g_book(d, cx, cy, s, color=VIOLET):
    w, h = s * 0.82, s * 0.94
    d.rounded_rectangle([px(cx - w), px(cy - h), px(cx + w), px(cy + h)], radius=px(s * 0.14),
                        outline=color, width=px(s * 0.13))
    d.line([px(cx), px(cy - h * 0.94), px(cx), px(cy + h * 0.94)], fill=color, width=px(s * 0.11))
    for yy in (-0.52, -0.18, 0.16):
        d.line([px(cx - w * 0.72), px(cy + h * yy), px(cx - w * 0.22), px(cy + h * yy)],
               fill=color, width=px(s * 0.08))
        d.line([px(cx + w * 0.22), px(cy + h * yy), px(cx + w * 0.72), px(cy + h * yy)],
               fill=color, width=px(s * 0.08))


def g_offline(d, cx, cy, s, color=VIOLET):
    """Телефон с галочкой: приложение уже на телефоне и работает без сети."""
    w, h = s * 0.62, s * 1.00
    d.rounded_rectangle([px(cx - w), px(cy - h / 2), px(cx + w), px(cy + h / 2)],
                        radius=px(s * 0.17), outline=color, width=px(s * 0.12))
    check_mark(d, cx, cy + s * 0.03, s * 0.58, color, weight=s * 0.125)


def g_heart(d, cx, cy, s, color=GREEN):
    """Сердце: «ошибка ничего не отнимает» — знак заботы, а не «жизни кончились»."""
    import math
    pts = []
    for i in range(120):
        t = 2 * math.pi * i / 120
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 34.0, cy - y * s / 32.0 - s * 0.05))
    d.polygon([(px(a), px(b)) for a, b in pts], fill=color)


def g_shield(d, cx, cy, s, color=ORANGE):
    """Щит с галочкой: «здесь ничего не продают и не показывают рекламу»."""
    top = cy - s * 0.56
    d.polygon([(px(cx - s * 0.46), px(top)), (px(cx + s * 0.46), px(top)),
               (px(cx + s * 0.46), px(top + s * 0.48)), (px(cx), px(cy + s * 0.62)),
               (px(cx - s * 0.46), px(top + s * 0.48))], fill=color)
    check_mark(d, cx, cy + s * 0.02, s * 0.52, (255, 255, 255), weight=s * 0.11)


def g_clock_off(d, cx, cy, s, color=GREEN, halo=G_SOFT):
    """Песочные часы с косой чертой — таймеров и жизней нет."""
    top, bot = cy - s * 0.50, cy + s * 0.50
    d.line([px(cx - s * 0.30), px(top), px(cx + s * 0.30), px(top)], fill=color, width=px(s * 0.12))
    d.line([px(cx - s * 0.30), px(bot), px(cx + s * 0.30), px(bot)], fill=color, width=px(s * 0.12))
    d.polygon([(px(cx - s * 0.26), px(top + s * 0.08)), (px(cx + s * 0.26), px(top + s * 0.08)),
               (px(cx), px(cy - s * 0.02))], fill=color)
    d.polygon([(px(cx - s * 0.26), px(bot - s * 0.08)), (px(cx + s * 0.26), px(bot - s * 0.08)),
               (px(cx), px(cy + s * 0.10))], fill=color)
    slash(d, cx, cy, s * 1.24, color, halo=halo, weight=s * 0.105)


def g_profile(d, cx, cy, s, color=VIOLET):
    r = s * 0.24
    d.ellipse([px(cx - r), px(cy - s * 0.52), px(cx + r), px(cy - s * 0.52 + 2 * r)], fill=color)
    d.pieslice([px(cx - s * 0.46), px(cy - s * 0.02), px(cx + s * 0.46), px(cy + s * 0.92)],
               180, 360, fill=color)


def g_star(d, cx, cy, s, color=ORANGE):
    import math
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        r = s * (0.56 if i % 2 == 0 else 0.24)
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    d.polygon([(px(a), px(b)) for a, b in pts], fill=color)


# ---------------------------------------------------------------- картинка слова
def word_art(img, name, x, y, size, radius=None, plate=PLATE):
    """Настоящая картинка слова на «плите» — как в приложении."""
    radius = size * 0.2 if radius is None else radius
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([px(x), px(y), px(x + size), px(y + size)], radius=px(radius), fill=plate)
    path = os.path.join(WORDS_DIR, f"{name}.webp")
    if not os.path.exists(path):
        return
    pic = Image.open(path).convert("RGB").resize((px(size), px(size)), Image.LANCZOS)
    mask = Image.new("L", pic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pic.size[0] - 1, pic.size[1] - 1],
                                           radius=px(radius), fill=255)
    img.paste(pic, (px(x), px(y)), mask)


def mascot(img, out_dir, name, cx, cy, height):
    """Сова БУК из приложения (PNG от scripts/promo/make_mascot.mjs); нет файла — молча пропускаем."""
    path = os.path.join(out_dir, "assets", f"{name}.png")
    if not os.path.exists(path):
        return False
    pic = Image.open(path).convert("RGBA")
    k = px(height) / pic.height
    pic = pic.resize((max(1, int(pic.width * k)), px(height)), Image.LANCZOS)
    img.paste(pic, (int(px(cx) - pic.width / 2), int(px(cy) - pic.height / 2)), pic)
    return True


# ---------------------------------------------------------------- QR
def paste_qr(img, x, y, size):
    try:
        import segno
    except ImportError:
        return False
    qr = segno.make(URL, error="m")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        name = tf.name
    qr.save(name, scale=16, border=0)
    q = Image.open(name).convert("RGB")
    os.unlink(name)
    q = q.resize((px(size), px(size)), Image.NEAREST)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([px(x - 10), px(y - 10), px(x + size + 10), px(y + size + 10)],
                        radius=px(14), fill=CARD)
    img.paste(q, (px(x), px(y)))
    return True


# ---------------------------------------------------------------- слайд 1 · обложка
def slide1(img, d, out_dir):
    chip(d, PAD, 74, "2 КЛАСС · К КОНТРОЛЬНОЙ", F(22, 700))
    fn = F(21, 600)
    d.text((px(W - PAD - tw(fn, "1 / 5") / S), px(86)), "1 / 5", font=fn, fill=INK3)

    d.text((px(PAD), px(146)), "СЛОВО", font=F(100, 900), fill=VIOLET)
    d.text((px(PAD + tw(F(100, 900), "СЛОВО") / S + 14), px(146)), "2.0", font=F(100, 900), fill=INK)

    d.text((px(PAD - 4), px(292)), "26", font=F(150, 900), fill=VIOLET)
    ind = PAD + tw(F(150, 900), "26") / S + 18
    d.text((px(ind), px(330)), "слов к контрольной", font=F(37, 800), fill=INK)
    d.text((px(ind), px(382)), "из словаря Коли — внутри", font=F(34, 800), fill=VIOLET_INK)

    y = 500
    flow(d, PAD, y, W - 2 * PAD,
         [("Тот самый список из бумажного словаря Коли. Тренировка частями, полный "
           "контроль и работа над ошибками. На телефоне, даже без интернета.",
           F(25, 400), INK2)], lh=35)

    # три настоящие карточки слов
    cards = [("yabloko", "яблоко"), ("bereza", "берёза"), ("vorona", "ворона")]
    cw, ch, art = 264, 336, 188
    xs = [PAD + 8, PAD + 306, PAD + 604]
    ys = [636, 604, 636]
    angles = [-5.0, 0.0, 5.0]
    for (name, label), x, yy, ang in zip(cards, xs, ys, angles):
        layer = Image.new("RGBA", (px(cw + 48), px(ch + 48)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([px(24), px(32), px(24 + cw), px(32 + ch)],
                                             radius=px(28), fill=(36, 31, 54, 30))
        sh = sh.filter(ImageFilter.GaussianBlur(px(9)))
        layer.paste(sh, (0, 0), sh)
        ld.rounded_rectangle([px(24), px(24), px(24 + cw), px(24 + ch)], radius=px(28),
                             fill=CARD, outline=LINE, width=px(1.4))
        tmp = Image.new("RGB", (px(art), px(art)), PLATE)
        word_art(tmp, name, 0, 0, art, radius=art * 0.18)
        layer.paste(tmp, (px(24 + (cw - art) / 2), px(24 + 20)))
        f = F(30, 800)
        ld.text((px(24 + cw / 2 - tw(f, label) / S / 2), px(24 + 20 + art + 26)), label, font=f, fill=INK)
        layer = layer.rotate(ang, resample=Image.BICUBIC, expand=False)
        img.paste(layer, (px(x - 24), px(yy - 24)), layer)

    # строка доверия
    yb = 1006
    card(img, d, PAD, yb, W - 2 * PAD, 126, r=24)
    facts = ["Без рекламы", "Без жизней и таймеров", "Работает офлайн"]
    fx = PAD + 24
    for t in facts:
        f = F(21, 700)
        d.ellipse([px(fx), px(yb + 26), px(fx + 24), px(yb + 50)], fill=G_SOFT)
        check_mark(d, fx + 12, yb + 38, 13, GREEN, weight=3.2)
        d.text((px(fx + 34), px(yb + 27)), t, font=f, fill=INK)
        fx += tw(f, t) / S + 34 + 42
    d.text((px(PAD + 24), px(yb + 74)),
           "Бесплатно · Android и iPhone · ставится на экран, как приложение",
           font=F(22, 400), fill=INK2)

    # ссылка
    yl = 1176
    f = F(31, 800)
    label = "artignat2000.github.io/slovo2/"
    d.text((px(PAD), px(yl)), label, font=f, fill=VIOLET_INK)
    d.line([px(PAD), px(yl + 46), px(PAD + tw(f, label) / S), px(yl + 46)],
           fill=(199, 188, 255), width=px(2))
    d.text((px(PAD), px(yl + 62)), "Открывается в браузере — без установки из магазина",
           font=F(20, 400), fill=INK3)


# ---------------------------------------------------------------- слайд 2 · 26 слов
SCHOOL_WORDS = [
    "хорошо", "ученик", "ученица", "учитель", "петух", "заяц", "воробей", "ворона",
    "весело", "спасибо", "прощай", "прощайте", "город", "Родина", "ветер", "скоро",
    "быстро", "подлежащее", "сказуемое", "яблоко", "яблоня", "берёза", "лопата",
    "ягода", "осина", "до свидания",
]
NEW_WORDS = {"прощайте", "подлежащее", "сказуемое"}


def slide2(img, d, out_dir):
    y = header(d, "2 / 5", "СПИСОК ИЗ КЛАССА", "26 слов — в один тап",
               "Готовый список уже внутри: вставлять текст руками не нужно.")

    cy = y + 4
    card(img, d, PAD, cy, W - 2 * PAD, 584, r=30)
    chip(d, PAD + 26, cy + 22, "Контрольная: слова из школы", F(20, 700), padx=16, pady=9)
    fmeta = F(20, 600)
    d.text((px(W - PAD - 30 - tw(fmeta, "26 слов") / S), px(cy + 32)), "26 слов", font=fmeta, fill=INK3)

    colw = (W - 2 * PAD - 52 - 2 * 12) / 3
    gx, gy = PAD + 26, cy + 80
    rowh = 48
    for i, word in enumerate(SCHOOL_WORDS):
        col, row = i % 3, i // 3
        x = gx + col * (colw + 12)
        yy = gy + row * (rowh + 6)
        new = word in NEW_WORDS
        d.rounded_rectangle([px(x), px(yy), px(x + colw), px(yy + rowh)], radius=px(13),
                            fill=O_SOFT if new else (255, 252, 246),
                            outline=(247, 224, 190) if new else (243, 237, 225), width=px(1.2))
        f = F(22, 800 if new else 600)
        d.text((px(x + 14), px(yy + 10)), word, font=f, fill=O_INK if new else INK)

    ny = cy + 584 + 20
    flow(d, PAD + 2, ny, W - 2 * PAD - 4,
         [("Оранжевым — ", F(23, 600), INK3), ("«прощайте», «подлежащее», «сказуемое»", F(23, 800), O_INK),
          (": их не было в банке слов, а в диктанте они будут. Добавили специально.", F(23, 400), INK3)],
         lh=31)

    py = ny + 74
    card(img, d, PAD, py, W - 2 * PAD, 112, r=22)
    d.rounded_rectangle([px(PAD + 22), px(py + 28), px(PAD + 72), px(py + 78)], radius=px(13), fill=V_SOFT)
    g_book(d, PAD + 47, py + 53, 23, color=VIOLET)
    fx = PAD + 92
    f1 = F(23, 600)
    d.text((px(fx), px(py + 24)), "Родителям", font=f1, fill=INK2)
    fx += tw(f1, "Родителям") / S + 10
    arrow_right(d, fx, py + 38, 18, INK3, weight=2.6)
    fx += 30
    d.text((px(fx), px(py + 24)), "Списки", font=f1, fill=INK2)
    fx += tw(f1, "Списки") / S + 10
    arrow_right(d, fx, py + 38, 18, INK3, weight=2.6)
    fx += 30
    d.text((px(fx), px(py + 24)), "Добавить: список из класса · 26 слов", font=F(23, 800), fill=VIOLET_INK)
    d.text((px(PAD + 92), px(py + 62)), "Одно нажатие — и список уже у ребёнка на «Уроках»",
           font=F(21, 400), fill=INK3)

    iy = py + 142
    word_art(img, "yabloko", PAD, iy, 86)
    word_art(img, "vorona", PAD + 98, iy, 86)
    word_art(img, "lopata", PAD + 196, iy, 86)
    flow(d, PAD + 306, iy + 8, W - PAD - 306 - PAD,
         [("У каждого слова — картинка, подсказка и «опасная» буква. ", F(22, 700), INK),
          ("Слово запоминается вместе с образом, а не с набором букв.", F(22, 400), INK2)], lh=30)

    footer(d, "дальше: три режима")


# ---------------------------------------------------------------- слайд 3 · три режима
def mode_card(img, d, y, h, icon, bg, title, text, meta, meta_color):
    card(img, d, PAD, y, W - 2 * PAD, h, r=26)
    center_icon_tile(d, PAD + 28, y + 24, 70, bg, icon)
    d.text((px(PAD + 120), px(y + 24)), title, font=F(30, 800), fill=INK)
    flow(d, PAD + 120, y + 70, W - 2 * PAD - 146, [(text, F(23, 400), INK2)], lh=31)
    d.text((px(PAD + 120), px(y + h - 38)), meta, font=F(21, 700), fill=meta_color)
    return y + h + 16


def slide3(img, d, out_dir):
    y = header(d, "3 / 5", "ТРИ РЕЖИМА", "Тренировка, контроль, ошибки",
               "Один и тот же список — три разные задачи.")

    y = mode_card(img, d, y + 8, 206, lambda dd, cx, cy, s: g_target(dd, cx, cy, s, VIOLET),
                  V_SOFT, "Тренировка",
                  "4, 6, 8 или 12 слов — или весь список сразу. С подсказками и отработкой ошибок.",
                  "Когда до контрольной ещё есть дни", VIOLET_INK)
    y = mode_card(img, d, y, 206, lambda dd, cx, cy, s: g_checklist(dd, cx, cy, s, ORANGE),
                  O_SOFT, "Полный контроль",
                  "Все 26 слов по порядку, как в списке из класса. Без подсказок — как настоящая работа.",
                  "Проверить, готов ли ребёнок", O_INK)
    y = mode_card(img, d, y, 206, lambda dd, cx, cy, s: g_redo(dd, cx, cy, s, GREEN),
                  G_SOFT, "Ошибки",
                  "Только слова, которые не получились в прошлый раз. Они видны в отчёте.",
                  "Подтянуть слабые места за вечер", G_INK)

    # план на вечер
    py = y + 6
    card(img, d, PAD, py, W - 2 * PAD, 268, r=26, fill=(255, 252, 246))
    d.text((px(PAD + 26), px(py + 22)), "Как это выглядит на деле", font=F(25, 800), fill=INK)
    steps = [("1", "Тренировка", "8 слов · 5 минут"), ("2", "Ошибки", "по 2–3 слова · 2 минуты"),
             ("3", "Полный контроль", "все 26 · 6 минут")]
    colw = (W - 2 * PAD - 52) / 3
    for i, (n, t1, t2) in enumerate(steps):
        sx = PAD + 26 + i * colw
        d.ellipse([px(sx), px(py + 64), px(sx + 32), px(py + 96)], fill=V_SOFT)
        d.text((px(sx + 16 - tw(F(20, 800), n) / S / 2), px(py + 69)), n, font=F(20, 800), fill=VIOLET_INK)
        d.text((px(sx), px(py + 108)), t1, font=F(21, 700), fill=INK)
        d.text((px(sx), px(py + 138)), t2, font=F(18, 400), fill=INK3)
    d.line([px(PAD + 26), px(py + 176), px(W - PAD - 26), px(py + 176)], fill=LINE, width=px(1.3))
    d.text((px(PAD + 26), px(py + 192)), "Итого около 15 минут — и ребёнок спокоен, что уже видел все слова.",
           font=F(20, 400), fill=INK3)
    d.text((px(PAD + 26), px(py + 222)), "Вечер занятой? Хватит короткой тренировки на 4 слова — без чувства вины.",
           font=F(20, 400), fill=INK3)

    footer(d, "дальше: результат")


# ---------------------------------------------------------------- слайд 4 · результат
def slide4(img, d, out_dir):
    y = header(d, "4 / 5", "РЕЗУЛЬТАТ", "Видно, что получается",
               "После захода — отчёт по словам, история и трудные слова.")

    cy = y + 8
    card(img, d, PAD, cy, W - 2 * PAD, 324, r=26)
    d.text((px(PAD + 26), px(cy + 20)), "Пример отчёта · контрольная 24 октября",
           font=F(20, 600), fill=INK3)
    d.text((px(PAD + 26), px(cy + 52)), "21 из 26", font=F(50, 900), fill=INK)
    d.text((px(PAD + 26 + tw(F(50, 900), "21 из 26") / S + 12), px(cy + 78)), "верно",
           font=F(23, 600), fill=INK3)
    d.text((px(PAD + 26), px(cy + 116)), "Слово за словом: зелёное — верно, красное — ещё раз.",
           font=F(20, 400), fill=INK3)

    marks = [("хорошо", 1), ("ученик", 1), ("петух", 0), ("ворона", 1), ("спасибо", 1),
             ("прощайте", 0), ("Родина", 1), ("яблоко", 1), ("осина", 1), ("подлежащее", 0),
             ("быстро", 1), ("берёза", 1)]
    fx, fy = PAD + 26, cy + 156
    for word, ok in marks:
        f = F(21, 700)
        w = tw(f, word) / S + 52
        if fx + w > W - PAD - 26:
            fx = PAD + 26
            fy += 48
        d.rounded_rectangle([px(fx), px(fy), px(fx + w), px(fy + 38)], radius=px(19),
                            fill=G_SOFT if ok else R_SOFT)
        if ok:
            check_mark(d, fx + 19, fy + 19, 20, G_INK, weight=3.4)
        else:
            cross_mark(d, fx + 19, fy + 19, 20, R_INK, weight=3.4)
        d.text((px(fx + 34), px(fy + 7)), word, font=f, fill=G_INK if ok else R_INK)
        fx += w + 8
    d.text((px(PAD + 26), px(cy + 268)), "Отчёт остаётся в списке — и родителю видно его в разделе «Списки».",
           font=F(20, 400), fill=INK3)

    # история заходов
    hy = cy + 348
    card(img, d, PAD, hy, W - 2 * PAD, 250, r=26)
    d.text((px(PAD + 26), px(hy + 20)), "История заходов", font=F(24, 800), fill=INK)
    lg = W - PAD - 26
    d.rounded_rectangle([px(lg - 196), px(hy + 20), px(lg), px(hy + 54)], radius=px(17), fill=G_SOFT)
    trend_up(d, lg - 178, hy + 37, 15, G_INK)
    d.text((px(lg - 160), px(hy + 25)), "лучше на 12 п.п.", font=F(19, 700), fill=G_INK)

    bars = [(0.42, "t"), (0.55, "t"), (0.69, "c"), (0.78, "t"), (0.88, "c")]
    bx0, base = PAD + 44, hy + 204
    bw, gap = 66, 40
    d.line([px(bx0 - 10), px(base), px(W - PAD - 40), px(base)], fill=LINE, width=px(1.6))
    for i, (ratio, kind) in enumerate(bars):
        x = bx0 + i * (bw + gap)
        hh = ratio * 112
        color = ORANGE if kind == "c" else VIOLET
        d.rounded_rectangle([px(x), px(base - hh), px(x + bw), px(base)], radius=px(12), fill=color)
    # легенда под полосками
    lx = bx0
    d.rounded_rectangle([px(lx), px(base + 10), px(lx + 14), px(base + 24)], radius=px(4), fill=VIOLET)
    d.text((px(lx + 22), px(base + 8)), "тренировка", font=F(18, 600), fill=INK3)
    lx += tw(F(18, 600), "тренировка") / S + 48
    d.rounded_rectangle([px(lx), px(base + 10), px(lx + 14), px(base + 24)], radius=px(4), fill=ORANGE)
    d.text((px(lx + 22), px(base + 8)), "контроль", font=F(18, 600), fill=INK3)

    # трудные слова
    ty = hy + 272
    flow(d, PAD + 2, ty, W - 2 * PAD,
         [("Трудные слова: ", F(23, 800), INK),
          ("петух · прощайте · подлежащее", F(23, 800), R_INK),
          (" — и кнопка «Тренировать трудные · 3». Не нужно листать весь список, чтобы понять, что подтянуть.",
           F(23, 400), INK3)], lh=31)

    # мягкая подсказка родителю
    py = ty + 104
    mascot(img, out_dir, "buk-happy", W - PAD - 64, py + 74, 150)
    card(img, d, PAD, py, W - 2 * PAD - 128, 152, r=24, fill=(255, 252, 246))
    d.text((px(PAD + 26), px(py + 20)), "Совет: сначала тренировка, потом контроль",
           font=F(22, 800), fill=INK)
    flow(d, PAD + 26, py + 58, W - 2 * PAD - 186,
         [("Если сразу открыть «Полный контроль», тройка ошибок напугает. Короткая тренировка "
           "собирает уверенность — и контрольная проходит спокойнее.", F(20, 400), INK2)], lh=27)

    footer(d, "дальше: как начать")


# ---------------------------------------------------------------- слайд 5 · что ещё
def fact_tile(img, d, x, y, w, h, big, small):
    card(img, d, x, y, w, h, r=22)
    d.text((px(x + 18), px(y + 16)), big, font=F(38, 900), fill=VIOLET_INK)
    d.text((px(x + 18), px(y + 68)), small, font=F(19, 600), fill=INK2)


def bullet_row(d, x, y, w, icon, bg, title, text):
    center_icon_tile(d, x, y, 54, bg, icon)
    d.text((px(x + 70), px(y - 1)), title, font=F(23, 800), fill=INK)
    flow(d, x + 70, y + 32, w - 70, [(text, F(20, 400), INK2)], lh=27)
    return y + 86


def slide5(img, d, out_dir):
    y = header(d, "5 / 5", "ЧТО ЕЩЁ ВНУТРИ", "Не только 2 класс",
               "Словарные слова 1–4 класса: 49 уроков по темам, 257 карточек.")

    tiles = [("30", "1 класс · 5 уроков"), ("94", "2 класс · 16 уроков"),
             ("72", "3 класс · 13 уроков"), ("94", "4 класс · 15 уроков")]
    tw_ = (W - 2 * PAD - 3 * 12) / 4
    ty = y + 2
    for i, (big, small) in enumerate(tiles):
        fact_tile(img, d, PAD + i * (tw_ + 12), ty, tw_, 116, big, small)

    d.text((px(PAD + 4), px(ty + 126)),
           "Слова, которые есть в словариках двух классов, — одна карточка с общим прогрессом.",
           font=F(18, 400), fill=INK3)

    by = ty + 178
    by = bullet_row(d, PAD, by, W - 2 * PAD, lambda dd, cx, cy, s: g_offline(dd, cx, cy, s, VIOLET),
                    V_SOFT, "Без интернета",
                    "Открыли один раз — и занимаетесь в машине, в метро, на даче.")
    by = bullet_row(d, PAD, by, W - 2 * PAD, lambda dd, cx, cy, s: g_shield(dd, cx, cy, s, ORANGE),
                    O_SOFT, "Без рекламы и без платежей",
                    "Кристаллы ребёнок зарабатывает в игре — денег приложение не просит.")
    by = bullet_row(d, PAD, by, W - 2 * PAD, lambda dd, cx, cy, s: g_heart(dd, cx, cy, s, GREEN),
                    G_SOFT, "Ошибка ничего не отнимает",
                    "Ни жизней, ни таймеров: ошибся — просто попробуй ещё раз.")
    by = bullet_row(d, PAD, by, W - 2 * PAD, lambda dd, cx, cy, s: g_profile(dd, cx, cy, s, VIOLET),
                    V_SOFT, "Свой прогресс у каждого ребёнка",
                    "Профили детей; данные остаются в телефоне.")

    # как начать
    cy = by + 8
    card(img, d, PAD, cy, W - 2 * PAD, 252, r=26)
    paste_qr(img, PAD + 24, cy + 22, 172)
    qx = PAD + 222
    d.text((px(qx), px(cy + 20)), "Откройте на телефоне", font=F(27, 800), fill=INK)
    flow(d, qx, cy + 60, W - PAD - qx - 24,
         [("Наведите камеру на QR или наберите адрес. Дальше «Добавить на экран «Домой» — "
           "и приложение открывается с иконки, как обычное.", F(20, 400), INK2)], lh=27)
    f = F(23, 800)
    d.text((px(qx), px(cy + 166)), "artignat2000.github.io/slovo2/", font=f, fill=VIOLET_INK)
    d.text((px(qx), px(cy + 202)), "Бесплатно · Android и iPhone", font=F(20, 400), fill=INK3)

    # автор — спокойно, одной строкой
    ay = cy + 274
    card(img, d, PAD, ay, W - 2 * PAD, 108, r=22, fill=V_SOFT, outline=(219, 211, 255))
    d.text((px(PAD + 26), px(ay + 20)), "Приложение делает Витя — школьник, старший брат Коли.",
           font=F(22, 800), fill=INK)
    d.text((px(PAD + 26), px(ay + 54)), "Список к контрольной — из Колиного бумажного словаря:",
           font=F(20, 400), fill=INK2)
    d.text((px(PAD + 26), px(ay + 78)), "26 слов, которые теперь есть в приложении.",
           font=F(20, 400), fill=INK2)

    footer(d, "СЛОВО 2.0 · октябрь 2026")


# ---------------------------------------------------------------- сборка
BUILDERS = {1: slide1, 2: slide2, 3: slide3, 4: slide4, 5: slide5}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT_DEFAULT)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    pages = []
    for n in sorted(BUILDERS):
        img, d = new_canvas()
        BUILDERS[n](img, d, args.out)
        out = img.resize((W, H), Image.LANCZOS)
        p = os.path.join(args.out, f"slovo2-2.0-slide-{n}.png")
        out.save(p, optimize=True)
        pages.append(out.convert("RGB"))
        print("✓", os.path.relpath(p, ROOT), f"{os.path.getsize(p) // 1024} КБ")
    # PDF — для тех, кто пересылает одним файлом (5 страниц 4:5).
    pdf = os.path.join(args.out, "slovo2-2.0-dlya-roditeley.pdf")
    pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=150)
    print("✓", os.path.relpath(pdf, ROOT), f"{os.path.getsize(pdf) // 1024} КБ")


if __name__ == "__main__":
    main()
