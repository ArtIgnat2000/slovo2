#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Промо-слайды «СЛОВО 2.0» для родительского чата.

Рисует 5 PNG 1080x1350 (формат мессенджеров) в фирменной палитре src/styles/tokens.css
и PDF-подборку. Только проверенные факты продукта (README.md, docs/PLAN.md, content:check):
без обещаний, которых нет в приложении. Иконки и маскот нарисованы кодом (Pillow),
шрифт DejaVu Sans (кириллица есть), QR-код — segno (приложение для родителей с телефона).

Запуск (Pillow + segno, в песочнице — /home/user/.venv-promo):
    /home/user/.venv-promo/bin/python scripts/promo/make_slides.py [--out docs/promo/2026-09-30]
"""
import argparse
import os
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

try:
    import segno
except ImportError:  # без segno QR просто не рисуется
    segno = None

# ---------------------------------------------------------------- палитра (src/styles/tokens.css)
BG      = (255, 248, 236)  # --bg #fff8ec
CARD    = (255, 255, 255)
INK     = (36, 31, 54)     # --ink #241f36
INK2    = (107, 100, 128)  # --ink-2
INK3    = (156, 149, 173)  # --ink-3
VIOLET  = (124, 92, 255)   # --primary
V_SOFT  = (236, 231, 255)  # --primary-soft
ORANGE  = (255, 159, 10)   # --orange
O_SOFT  = (255, 237, 213)  # --orange-soft
AMBER   = (244, 165, 26)   # тело БУКа (Mascot.tsx #f4a51a)
AMBER_D = (232, 144, 26)   # #e8901a
BELLY   = (252, 215, 104)  # #fcd768
GREEN   = (34, 197, 94)    # --green
G_SOFT  = (220, 252, 231)  # --green-soft
PINK    = (255, 111, 181)  # --pink
RED     = (244, 63, 94)    # --red
LINE    = (239, 233, 221)  # --line
TEAL    = (47, 184, 173)   # сундук: бирюза (ChestArt)
TEAL_D  = (32, 158, 149)
GOLD    = (255, 209, 102)  # золотая отделка #ffd166
GLOW_A  = (255, 233, 199)  # --bg-glow-1
GLOW_B  = (230, 224, 255)  # --bg-glow-2

URL  = "https://artignat2000.github.io/slovo2/"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

S = 2                      # рисуем в 2x, в конце уменьшаем с LANCZOS (гладкие края)
W, H = 1080, 1350          # дизайн-размер (4:5 — удобно читать с телефона в чате)


def px(v):
    return int(round(v * S))


_fc = {}
def F(size, bold=False):
    k = (size, bold)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONTB if bold else FONT, px(size))
    return _fc[k]


def tw(font, text):
    return font.getlength(text)


def rr(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([px(box[0]), px(box[1]), px(box[2]), px(box[3])],
                        radius=px(r), fill=fill, outline=outline, width=max(1, px(width)))


def flow(d, x, y, maxw, runs, lh):
    """Мягкий перенос смешанных стилей. runs: [(text, font, color)]; maxw — ширина поля,
    lh — межстрочный в дизайн-px. Возвращает y после последней строки."""
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
    """Текст по центру вокруг x=cx."""
    d.text((px(cx - tw(font, text) / S / 2), px(y)), text, font=font, fill=fill)


def card(d, x, y, w, h, r=24):
    """Белая карточка с мягкой тенью — как --shadow в приложении."""
    sh = Image.new("RGBA", d._image.size, (0, 0, 0, 0))
    ds = ImageDraw.Draw(sh)
    ds.rounded_rectangle([px(x + 3), px(y + 10), px(x + w + 3), px(y + h + 10)],
                         radius=px(r), fill=(36, 31, 54, 26))
    sh = sh.filter(ImageFilter.GaussianBlur(px(7)))
    d._image.paste(sh, (0, 0), sh)
    rr(d, (x, y, x + w, y + h), r, fill=CARD, outline=LINE, width=1.5)


def chip(d, x, y, text, font, fg=VIOLET, bg=V_SOFT, pad=16):
    w = tw(font, text) / S + pad * 2
    h = (font.getmetrics()[0] + font.getmetrics()[1]) / S + 16
    rr(d, (x, y, x + w, y + h), h / 2, fill=bg)
    d.text((px(x + pad), px(y + 8)), text, font=font, fill=fg)
    return w


def diamond(d, cx, cy, r, color, hilite=None):
    pts = [(cx, cy - r), (cx + r * .78, cy), (cx, cy + r), (cx - r * .78, cy)]
    d.polygon([(px(p[0]), px(p[1])) for p in pts], fill=color)
    if hilite:
        d.polygon([(px(cx), px(cy - r * .55)), (px(cx + r * .4), px(cy - r * .1)),
                   (px(cx), px(cy + r * .3)), (px(cx - r * .4), px(cy - r * .1))],
                  fill=hilite)


def key_icon(d, cx, cy, s, color=AMBER):
    d.ellipse([px(cx - s * .45), px(cy - s * .45), px(cx + s * .45), px(cy + s * .45)],
              outline=color, width=px(s * .26))
    d.line([px(cx + s * .35), px(cy + s * .35), px(cx + s * 1.05), px(cy + s * 1.05)],
           fill=color, width=px(s * .26))
    d.line([px(cx + s * .78), px(cy + s * .78), px(cx + s * 1.0), px(cy + s * .56)],
           fill=color, width=px(s * .26))
    d.line([px(cx + s * 1.0), px(cy + s * 1.0), px(cx + s * 1.22), px(cy + s * .78)],
           fill=color, width=px(s * .26))


def owl(d, cx, cy, hgt, cap=False, mood="happy"):
    """БУК — сова в стиле src/ui/Mascot.tsx: крупная голова, круглое тело."""
    w = hgt * 0.92
    hw, hh = w / 2, hgt / 2
    for sgn in (-1, 1):  # хохолок-ушки
        tx = cx + sgn * hw * 0.62
        d.polygon([(px(tx - hgt * .16), px(cy - hh * .62)),
                   (px(tx + sgn * hgt * .12), px(cy - hh * 1.18)),
                   (px(tx + hgt * .16), px(cy - hh * .5))], fill=AMBER_D)
    body_top = cy - hh + hgt * 0.22
    d.ellipse([px(cx - hw), px(cy - hh), px(cx + hw), px(cy + hh)], fill=AMBER)
    d.ellipse([px(cx - hw * .72), px(body_top + hgt * .18),
               px(cx + hw * .72), px(cy + hh * .92)], fill=BELLY)
    for sgn in (-1, 1):  # крылья
        d.ellipse([px(cx + sgn * hw * .86 - w * .10), px(cy - hh * .02),
                   px(cx + sgn * hw * .86 + w * .14), px(cy + hh * .70)], fill=AMBER_D)
    for sgn in (-1, 1):  # лапки
        d.ellipse([px(cx + sgn * w * .2 - w * .11), px(cy + hh * .88),
                   px(cx + sgn * w * .2 + w * .11), px(cy + hh * 1.06)], fill=AMBER_D)
    er = hgt * .155
    ey = cy - hh + hgt * .3
    for sgn in (-1, 1):  # глаза
        ex = cx + sgn * hgt * .175
        d.ellipse([px(ex - er), px(ey - er), px(ex + er), px(ey + er)], fill=(255, 255, 255))
        pr = er * (.5 if mood == "happy" else .55)
        py = ey + (er * .08 if mood == "happy" else 0)
        d.ellipse([px(ex - pr), px(py - pr), px(ex + pr), px(py + pr)], fill=INK)
        d.ellipse([px(ex - pr * .3), px(py - pr * .75), px(ex + pr * .3), px(py - pr * .15)],
                  fill=(255, 255, 255))
    if mood == "happy":  # закрытые верхние половинки — «улыбающиеся» глаза
        for sgn in (-1, 1):
            ex = cx + sgn * hgt * .175
            d.pieslice([px(ex - er), px(ey - er), px(ex + er), px(ey + er)],
                       180, 360, fill=AMBER)
    d.polygon([(px(cx - hgt * .07), px(ey + er * 1.05)),  # клюв
               (px(cx + hgt * .07), px(ey + er * 1.05)),
               (px(cx), px(ey + er * 1.55))], fill=GOLD)
    if cap:  # шапочка магистра (MascotLook.tsx)
        cyC = cy - hh - hgt * .02
        d.polygon([(px(cx), px(cyC - hgt * .16)), (px(cx + w * .52), px(cyC - hgt * .02)),
                   (px(cx), px(cyC + hgt * .1)), (px(cx - w * .52), px(cyC - hgt * .02))],
                  fill=INK)
        d.line([px(cx + w * .38), px(cyC - hgt * .02), px(cx + w * .42), px(cyC + hgt * .13)],
               fill=AMBER, width=max(2, px(hgt * .03)))
        d.ellipse([px(cx + w * .39), px(cyC + hgt * .12),
                   px(cx + w * .49), px(cyC + hgt * .22)], fill=GOLD)


def chest(d, cx, cy, w):
    """Сундук БУКа: бирюзовый корпус, золотая отделка, висячий замок, самоцветы."""
    hh = w * .62
    x0, y0, x1, y1 = cx - w / 2, cy - hh / 2, cx + w / 2, cy + hh / 2
    rr(d, (x0, y0, x1, y1), w * .1, fill=TEAL)
    rr(d, (x0, y0 + hh * .04, x1, y0 + hh * .38), w * .16, fill=TEAL_D)
    d.rectangle([px(x0 + w * .04), px(y0 + hh * .30), px(x1 - w * .04), px(y0 + hh * .42)],
                fill=GOLD)
    d.rectangle([px(cx - w * .05), px(y0 - hh * .02), px(cx + w * .05), px(cy + hh * .1)],
                fill=GOLD)
    d.ellipse([px(cx - w * .085), px(cy + hh * .02), px(cx + w * .085), px(cy + hh * .22)],
              fill=GOLD)
    d.polygon([(px(cx - w * .022), px(cy + hh * .07)), (px(cx + w * .022), px(cy + hh * .07)),
               (px(cx + w * .013), px(cy + hh * .17)), (px(cx - w * .013), px(cy + hh * .17))],
              fill=TEAL_D)
    for gx, col in [(-.3, PINK), (-.12, VIOLET), (.14, GREEN), (.32, ORANGE)]:
        diamond(d, cx + w * gx, y0 - hh * .06, w * .035, col, hilite=(255, 255, 255))


def word_card(d, x, y, w, h, word, stress, danger, syllables, sentence):
    """Мок-ап карточки знакомства: ударение, слоги, «опасные» буквы."""
    card(d, x, y, w, h, r=26)
    fsz = 60
    font = F(fsz, bold=True)
    gap = fsz * 0.34
    widths = [tw(font, ch) / S for ch in word]
    total = sum(widths) + gap * (len(word) - 1)
    cx = x + (w - total) / 2
    ty = y + 30
    for i, ch in enumerate(word):
        cw = widths[i]
        if i in danger:
            rr(d, (cx - 7, ty - 2, cx + cw + 7, ty + fsz * 1.14), 14, fill=O_SOFT)
        d.text((px(cx), px(ty)), ch, font=font, fill=ORANGE if i in danger else INK)
        if i == stress:
            x0 = cx + cw * .52
            d.line([px(x0 - fsz * .13), px(ty + fsz * .22), px(x0 + fsz * .13), px(ty - fsz * .03)],
                   fill=RED, width=px(8))
        cx += cw + gap
    yy = ty + fsz * 1.42
    f2 = F(27)
    d.text((px(x + w / 2 - tw(f2, syllables) / S / 2), px(yy)), syllables, font=f2, fill=INK2)
    yy += 44
    f3 = F(25)
    d.text((px(x + w / 2 - tw(f3, sentence) / S / 2), px(yy)), sentence, font=f3, fill=INK3)
    bx, by, br = x + w - 74, y + 22, 25  # подсказка «?» — как кнопка 💡 в уроке
    d.ellipse([px(bx - br), px(by - br), px(bx + br), px(by + br)], fill=VIOLET)
    fb = F(27, bold=True)
    d.text((px(bx - tw(fb, "?") / S / 2), px(by - 19)), "?", font=fb, fill=(255, 255, 255))


def header(d, num, kicker, title, sub=None, title_size=58):
    pad = 76
    f = F(24, bold=True)
    chip(d, pad, 84, kicker, f)
    fn = F(22)
    d.text((px(W - pad - tw(fn, num) / S), px(90)), num, font=fn, fill=INK3)
    yy = 84 + 72
    d.text((px(pad), px(yy)), title, font=F(title_size, bold=True), fill=INK)
    yy += title_size + 16
    if sub:
        yy = flow(d, pad, yy, W - pad * 2, [(sub, F(28), INK2)], lh=38) + 8
    return yy


def footer(d, note=None):
    d.line([px(76), px(H - 96), px(W - 76), px(H - 96)], fill=LINE, width=px(1.6))
    f = F(21)
    d.text((px(76), px(H - 76)), URL.replace("https://", ""), font=f, fill=INK3)
    if note:
        d.text((px(W - 76 - tw(f, note) / S), px(H - 76)), note, font=f, fill=INK3)


def bullet(d, x, y, w, icon, lead, rest):
    icon(d, x, y)
    runs = [(lead + " ", F(31, bold=True), INK)]
    if rest:
        runs.append((rest, F(29), INK2))
    return flow(d, x + 74, y + 2, w - 74, runs, lh=42) + 26


def icon_check(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=G_SOFT)
    d.line([px(x + 13), px(y + 24), px(x + 23), px(y + 35)], fill=GREEN, width=px(6))
    d.line([px(x + 23), px(y + 35), px(x + 41), px(y + 13)], fill=GREEN, width=px(6))


def icon_diamond(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=V_SOFT)
    diamond(d, x + 26, y + 24, 15, VIOLET, hilite=(255, 255, 255))


def icon_shield(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=O_SOFT)
    cx, top = x + 26, y + 7
    d.polygon([(px(cx - 13), px(top)), (px(cx + 13), px(top)), (px(cx + 13), px(top + 17)),
               (px(cx), px(top + 31)), (px(cx - 13), px(top + 17))], fill=ORANGE)
    d.line([px(cx - 6), px(top + 15), px(cx - 1), px(top + 21)], fill=(255, 255, 255), width=px(3))
    d.line([px(cx - 1), px(top + 21), px(cx + 7), px(top + 9)], fill=(255, 255, 255), width=px(3))


def icon_hourglass(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=G_SOFT)
    cx = x + 26
    d.line([px(cx - 11), px(y + 10), px(cx + 11), px(y + 10)], fill=GREEN, width=px(5))
    d.line([px(cx - 11), px(y + 38), px(cx + 11), px(y + 38)], fill=GREEN, width=px(5))
    d.polygon([(px(cx - 9), px(y + 12)), (px(cx + 9), px(y + 12)), (px(cx), px(y + 24))], fill=GREEN)


def icon_clock(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=G_SOFT)
    cx, cy, r = x + 26, y + 24, 15
    d.ellipse([px(cx - r), px(cy - r), px(cx + r), px(cy + r)], outline=GREEN, width=px(5))
    d.line([px(cx), px(cy), px(cx), px(cy - r * .55)], fill=GREEN, width=px(5))
    d.line([px(cx), px(cy), px(cx + r * .45), px(cy + r * .2)], fill=GREEN, width=px(5))


def icon_norating(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=G_SOFT)
    for i, bh in enumerate([12, 20, 27]):
        d.rectangle([px(x + 11 + i * 11), px(y + 40 - bh), px(x + 18 + i * 11), px(y + 40)],
                    fill=INK3)
    d.line([px(x + 8), px(y + 42), px(x + 44), px(y + 8)], fill=GREEN, width=px(6))


def icon_phone(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=G_SOFT)
    rr(d, (x + 17, y + 6, x + 35, y + 42), 6, outline=INK, width=px(4))
    d.line([px(x + 20), px(y + 24), px(x + 24), px(y + 29)], fill=GREEN, width=px(4))
    d.line([px(x + 24), px(y + 29), px(x + 33), px(y + 16)], fill=GREEN, width=px(4))


def icon_mute(d, x, y):
    rr(d, (x, y - 2, x + 52, y + 50), 16, fill=G_SOFT)
    d.line([px(x + 13), px(y + 12), px(x + 39), px(y + 36)], fill=GREEN, width=px(6))
    d.line([px(x + 39), px(y + 12), px(x + 13), px(y + 36)], fill=GREEN, width=px(6))


def num_badge(d, x, y, n):
    d.ellipse([px(x), px(y), px(x + 54), px(y + 54)], fill=VIOLET)
    fb = F(28, bold=True)
    t = str(n)
    d.text((px(x + 27 - tw(fb, t) / S / 2), px(y + 9)), t, font=fb, fill=(255, 255, 255))


def new_slide():
    img = Image.new("RGB", (px(W), px(H)), BG)
    layer = Image.new("RGBA", (px(W), px(H)), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    dl.ellipse([px(W * .52), px(-H * .22), px(W * 1.25), px(H * .38)], fill=GLOW_A + (140,))
    dl.ellipse([px(-W * .25), px(H * .62), px(W * .5), px(H * 1.2)], fill=GLOW_B + (170,))
    layer = layer.filter(ImageFilter.GaussianBlur(px(70)))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    d = ImageDraw.Draw(img)
    d._image = img
    return img, d


def paste_qr(img, x, y, size, quiet=12):
    if segno is None:
        return
    qr = segno.make(URL, error="M")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        p = tf.name
    qr.save(p, scale=12)
    q = Image.open(p).convert("RGB")
    os.unlink(p)
    inner = size - quiet * 2
    q = q.resize((px(inner), px(inner)), Image.NEAREST)
    rr(ImageDraw.Draw(img), (x, y, x + size, y + size), 12, fill=CARD)
    img.paste(q, (px(x + quiet), px(y + quiet)))


# ---------------------------------------------------------------- слайд 1 · обложка
def slide1(img, d):
    pad = 76
    chip(d, pad, 86, "2 класс · русский язык", F(24, bold=True))
    fn = F(22)
    d.text((px(W - pad - tw(fn, "1 / 5") / S), px(92)), "1 / 5", font=fn, fill=INK3)
    d.text((px(pad), px(160)), "СЛОВО", font=F(124, bold=True), fill=VIOLET)
    d.text((px(pad + tw(F(124, True), "СЛОВО") / S + 18), px(160)), "2.0",
           font=F(124, bold=True), fill=INK)
    yEnd = flow(d, pad, 356, W - 2 * pad,
                [("Словарные слова 2 класса — ", F(33, bold=True), INK),
                 ("как игра на телефоне. Открыли один раз — и оно работает даже без интернета.",
                  F(33), INK2)], lh=44)
    cx, cy = pad, max(470, yEnd + 14)
    for i, t in enumerate(["без рекламы", "без жизней и таймеров", "без рейтингов", "сова-помощник БУК"]):
        if i == 2:
            cx, cy = pad, cy + 56
        cx += chip(d, cx, cy, t, F(24, bold=True), pad=14) + 12
    # hero: БУК, сундук, ключи и самоцветы
    d.ellipse([px(100), px(960), px(980), px(1012)], fill=(242, 234, 218))
    owl(d, 810, 800, 290, cap=True, mood="excited")
    chest(d, 295, 885, 240)
    for gx, gy, gr, col in [(622, 662, 15, PINK), (700, 612, 11, VIOLET),
                            (560, 660, 9, GREEN), (205, 716, 12, ORANGE)]:
        diamond(d, gx, gy, gr, col, hilite=(255, 255, 255))
    key_icon(d, 432, 790, 24)
    key_icon(d, 500, 720, 19)
    key_icon(d, 376, 706, 17)
    ctext(d, W / 2, 1024, "Сова БУК растёт вместе с ребёнком", F(25, bold=True), INK)
    ctext(d, W / 2, 1058, "94 словарных слова · 16 уроков · 7 типов заданий", F(23), INK2)
    card(d, pad, 1112, W - pad * 2, 130, r=22)
    paste_qr(img, pad + 14, 1131, 92, quiet=10)
    d.text((px(pad + 132), px(1138)), "Откройте на телефоне — играть можно сразу:",
           font=F(23), fill=INK2)
    d.text((px(pad + 132), px(1172)), URL.replace("https://", ""), font=F(28, bold=True), fill=VIOLET)
    d.text((px(pad + 132), px(1210)), "Работает на Android и iPhone · бесплатно", font=F(21), fill=INK3)


# ---------------------------------------------------------------- слайд 2 · методика
def slide2(img, d):
    y = header(d, "2 / 5", "МЕТОДИКА", "Как учим — без зубрёжки",
               "Каждое слово: знакомство → проговаривание → закрепление → память")
    items = [
        ("Знакомство.", "Ударение, слоги и «опасная» буква мигает на карточке."),
        ("Проговаривание.", "Читаем по слогам так, как пишем, — орфограмму видно и слышно."),
        ("7 типов заданий.", "Окошко, сборка из букв, выбор верного, письмо по памяти, зрительный диктант."),
        ("Слова возвращаются.", "Интервальные повторения: слово придёт, пока не забылось."),
        ("Ошибка — не страшно.", "Покажем верное написание и мнемонику, слово вернём на отработку."),
    ]
    for lead, rest in items:
        y = bullet(d, 76, y, W - 152, icon_check, lead, "— " + rest)
    word_card(d, 76, y + 12, W - 152, 224, "карандаш", 6, {1, 3},
              "ка-ран-даш", "Нарисуй домик цветным ____ · подсказка «?» — в каждом задании")
    ctext(d, W / 2, y + 252,
          "оранжевым — «опасные» буквы, красной чертой — ударение", F(21), INK3)
    footer(d, "слайд 3 — почему спокойно")


# ---------------------------------------------------------------- слайд 3 — родителю спокойно
def slide3(img, d):
    y = header(d, "3 / 5", "БЕЗОПАСНОСТЬ И РЕЖИМ", "Родителю — спокойно",
               "Мягкий формат без давления — специально для второклассников")
    items = [
        (icon_clock, "Никаких жизней и таймеров.", "Ошибка ничего не отнимает — это шаг к умению."),
        (icon_norating, "Никаких публичных рейтингов.", "Ребёнок соревнуется со своим прогрессом, а не с классом."),
        (icon_shield, "Подсказка есть всегда.", "Ответ с подсказкой остаётся верным — за помощь не наказываем."),
        (icon_check, "Короткие уроки.", "Потолок задаёт родитель: 12, 16 или 20 карточек."),
        (icon_check, "Пропуск — не провал.", "Никаких упрёков «ты потерял серию»; день спасёт «заморозка»."),
        (icon_phone, "Данные остаются в телефоне.", "Без регистрации; приложение ничего никуда не отправляет."),
    ]
    for ic, lead, rest in items:
        y = bullet(d, 76, y, W - 152, ic, lead, "— " + rest)
    flow(d, 150, y + 6, W - 224,
         [("Рекламы и покупок нет; при первом открытии игра скачивает ~1 МБ, дальше работает "
           "полностью офлайн. Статистика и настройки — в разделе «Родителям».",
           F(25), INK3)], lh=36)
    footer(d, "слайд 4 — про мотивацию")


# ---------------------------------------------------------------- слайд 4 · мотивация
def slide4(img, d):
    y = header(d, "4 / 5", "МОТИВАЦИЯ БЕЗ ЛУТБОКСОВ", "Что удерживает ребёнка",
               "Возвращаться в игру хочется — и без азартных крючков")
    items = [
        ("Сова БУК растёт с ребёнком.", "Птенец → ученик → знаток → магистр — за выученные слова. Никогда не уменьшается."),
        ("Три задания дня → три ключа → сундук.", "Награда гарантирована. Пустых сундуков, рулеток и случайных призов нет."),
        ("Кристаллы — в дело.", "За них БУКу покупают кепку, бантик, очки, медаль, шапочку магистра."),
        ("Серия дней — коллекция, а не гонка.", "7 квадратиков на главном экране; три дня подряд дают бонусные кристаллы."),
    ]
    for lead, rest in items:
        y = bullet(d, 76, y, W - 152, icon_diamond, lead, "— " + rest)
    # нижняя полоса: рост БУКа и сундук
    sy = max(y + 14, 860)
    sh = 1234 - sy
    card(d, 76, sy, W - 152, sh, r=26)
    base = sy + sh - 82
    owl(d, 200, base - 86 * .47, 86, mood="idle")
    owl(d, 330, base - 104 * .47, 104, mood="idle")
    owl(d, 472, base - 124 * .47, 124, cap=True, mood="excited")
    d.line([px(130), px(base), px(555), px(base)], fill=LINE, width=px(2))
    fn = F(20)
    d.text((px(148), px(base + 12)), "птенец", font=fn, fill=INK3)
    d.text((px(285), px(base + 12)), "ученик", font=fn, fill=INK3)
    d.text((px(415), px(base + 12)), "магистр", font=fn, fill=INK3)
    tx = 600
    d.text((px(tx), px(sy + 38)), "12 · 30 · 60", font=F(26, bold=True), fill=INK)
    d.text((px(tx), px(sy + 74)), "освоенных слов —", font=F(20), fill=INK2)
    d.text((px(tx), px(sy + 100)), "новая ступень БУКа", font=F(20), fill=INK2)
    chest(d, tx + 55, sy + sh / 2 + 34, 150)
    d.text((px(tx + 160), px(sy + 132)), "Сундук БУКа:", font=F(23, bold=True), fill=INK)
    d.text((px(tx + 160), px(sy + 164)), "+15 кристаллов", font=F(21, bold=True), fill=VIOLET)
    d.text((px(tx + 160), px(sy + 194)), "каждый день", font=F(21, bold=True), fill=VIOLET)
    footer(d, "слайд 5 — как начать")


# ---------------------------------------------------------------- слайд 5 · старт
def slide5(img, d):
    y = header(d, "5 / 5", "СТАРТ ЗА ОДНУ МИНУТУ", "Как начать играть",
               "Ничего устанавливать из магазинов приложений не нужно")
    steps = [
        ("Откройте ссылку", "Нажмите её на телефоне или снимите QR-код камерой — игра откроется прямо в браузере."),
        ("Добавьте на главный экран", "В меню браузера выберите «На домашний экран» — необязательно, но удобнее."),
        ("Создайте профиль ребёнка", "Имя — и можно идти первый урок. Длину урока настраивает раздел «Родителям»."),
    ]
    for n, (t1, t2) in enumerate(steps, 1):
        card(d, 76, y, W - 152, 132, r=22)
        num_badge(d, 96, y + 39, n)
        d.text((px(170), px(y + 22)), t1, font=F(31, bold=True), fill=INK)
        flow(d, 170, y + 66, W - 152 - 94, [(t2, F(25), INK2)], lh=31)
        y += 150
    qy = y + 26
    sh = 1234 - qy
    card(d, 76, qy, W - 152, sh, r=26)
    qs = sh - 88
    paste_qr(img, 112, qy + 44, qs)
    fx = 112 + qs + 40
    d.text((px(fx), px(qy + 48)), "Словарные слова", font=F(33, bold=True), fill=INK)
    d.text((px(fx), px(qy + 94)), "2 класса — бесплатно", font=F(33, bold=True), fill=INK)
    pw = min(tw(F(23, True), URL.replace("https://", "")) / S + 36, W - 106 - fx)
    rr(d, (fx, qy + 142, fx + pw, qy + 192), 25, fill=V_SOFT)
    d.text((px(fx + 18), px(qy + 154)), URL.replace("https://", ""), font=F(23, bold=True), fill=VIOLET)
    flow(d, fx, qy + 216, W - 152 - (fx - 76) - 24,
         [("Android и iPhone · без рекламы и покупок. "
           "Напишите в чат, если что-то покажется неудобным — читаем и правим.", F(24), INK2)], lh=34)
    footer(d, "«СЛОВО 2.0» — авторская игра")



BUILDERS = {1: slide1, 2: slide2, 3: slide3, 4: slide4, 5: slide5}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/promo/2026-09-30")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    made = []
    for n in sorted(BUILDERS):
        img, d = new_slide()
        BUILDERS[n](img, d)
        out = img.resize((W, H), Image.LANCZOS)
        p = os.path.join(a.out, f"slide-{n}.png")
        out.save(p, optimize=True)
        made.append(p)
        print("✓", p, f"{os.path.getsize(p) // 1024} КБ")
    pages = [Image.open(p).convert("RGB") for p in made]
    pdf = os.path.join(a.out, "slovo2-parents.pdf")
    pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=150)
    print("✓", pdf, f"{os.path.getsize(pdf) // 1024} КБ")


if __name__ == "__main__":
    main()
