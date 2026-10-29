# -*- coding: utf-8 -*-
"""PDF-версия docs/buk-companion-3d.md с вёрсткой под чтение, а не под скролл.

Обложка, «главное в одном листе», содержание с переходами, идеи-карточки
вместо широких таблиц, зелёные плашки «Выводы», колонтитул со страницами.

Зависимости (одноразово):  python3 -m venv .venv-pdf && .venv-pdf/bin/pip install reportlab fonttools pypdf
Запуск:                    .venv-pdf/bin/python scripts/make-buk-pdf.py
Выход:                     docs/buk-companion-3d.pdf
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "buk-companion-3d.md"
OUT = ROOT / "docs" / "buk-companion-3d.pdf"

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("DJV", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DJV-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("DJVMono", str(FONT_DIR / "DejaVuSansMono.ttf")))
pdfmetrics.registerFont(TTFont("DJVMono-Bold", str(FONT_DIR / "DejaVuSansMono-Bold.ttf")))
pdfmetrics.registerFontFamily("DJV", normal="DJV", bold="DJV-Bold", italic="DJV", boldItalic="DJV-Bold")
pdfmetrics.registerFontFamily(
    "DJVMono", normal="DJVMono", bold="DJVMono-Bold", italic="DJVMono", boldItalic="DJVMono-Bold"
)

# ── палитра (из Mascot.tsx: #f4a51a / #fcd768 / #e8901a / #241f36) ──────────
INK = HexColor("#241F36")
ORANGE = HexColor("#F4A51A")
ORANGE_D = HexColor("#C97F0B")
BELLY = HexColor("#FCD768")
MUTED = HexColor("#5A6478")
LINE = HexColor("#DDE2EA")
LINK = HexColor("#2F6FED")
GREEN = HexColor("#2E7D32")
GREEN_BG = HexColor("#EDF7EF")
WARN_BG = HexColor("#FFF6E5")
RED = HexColor("#C0392B")
GOOD_T = HexColor("#1B7A3D")
WARN_T = HexColor("#9A6B00")
PANEL = HexColor("#F8FAFC")

PAGE_W, PAGE_H = A4
M_L = M_R = 17 * mm
M_T = 16 * mm
M_B = 18 * mm
CONTENT_W = PAGE_W - M_L - M_R

# ── стили ───────────────────────────────────────────────────────────────────
S_BODY = ParagraphStyle("Body", fontName="DJV", fontSize=10, leading=14.5, textColor=INK, spaceAfter=6)
S_LIST = ParagraphStyle(
    "List", parent=S_BODY, leftIndent=16, bulletIndent=5, spaceAfter=4, bulletFontName="DJV", bulletFontSize=8
)
S_NUM = ParagraphStyle("NumList", parent=S_BODY, leftIndent=14, spaceAfter=4)
S_LABEL = ParagraphStyle(
    "Label", fontName="DJV-Bold", fontSize=10, textColor=ORANGE_D, spaceBefore=6, spaceAfter=3
)
S_H3 = ParagraphStyle("H3", fontName="DJV-Bold", fontSize=12, leading=15.5, textColor=INK, spaceBefore=12, spaceAfter=5)
S_BAR = ParagraphStyle("BarTxt", fontName="DJV-Bold", fontSize=13.5, leading=17, textColor=colors.white)
S_BAR2 = ParagraphStyle("BarTxt2", fontName="DJV-Bold", fontSize=11.5, leading=14, textColor=colors.white)
S_TOC_H = ParagraphStyle("TOCH", fontName="DJV-Bold", fontSize=12, textColor=INK, spaceAfter=4)
S_CELL = ParagraphStyle("Cell", fontName="DJV", fontSize=8, leading=10.6, textColor=INK)
S_CELL_H = ParagraphStyle("CellH", fontName="DJV-Bold", fontSize=8, leading=10.6, textColor=colors.white)
S_TOC = [
    ParagraphStyle("TOC0", fontName="DJV-Bold", fontSize=10.5, leading=15, textColor=INK, spaceBefore=5),
    ParagraphStyle("TOC1", fontName="DJV", fontSize=9.5, leading=13, textColor=MUTED, leftIndent=16),
]
S_CARD_T = ParagraphStyle("CardT", fontName="DJV-Bold", fontSize=11, leading=14.5, textColor=INK, spaceAfter=2)
S_CARD_C = ParagraphStyle("CardC", fontName="DJV", fontSize=8, leading=11, textColor=MUTED, spaceAfter=3)
S_CARD_B = ParagraphStyle("CardB", fontName="DJV", fontSize=9.3, leading=13.2, textColor=INK, spaceAfter=3)
S_CARD_BL = ParagraphStyle(
    "CardBL",
    parent=S_CARD_B,
    leftIndent=13,
    bulletIndent=3,
    bulletFontName="DJV",
    bulletFontSize=7,
)
S_CALLOUT_T = ParagraphStyle("CallT", fontName="DJV-Bold", fontSize=9.5, leading=12.5, textColor=GREEN, spaceAfter=3)
S_CALLOUT_B = ParagraphStyle("CallB", fontName="DJV", fontSize=9.3, leading=13, textColor=INK, spaceAfter=3)
S_NOTE = ParagraphStyle("Note", fontName="DJV", fontSize=9.3, leading=13, textColor=INK)
S_COVER_P = ParagraphStyle("CoverP", fontName="DJV", fontSize=11, leading=16, textColor=MUTED)
S_TL = ParagraphStyle("TL", fontName="DJV", fontSize=10.5, leading=15, textColor=INK, leftIndent=16,
                      bulletIndent=5, spaceAfter=6, bulletFontName="DJV", bulletFontSize=9)

EMOJI = {"🌍 ": "", "🌍": "", "🎵 ": "♪ ", "🎵": "♪ ", "💎 ": "◆ ", "💎": "◆ "}


def rl(text: str, code_size: float = 9) -> str:
    """Markdown-инлайн → разметка Paragraph reportlab."""
    for a, b in EMOJI.items():
        text = text.replace(a, b)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", lambda m: f'<font face="DJVMono" size="{code_size}">{m.group(1)}</font>', text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2" color="#2F6FED">\1</link>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def plain(md: str) -> str:
    return re.sub(r"[*`]", "", md)


# ── разбор markdown на блоки ────────────────────────────────────────────────
def parse_blocks(lines: list[str]) -> list[dict]:
    blocks: list[dict] = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("```"):
            i += 1
            code = []
            while i < n and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            i += 1
            blocks.append({"t": "code", "lines": code})
            continue
        if line.startswith("### "):
            blocks.append({"t": "h3", "text": line[4:].strip()})
            i += 1
            continue
        if line.startswith("## "):
            blocks.append({"t": "h2", "text": line[3:].strip()})
            i += 1
            continue
        if line.startswith("# "):
            i += 1  # H1 — живёт на обложке
            continue
        if re.match(r"^-{3,}$", line.strip()):
            blocks.append({"t": "hr"})
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < n and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                rows.append(cells)
                i += 1
            blocks.append({"t": "table", "rows": rows})
            continue
        if line.startswith("* ") or re.match(r"^\d+\.\s", line):
            items = []
            while i < n:
                l = lines[i]
                if l.startswith("* "):
                    items.append({"m": "b", "body": l[2:].strip()})
                elif re.match(r"^\d+\.\s", l):
                    m = re.match(r"^(\d+)\.\s+(.*)$", l)
                    items.append({"m": "n", "num": m.group(1), "body": m.group(2)})
                elif l.strip() and (l.startswith("  ") or l.startswith("\t")) and items:
                    items[-1]["body"] += " " + l.strip()
                else:
                    break
                i += 1
            blocks.append({"t": "list", "items": items})
            continue
        # абзац
        buf = [line.strip()]
        i += 1
        while i < n and lines[i].strip() and not re.match(
            r"^(#{1,3}\s|\* |\d+\.\s|\||```|-{3,})", lines[i]
        ):
            buf.append(lines[i].strip())
            i += 1
        blocks.append({"t": "p", "lines": buf})
    return blocks


# ── вспомогательные flowable'ы ──────────────────────────────────────────────
class Bar(Flowable):
    """Заголовок раздела: плашка во всю ширину + запись в содержание."""

    def __init__(self, text: str, level: int = 0, toc: bool = True, bg=INK, style=S_BAR):
        super().__init__()
        self.para = Paragraph(rl(text, 9), style)
        self.plain_text = plain(text)
        self.level = level
        self.toc = toc
        self.bg = bg
        self.spaceBefore = 16 if level == 0 else 8
        self.spaceAfter = 8

    def wrap(self, aw, ah):
        self.width = aw
        tw, th = self.para.wrap(aw - 20, ah)
        self.h = th + 11
        self._th = th
        return aw, self.h

    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.width, self.h, 5, stroke=0, fill=1)
        self.para.drawOn(c, 10, (self.h - self._th) / 2)


def callout_table(title: str, items_flow) -> Table:
    # каждая мысль — отдельная строка: сплит страницы идёт ТОЛЬКО между строками,
    # иначе reportlab рвёт одну высокую ячейку и теряет её ширину (контрольный кейс)
    rows = [[Paragraph(rl(title), S_CALLOUT_T)]] + [[p] for p in items_flow]
    t = Table(rows, colWidths=[CONTENT_W], splitByRow=1, repeatRows=0)
    # не выдавать одну плашку-заголовок в конец страницы (вдова): цель уезжает целиком
    # и разбивается только если не помещается на страницу целиком (такого у нас нет)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_BG),
                ("LINEBEFORE", (0, 0), (0, -1), 3, GREEN),
                ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CFE6D5")),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, 0), 7),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
            ]
        )
    )
    return KeepTogether(t)


def note_table(text: str, bg, edge) -> Table:
    t = Table([[Paragraph(text, S_NOTE)]], colWidths=[CONTENT_W])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("LINEBEFORE", (0, 0), (0, -1), 3, edge),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


def make_table(rows: list[list[str]]) -> Table:
    head, *body = rows
    ncols = len(head)
    key = head[0]
    weights = {
        "Кусок": [.30, .26, .44],
        "Стек": [.15, .23, .24, .38],
        "Набор": [.44, .16, .40],
        "Риск": [.32, .68],
        "Этап": [.17, .43, .12, .28],
        "": [.13, .30, .26, .31],
    }.get(key, [1 / ncols] * ncols)
    if len(weights) != ncols:
        weights = [1 / ncols] * ncols
    widths = [CONTENT_W * w for w in weights]

    data = [[Paragraph(rl(c, 7.5), S_CELL_H) for c in head]]
    for r in body:
        cells = list(r) + [""] * (ncols - len(r))
        data.append([Paragraph(rl(c, 7.5) or " ", S_CELL) for c in cells[:ncols]])

    t = Table(data, colWidths=widths, repeatRows=1, splitByRow=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), HexColor("#F5F7FA")))
    t.setStyle(TableStyle(style))
    return t


# ── карточки идей ───────────────────────────────────────────────────────────
def vcolor(v: str, kind: str):
    v = v.lower()
    if kind == "eff":
        return GOOD_T if "высок" in v else WARN_T if "средн" in v else MUTED
    if kind == "effort":
        return GOOD_T if "мал" in v else WARN_T if "средн" in v else RED
    if kind == "risk":
        return GOOD_T if "мал" in v else WARN_T if "средн" in v else MUTED
    return MUTED


def hexs(col) -> str:
    r, g, b = (int(round(c * 255)) for c in (col.red, col.green, col.blue))
    return f"#{r:02X}{g:02X}{b:02X}"


def chips_line(meta: tuple[str, str, str, str] | None) -> str:
    if not meta:
        return ""
    eff, effort, risk, sign = meta
    parts = []
    if sign and sign != "—":
        parts.append('<b><font color="#C0392B">⚠ нужно отдельное «да»</font></b>')
    parts.append(f'эффект: <b><font color="{hexs(vcolor(eff, "eff"))}">{plain(eff)}</font></b>')
    parts.append(f'объём: <b><font color="{hexs(vcolor(effort, "effort"))}">{plain(effort)}</font></b>')
    parts.append(f'риск: <b><font color="{hexs(vcolor(risk, "risk"))}">{plain(risk)}</font></b>')
    return " · ".join(parts)


def card_flow(num: str, title: str, meta, flows: list) -> KeepTogether:
    rows = [[Paragraph(f'<font color="#C97F0B">{num}.</font> {rl(title, 8.5)}', S_CARD_T)]]
    chips = chips_line(meta)
    if chips:
        rows.append([Paragraph(chips, S_CARD_C)])
    if flows:
        rows.append([flows])
    t = Table(rows, colWidths=[CONTENT_W])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PANEL),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LINEBEFORE", (0, 0), (0, -1), 3.5, ORANGE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, 0), 8),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
            ]
        )
    )
    return KeepTogether(t)


# ── обложка и колонтитул ────────────────────────────────────────────────────
def _para(c, text, style, x, top, width) -> float:
    p = Paragraph(text, style)
    _, h = p.wrap(width, PAGE_H)
    p.drawOn(c, x, top - h)
    return top - h


def draw_cover(c: pdfcanvas.Canvas, doc):
    c.saveState()
    m = M_L
    # верхняя этикетка
    c.setFillColor(ORANGE)
    c.setFont("DJV-Bold", 9)
    c.drawString(m, PAGE_H - 26 * mm, "С Л О В О  2 . 0   ·   И С С Л Е Д О В А Н И Е   П Е Р С О Н А Ж А")
    c.setStrokeColor(ORANGE)
    c.setLineWidth(1.4)
    c.line(m, PAGE_H - 29 * mm, m + 74, PAGE_H - 29 * mm)

    y = _para(
        c,
        "БУК-компаньон",
        ParagraphStyle("CT", fontName="DJV-Bold", fontSize=36, leading=42, textColor=INK),
        m,
        PAGE_H - 46 * mm,
        CONTENT_W,
    )
    y = _para(
        c,
        "4 исследования · 12 идей · детальный план 3D",
        ParagraphStyle("CS", fontName="DJV-Bold", fontSize=16, leading=21, textColor=ORANGE_D),
        m,
        y - 6 * mm,
        CONTENT_W,
    )
    y = _para(
        c,
        "Как превратить сову-маскота в реального помощника, удобный инструмент и собеседника — "
        "офлайн, без LLM и без подписки.",
        S_COVER_P,
        m,
        y - 9 * mm,
        CONTENT_W - 30 * mm,
    )

    y -= 14 * mm
    c.setFillColor(INK)
    c.setFont("DJV", 9.5)
    for line in [
        "Документ:  docs/buk-companion-3d.md   ·   дата: 29.10.2026",
        "Статус:  мозговой штурм — ничего из описанного не реализовано",
        "Формат:  исследования → идеи-карточки → план 3D → открытые решения",
    ]:
        c.drawString(m, y, line)
        y -= 6 * mm

    # чипы
    y -= 4 * mm
    chips = [("4 исследования", ORANGE), ("12 идей", GREEN), ("3D поэтапно", INK), ("офлайн-first", HexColor("#2F6FED"))]
    x = m
    for text, col in chips:
        w = c.stringWidth(text, "DJV-Bold", 9) + 16
        c.setFillColor(col)
        c.roundRect(x, y - 4 * mm, w, 7.6 * mm, 3.6 * mm, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont("DJV-Bold", 9)
        c.drawString(x + 8, y - 1.4 * mm, text)
        x += w + 6

    # сова (минимальная геометрия)
    ox, oy, r = PAGE_W - 88, 92, 42
    c.setFillColor(ORANGE)
    c.setStrokeColor(INK)
    c.setLineWidth(1.6)
    c.circle(ox, oy, r, stroke=1, fill=1)
    c.setFillColor(ORANGE)
    p = c.beginPath()
    p.moveTo(ox - r + 6, oy + r - 10)
    p.lineTo(ox - r + 20, oy + r + 16)
    p.lineTo(ox - 4, oy + r - 4)
    p.close()
    c.drawPath(p, stroke=1, fill=1)
    p = c.beginPath()
    p.moveTo(ox + r - 6, oy + r - 10)
    p.lineTo(ox + r - 20, oy + r + 16)
    p.lineTo(ox + 4, oy + r - 4)
    p.close()
    c.drawPath(p, stroke=1, fill=1)
    for ex in (-15, 15):
        c.setFillColor(BELLY)
        c.circle(ox + ex, oy + 8, 15, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.circle(ox + ex, oy + 8, 9, stroke=0, fill=1)
        c.setFillColor(INK)
        c.circle(ox + ex, oy + 8, 5, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.circle(ox + ex + 2, oy + 10, 1.7, stroke=0, fill=1)
    c.setFillColor(HexColor("#E8901A"))
    p = c.beginPath()
    p.moveTo(ox - 6, oy - 2)
    p.lineTo(ox + 6, oy - 2)
    p.lineTo(ox, oy - 12)
    p.close()
    c.drawPath(p, stroke=1, fill=1)

    c.setFillColor(MUTED)
    c.setFont("DJV", 8.5)
    c.drawString(
        m,
        22 * mm,
        "Пункты с пометкой «согласование» не делаются без отдельного «да» — как в docs/mascot-interactivity.md.",
    )
    c.setFillColor(HexColor("#9AA3B5"))
    c.setFont("DJV", 7.5)
    c.drawString(m, 15 * mm, "СЛОВО 2.0 · тренажёр словарных слов 1–4 класс · офлайн-PWA")
    c.restoreState()


class NumberedCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self._saved_pages = []
        self.setTitle("БУК-компаньон — 4 исследования, 12 идей и план 3D")
        self.setAuthor("СЛОВО 2.0")
        self.setSubject("Исследование и мозговой штурм по персонажу БУК")

    def showPage(self):
        self._saved_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        self.setTitle("БУК-компаньон — 4 исследования, 12 идей и план 3D")
        self.setAuthor("СЛОВО 2.0")
        self.setSubject("Исследование и мозговой штурм по персонажу БУК")
        total = len(self._saved_pages)
        for state in self._saved_pages:
            self.__dict__.update(state)
            if self._pageNumber > 1:
                self._footer(total)
            super().showPage()
        super().save()

    def _footer(self, total):
        self.setStrokeColor(LINE)
        self.setLineWidth(0.5)
        self.line(M_L, 12.5 * mm, PAGE_W - M_R, 12.5 * mm)
        self.setFont("DJV", 7.5)
        self.setFillColor(MUTED)
        self.drawString(M_L, 8.8 * mm, "СЛОВО 2.0 · БУК-компаньон · docs/buk-companion-3d.md")
        self.drawRightString(PAGE_W - M_R, 8.8 * mm, f"стр. {self._pageNumber} / {total}")


class BukDoc(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(
            str(path),
            pagesize=A4,
            leftMargin=M_L,
            rightMargin=M_R,
            topMargin=M_T,
            bottomMargin=M_B,
        )
        cover_frame = Frame(M_L, M_B, CONTENT_W, PAGE_H - M_T - M_B, id="cover")
        body_frame = Frame(M_L, M_B, CONTENT_W, PAGE_H - M_T - M_B, id="body")
        self.addPageTemplates(
            [
                PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover),
                PageTemplate(id="body", frames=[body_frame]),
            ]
        )

    def afterFlowable(self, flowable):
        if isinstance(flowable, Bar):
            if flowable.toc:
                self.notify("TOCEntry", (flowable.level, flowable.plain_text, self.page))
        elif isinstance(flowable, Paragraph) and flowable.style.name == "H3":
            self.notify("TOCEntry", (1, flowable.getPlainText(), self.page))


# ── сборка истории ──────────────────────────────────────────────────────────
def build_story(blocks: list[dict]) -> list:
    story: list = [NextPageTemplate("body"), PageBreak()]

    # обзор документа
    story.append(Bar("Главное в одном листе", toc=False, bg=GREEN, style=S_BAR2))
    tl = [
        "<b>Собеседника делают 4 вещи</b> — характер, вопрос-сцена, память о ребёнке и потолок разговора "
        "(по кейсу Duolingo Lily). Всё это работает офлайн и без LLM: у нас есть SRS-статистика именно этого "
        "ребёнка и размеченный контент-пак — конкурентам такого нет.",
        "<b>3D — это не three.js.</b> Оптимальный ход: модель в Blender → скрипт рендерит кадры → свой "
        "canvas-плеер. «3D для глаз», ~0 кБ рантайма, ≤ 500 кБ кадров вне precache, работает на слабых "
        "телефонах. Настоящий WebGL — только ленивым чанком для «Мой мира», если станет мало.",
        "<b>12 идей</b> в порядке пользы: БУК-навигатор (пузырь-хаб, включая вход в «Мой мир») → чат "
        "«Спроси БУКа» → Память о ребёнке → диктовка голосом → комната БУКа в «Моём мире» и ещё семь.",
        "<b>Преимущество:</b> облачные конкуренты дают умность за ~$30/мес с обязательным интернетом; "
        "БУК — бесплатно, в самолётном режиме и знает этого ребёнка лично.",
        "<b>Старт:</b> итерация 1 — «живой SVG» (глаза следят, голова кренится) + навигатор; итерация 2 — "
        "чат и Память; итерации 3–4 — 3D-пайплайн и комната.",
    ]
    for t in tl:
        story.append(Paragraph(t, S_TL, bulletText="●"))
    story.append(Spacer(1, 4))
    story.append(
        note_table(
            "<b>Красные линии (не нарушаем):</b> без укоров и вины · без наград за тапы · "
            "без 3D поверх карточек урока · всё остаётся на устройстве ребёнка.",
            HexColor("#FDEEEE"),
            RED,
        )
    )
    story.append(Spacer(1, 10))
    story.append(Bar("Содержание", toc=False, bg=INK, style=S_BAR2))
    toc = TableOfContents()
    toc.levelStyles = S_TOC
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(PageBreak())

    ideas_mode = False
    idea_meta: dict[str, tuple] = {}
    card: dict | None = None
    callout: list | None = None  # накопитель строк зелёной плашки

    def flush_card():
        nonlocal card
        if card is None:
            return
        num, title, flows = card["num"], card["title"], card["flows"]
        story.append(card_flow(num, title, idea_meta.get(num), flows))
        card = None

    def flush_callout():
        nonlocal callout
        if callout is None:
            return
        title, items = callout
        story.append(callout_table(title, items))
        callout = None

    for b in blocks:
        t = b["t"]

        if t == "h2":
            flush_card()
            flush_callout()
            ideas_mode = b["text"].startswith("5.")
            story.append(Bar(b["text"]))
            continue

        if t == "h3":
            if ideas_mode:
                m = re.match(r"^(\d+)\.\s+(.*)$", b["text"])
                if m:
                    flush_card()
                    card = {"num": m.group(1), "title": m.group(2), "flows": []}
                    continue
            flush_callout()
            story.append(Paragraph(rl(b["text"]), S_H3))
            continue

        if t == "hr":
            if ideas_mode:
                continue
            flush_callout()
            story.append(Spacer(1, 2))
            continue

        if t == "table":
            flush_callout()
            rows = [r for r in b["rows"] if not all(re.match(r"^:?-+:?$", c) for c in r)]
            if ideas_mode and rows and rows[0][0] == "#":
                for r in rows[1:]:
                    if len(r) >= 6:
                        idea_meta[r[0]] = (r[2], r[3], r[4], r[5].replace("*", ""))
                continue
            if rows:
                story.append(make_table(rows))
            continue

        if t == "code":
            flush_callout()
            cell = []
            for x in b["lines"]:
                lead = len(x) - len(x.lstrip(" "))
                body = rl(x, 7.5)
                body = "&nbsp;" * lead + body[lead:] if lead else body
                cell.append(
                    Paragraph(
                        body or "&nbsp;",
                        ParagraphStyle("Code", fontName="DJVMono", fontSize=7.5, leading=10.5, textColor=INK),
                    )
                )
            box = Table([[cell]], colWidths=[CONTENT_W])
            box.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F4F6F8")),
                        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(KeepTogether(box))
            continue

        if t == "list":
            # элементы внутри зелёной плашки «Выводы»?
            if callout is not None:
                for it in b["items"]:
                    if it["m"] == "n":
                        body = rl(it["body"], 8.5)
                        callout[1].append(
                            Paragraph(f'<b><font color="#C97F0B">{it["num"]}.</font></b> {body}', S_CALLOUT_B)
                        )
                    else:
                        callout[1].append(Paragraph(rl(it["body"], 8.5), S_CALLOUT_B, bulletText="•"))
                continue
            # список внутри карточки идеи — остаётся в карточке
            if card is not None:
                for it in b["items"]:
                    if it["m"] == "n":
                        card["flows"].append(
                            Paragraph(
                                f'<b><font color="#C97F0B">{it["num"]}.</font></b> {rl(it["body"], 8.5)}',
                                S_CARD_B,
                            )
                        )
                    else:
                        card["flows"].append(Paragraph(rl(it["body"], 8.5), S_CARD_BL, bulletText="•"))
                continue
            for it in b["items"]:
                if it["m"] == "n":
                    story.append(
                        Paragraph(
                            f'<b><font color="#C97F0B">{it["num"]}.</font></b> {rl(it["body"])}', S_NUM
                        )
                    )
                else:
                    story.append(Paragraph(rl(it["body"]), S_LIST, bulletText="•"))
            continue

        if t == "p":
            lines = b["lines"]
            joined = " ".join(lines)
            first = lines[0]

            # зелёная плашка «Выводы …» — собираем следующие списки внутрь
            if first.startswith("**Вывод"):
                flush_callout()
                callout = [plain(first), []]
                continue

            # оранжевая плашка-предупреждение «Статус …»
            if first.startswith("**Статус"):
                flush_callout()
                story.append(note_table(rl(joined), WARN_BG, ORANGE))
                continue

            # полностью жирная короткая строка-метка («Находки.», «Исследование 1…»)
            m = re.match(r"^\*\*([^*]+)\*\*$", first)
            if m and len(m.group(1)) <= 90 and len(lines) == 1:
                flush_callout()
                story.append(Paragraph(rl(m.group(1)), S_LABEL))
                continue
            # жирная метка + продолжение списком ссылок в той же строке-абзаце
            m2 = re.match(r"^\*\*([^*]+)\*\*(.*)$", first)
            if m2 and not m2.group(2).strip() and len(m2.group(1)) <= 90:
                flush_callout()
                rest = " ".join(lines[1:]).strip()
                story.append(Paragraph(rl(m2.group(1)), S_LABEL))
                if rest:
                    if card is not None:
                        card["flows"].append(Paragraph(rl(rest), S_CARD_B))
                    else:
                        story.append(Paragraph(rl(rest), S_BODY))
                continue

            flush_callout()
            if card is not None:
                card["flows"].append(Paragraph(rl(joined), S_CARD_B))
            else:
                story.append(Paragraph(rl(joined), S_BODY))
            continue

    flush_card()
    flush_callout()
    return story


def main():
    text = SRC.read_text(encoding="utf-8")
    lines = text.splitlines()
    blocks = parse_blocks(lines)
    story = build_story(blocks)
    doc = BukDoc(OUT)
    doc.multiBuild(story, canvasmaker=NumberedCanvas)
    print(f"готово: {OUT} ({OUT.stat().st_size // 1024} КБ)")


if __name__ == "__main__":
    sys.exit(main())
