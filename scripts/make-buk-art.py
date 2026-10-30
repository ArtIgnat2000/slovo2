#!/usr/bin/env python3
"""Рендер кадров БУКа для 3D-плеера: Blender headless, этап 1 пайплайна.

Сцена строится ПРОЦЕДУРНО из описания ниже (images-src/buk/model.blend —
produced-артефакт для ручной доработки, единственный источник — этот скрипт).
Палитра, пропорции и морфы повторяют src/ui/Mascot.tsx: low-poly (< 5 тыс.
треугольников), toon-шейдинг (Cycles Diffuse Toon), фон прозрачный.

  python3 scripts/make-buk-art.py                  # все ступени, все клипы
  python3 scripts/make-buk-art.py --stage chick     # одна ступень
  python3 scripts/make-buk-art.py --samples 12      # качество кадра

Выход: images-src/buk/frames/<ступень>/<клип>-<номер>.png
Дальше: node scripts/make-buk-3d.mjs (атласы WebP + public/buk3d/manifest.json).

Ступени (как growthStage в src/engine/shop.ts): 0 птенец, 1 ученик,
2 знаток, 3 магистр — в каталогах chick/student/sage/master.
Клипы: idle (16 углов), face + эмоции + sleep/curious (по 4 фронта) = 48
кадров на ступень (бюджет §6.4 доки buk-companion-3d.md).
"""
import argparse
import math
import os
import sys
import time

try:
    import bpy
except ImportError as exc:  # pragma: no cover - окружение без Blender
    sys.exit(
        "bpy недоступен: %s\n"
        "Нужен Blender headless (3.6+/4.x/5.x): `pip install bpy` в venv "
        "или системный blender — CI атласы берёт из public/buk3d/, рендер "
        "только локальный (см. docs/buk-companion-3d.md §6.6)." % exc
    )

# ── Палитра и пропорции (svg-пиксели Mascot.tsx × K → единицы Blender) ────
K = 0.02                      # 1 svg px = 0.02 eu
VIEW_H = 120                  # svg viewBox 0 0 100 120
C_BODY = (0xF4 / 255, 0xA5 / 255, 0x1A / 255, 1.0)   # #f4a51a
C_BELLY = (0xFC / 255, 0xD7 / 255, 0x68 / 255, 1.0)  # #fcd768
C_WING = (0xE8 / 255, 0x90 / 255, 0x1A / 255, 1.0)   # #e8901a
C_STRIPE = (0xF0 / 255, 0xA9 / 255, 0x2C / 255, 1.0)  # #f0a92c
C_WHITE = (1.0, 1.0, 1.0, 1.0)
C_DARK = (0x24 / 255, 0x1F / 255, 0x36 / 255, 1.0)   # #241f36
C_PINK = (0xF4 / 255, 0x3F / 255, 0x5E / 255, 1.0)   # #f43f5e

STAGES = ["chick", "student", "sage", "master"]

# Фронты разговорных сцен: ±45° читаются целиком, ±15° — ближе к фасу.
FACE_ANGLES = (-45, -15, 15, 45)

CLIPS = [
    # (имя клипа, kind, параметр)
    ("idle", "circle", None),          # 16 кадров: полный круг, шаг 22.5°
    ("face", "faces", "idle"),         # фронтальные кадры «разговорного» idle
    ("happy", "faces", "happy"),
    ("excited", "faces", "excited"),
    ("sad", "faces", "sad"),
    ("think", "faces", "think"),
    ("dance", "faces", "dance"),
    ("sleep", "faces", "sleep"),
    ("curious", "faces", "curious"),
]

# Морды по mood: (белок rx, ry, dy; зрачок r, dx, dy, блик; рот)
# Перевод svg-координат: центр глаза svg (36, 36) → лево (−0.28, …), право (+0.28)
EYE_DX = 0.28                 # |x−50|·K для глаз
WHITES = {
    "idle":    dict(rx=0.16, ry=0.16, dy=0.00),
    "happy":   dict(rx=0.16, ry=0.12, dy=-0.04),
    "excited": dict(rx=0.20, ry=0.20, dy=0.04),
    "sad":     dict(rx=0.16, ry=0.10, dy=-0.04),
    "think":   dict(rx=0.16, ry=0.14, dy=0.04),
    "dance":   dict(rx=0.19, ry=0.19, dy=0.06),
    "sleep":   dict(rx=0.16, ry=0.05, dy=0.00),
    "curious": dict(rx=0.16, ry=0.16, dy=0.00),
}
PUPILS = {
    "idle":    dict(r=0.08, dx=0.00, dy=0.02, hi=True),
    "happy":   dict(r=0.08, dx=0.00, dy=-0.02, hi=False),
    "excited": dict(r=0.11, dx=0.00, dy=0.04, hi=True),
    "sad":     dict(r=0.07, dx=0.00, dy=-0.02, hi=False),
    "think":   dict(r=0.08, dx=0.04, dy=0.04, hi=False),
    "dance":   dict(r=0.10, dx=-0.02, dy=0.06, hi=True),
    "sleep":   dict(r=0.00, dx=0.00, dy=0.00, hi=False),
    "curious": dict(r=0.08, dx=0.05, dy=0.02, hi=True),
}
# Рот: arc = дуга (изгиб down/up), oval = овал. Координаты — смещения от
# точки svg (50, 52) вниз на z, изгиб в svg-пикселях × K.
MOUTHS = {
    "idle":    dict(kind="arc", w=0.32, curve=0.10, dy=0.00),
    "happy":   dict(kind="arc", w=0.52, curve=0.30, dy=-0.04),
    "excited": dict(kind="oval", w=0.36, h=0.24, dy=0.02),
    "sad":     dict(kind="arc", w=0.32, curve=-0.14, dy=-0.06),
    "think":   dict(kind="arc", w=0.28, curve=0.0, dy=0.02),
    "dance":   dict(kind="oval", w=0.32, h=0.20, dy=0.02),
    "sleep":   dict(kind="arc", w=0.22, curve=0.08, dy=-0.02),
    "curious": dict(kind="arc", w=0.30, curve=0.06, dy=0.00),
}
# Дополнительные позы (голова): yaw/pitch в градусах
HEAD_POSE = {
    "idle": dict(yaw=0, pitch=0),
    "happy": dict(yaw=0, pitch=-4),
    "excited": dict(yaw=0, pitch=-6),
    "sad": dict(yaw=0, pitch=6),
    "think": dict(yaw=0, pitch=-2),
    "dance": dict(yaw=0, pitch=-4),
    "sleep": dict(yaw=0, pitch=16),
    "curious": dict(yaw=24, pitch=-6),
}


def svg_x(x):
    return (x - 50) * K


def svg_z(y):
    return (VIEW_H - y) * K


# ── Материалы: имена = маски для будущей hue-перекраски (§6.4) ────────────
def make_material(name, color, toon=True, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if toon:
        # тональность от Diffuse Toon + эмиссионная подложка, чтобы палитра
        # Mascot не тускнела под солнечным светом (buk_body ≈ #f4a51a)
        toon_sh = nt.nodes.new("ShaderNodeBsdfDiffuse")
        toon_sh.inputs["Color"].default_value = color
        toon_sh.inputs["Roughness"].default_value = 0.0
        emit_sh = nt.nodes.new("ShaderNodeEmission")
        emit_sh.inputs["Color"].default_value = color
        emit_sh.inputs["Strength"].default_value = 1.0 + emission
        mix = nt.nodes.new("ShaderNodeMixShader")
        mix.inputs["Fac"].default_value = 0.45
        nt.links.new(toon_sh.outputs[0], mix.inputs[1])
        nt.links.new(emit_sh.outputs[0], mix.inputs[2])
        sh = mix
    else:
        sh = nt.nodes.new("ShaderNodeEmission")
        sh.inputs["Color"].default_value = color
        sh.inputs["Strength"].default_value = 1.0 + emission
    nt.links.new(sh.outputs[0], out.inputs["Surface"])
    return mat


def ensure_materials():
    mats = bpy.data.materials
    if "buk_body" in mats:
        return
    make_material("buk_body", C_BODY)
    make_material("buk_belly", C_BELLY)
    make_material("buk_wing", C_WING)
    make_material("buk_stripe", C_STRIPE)
    make_material("buk_eye_white", C_WHITE, toon=False)
    make_material("buk_eye_dark", C_DARK, toon=False)
    make_material("buk_mouth_pink", C_PINK, toon=False)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ensure_materials()


def add_sphere(name, loc, scale, mat, segments=16, rings=8, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    ob.data.materials.append(bpy.data.materials[mat])
    if parent is not None:
        ob.parent = parent
    return ob


def add_cone(name, loc, scale, rot, mat, parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=1.0, radius2=0.0, depth=2.0, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    ob.data.materials.append(bpy.data.materials[mat])
    if parent is not None:
        ob.parent = parent
    return ob


def add_empty(name, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    return ob


def build_owl(stage_index):
    """Строит сову на given ступень. Возвращает словарь объектов для mood-смены."""
    root = add_empty("buk_root")
    # ── тело и голова (оверлап как в svg, глубина = 0.85 × ширина) ────────
    body = add_sphere("buk_body", (0, 0, svg_z(82)), (36 * K, 31 * K, 37 * K), "buk_body", parent=root)
    belly = add_sphere("buk_belly", (0, -10 * K, svg_z(88)), (24 * K, 24 * K, 27 * K), "buk_belly", parent=root)
    # крылья: вытянутые капли по бокам (dance-поза поднимает их — клип сам двигает)
    wing_l = add_sphere("buk_wing_l", (svg_x(14), 2 * K, svg_z(66)), (14 * K, 8 * K, 24 * K), "buk_wing", parent=root)
    wing_l.rotation_euler = (0, math.radians(-14), math.radians(8))
    wing_r = add_sphere("buk_wing_r", (svg_x(86), 2 * K, svg_z(66)), (14 * K, 8 * K, 24 * K), "buk_wing", parent=root)
    wing_r.rotation_euler = (0, math.radians(14), math.radians(-8))
    # лапки
    add_sphere("buk_foot_l", (svg_x(38), -6 * K, svg_z(116)), (10 * K, 8 * K, 5 * K), "buk_wing", parent=root)
    add_sphere("buk_foot_r", (svg_x(62), -6 * K, svg_z(116)), (10 * K, 8 * K, 5 * K), "buk_wing", parent=root)
    # хвост: stage 2 — одно перо, stage 3 — два (веером назад)
    if stage_index >= 2:
        t1 = add_sphere("buk_tail1", (svg_x(88), 16 * K, svg_z(86)), (14 * K, 6 * K, 8 * K), "buk_wing", parent=root)
        t1.rotation_euler = (math.radians(-24), 0, math.radians(-28))
    if stage_index >= 3:
        t2 = add_sphere("buk_tail2", (svg_x(84), 20 * K, svg_z(94)), (16 * K, 6 * K, 8 * K), "buk_body", parent=root)
        t2.rotation_euler = (math.radians(-30), 0, math.radians(-34))

    # ── голова: pivot для поворотов (curious/sleep двигают голову) ────────
    # поворот вокруг «шеи» (низ головы): yaw → pitch → голова и лицо
    head_yaw = add_empty("buk_head_yaw", (0, 0, svg_z(62)))
    head_yaw.parent = root
    head_pitch = add_empty("buk_head_pitch", (0, 0, 0))
    head_pitch.parent = head_yaw

    head = add_sphere(
        "buk_head",
        (0, 0, svg_z(37) - svg_z(62)),
        (30 * K, 25.5 * K, 28 * K),
        "buk_body",
        parent=head_pitch,
    )
    # светлые «окуляры» вокруг глаз (svg: круги belly r13)
    white_l = add_sphere("buk_eye_base_l", (svg_x(36), -20 * K, svg_z(37) - svg_z(62)), (13 * K, 6 * K, 13 * K), "buk_belly", parent=head_pitch)
    white_r = add_sphere("buk_eye_base_r", (svg_x(64), -20 * K, svg_z(37) - svg_z(62)), (13 * K, 6 * K, 13 * K), "buk_belly", parent=head_pitch)
    # белки (форма зависит от mood)
    eye_l = add_sphere("buk_eye_l", (svg_x(36), -25 * K, svg_z(36) - svg_z(62)), (8 * K, 4 * K, 8 * K), "buk_eye_white", parent=head_pitch, segments=12, rings=6)
    eye_r = add_sphere("buk_eye_r", (svg_x(64), -25 * K, svg_z(36) - svg_z(62)), (8 * K, 4 * K, 8 * K), "buk_eye_white", parent=head_pitch, segments=12, rings=6)
    # зрачки + блики
    pup_l = add_sphere("buk_pupil_l", (svg_x(36), -28 * K, svg_z(37) - svg_z(62)), (4 * K, 3 * K, 4 * K), "buk_eye_dark", parent=head_pitch, segments=10, rings=5)
    pup_r = add_sphere("buk_pupil_r", (svg_x(64), -28 * K, svg_z(37) - svg_z(62)), (4 * K, 3 * K, 4 * K), "buk_eye_dark", parent=head_pitch, segments=10, rings=5)
    hi_l = add_sphere("buk_hi_l", (svg_x(36) + 2 * K, -30 * K, svg_z(37) - svg_z(62) + 2 * K), (1.6 * K, 1.6 * K, 1.6 * K), "buk_eye_white", parent=head_pitch, segments=8, rings=4)
    hi_r = add_sphere("buk_hi_r", (svg_x(64) + 2 * K, -30 * K, svg_z(37) - svg_z(62) + 2 * K), (1.6 * K, 1.6 * K, 1.6 * K), "buk_eye_white", parent=head_pitch, segments=8, rings=4)
    # клюв: тонкий треугольник (svg path 44,45 → 50,53 → 56,45)
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=7.5 * K, radius2=0.0, depth=9 * K,
                                    location=(0, -27 * K, svg_z(49) - svg_z(62)),
                                    rotation=(math.radians(-100), 0, 0))
    beak = bpy.context.active_object
    beak.name = "buk_beak"
    beak.scale = (1.5, 1.0, 1.0)
    beak.data.materials.append(bpy.data.materials["buk_wing"])
    beak.parent = head_pitch

    # рот: дуги и овалы всех mood'ов (переключением hide_render)
    mouths = {}
    for mood, spec in MOUTHS.items():
        if spec["kind"] == "arc":
            # дуга из трёх сегментов: тонкая капля-скоба
            w = spec["w"]
            curve = spec["curve"]
            mid_z = svg_z(52) - svg_z(62) + spec["dy"]
            m = add_sphere(
                f"buk_mouth_{mood}",
                (0, -26 * K, mid_z),
                (w / 2, 2.2 * K, max(abs(curve), 0.045)),
                "buk_eye_dark",
                parent=head_pitch,
                segments=10,
                rings=5,
            )
            # изгиб: верх дуги в сторону curve (вниз/svg-ось — это +z)
            m.rotation_euler = (math.radians(90), 0, 0)
            if curve < 0:
                m.rotation_euler.x = math.radians(-90)
        else:
            m = add_sphere(
                f"buk_mouth_{mood}",
                (0, -26 * K, svg_z(53) - svg_z(62) + spec["dy"]),
                (spec["w"] / 2, 3 * K, spec["h"] / 2),
                "buk_mouth_pink",
                parent=head_pitch,
                segments=10,
                rings=5,
            )
        m.hide_render = True
        m.hide_viewport = True
        mouths[mood] = m

    # ── ступеневые отличия ────────────────────────────────────────────────
    if stage_index == 0:
        # птенец: пух вместо ушек — три волосика + дуга-челка
        for i, dx in enumerate((-0.14, 0.0, 0.14)):
            h = add_cone(
                f"buk_fluff_{i}",
                (dx, -4 * K, svg_z(6) - svg_z(62)),
                (4 * K, 4 * K, 7 * K),
                (math.radians(-12 * (i - 1)), 0, 0),
                "buk_body",
                parent=head_pitch,
            )
        crest = add_sphere(
            "buk_crest",
            (0, -2 * K, svg_z(16) - svg_z(62)),
            (17 * K, 6 * K, 5 * K),
            "buk_body",
            parent=head_pitch,
            segments=12,
            rings=5,
        )
        crest.rotation_euler = (0, 0, 0)
    else:
        # ушки-конусы (svg треугольники 24,18-18,4-31,13)
        add_cone("buk_ear_l", (svg_x(21), -4 * K, svg_z(9) - svg_z(62)),
                 (7 * K, 7 * K, 13 * K), (math.radians(-8), math.radians(-16), 0),
                 "buk_wing", parent=head_pitch)
        add_cone("buk_ear_r", (svg_x(79), -4 * K, svg_z(9) - svg_z(62)),
                 (7 * K, 7 * K, 13 * K), (math.radians(-8), math.radians(16), 0),
                 "buk_wing", parent=head_pitch)

    # «перья-полоски» на груди — по числу освоенных ступеней
    for i in range(stage_index):
        add_sphere(
            f"buk_stripe_{i}",
            (0, -24 * K, svg_z(100 - i * 7) - svg_z(62) + svg_z(62)),
            (11 * K, 3 * K, 2.4 * K),
            "buk_stripe",
            parent=root,
            segments=10,
            rings=5,
        )

    return dict(
        root=root, body=body, wing_l=wing_l, wing_r=wing_r,
        head_yaw=head_yaw, head_pitch=head_pitch,
        eye_l=eye_l, eye_r=eye_r, pup_l=pup_l, pup_r=pup_r,
        hi_l=hi_l, hi_r=hi_r, mouths=mouths,
    )


def set_mood(owl, mood, dance_pose=False):
    wh = WHITES[mood]
    for eye, sx in ((owl["eye_l"], -1), (owl["eye_r"], 1)):
        eye.scale = (wh["rx"], 4 * K, wh["ry"])
        eye.location.z = svg_z(36) - svg_z(62) + wh["dy"]
    pu = PUPILS[mood]
    for pup, hi, sx in ((owl["pup_l"], owl["hi_l"], -1), (owl["pup_r"], owl["hi_r"], 1)):
        pup.scale = (max(pu["r"], 0.001), 3 * K, max(pu["r"], 0.001))
        pup.location.x = (36 if sx < 0 else 64) * 0 + svg_x(36 if sx < 0 else 64) + pu["dx"]
        pup.location.z = svg_z(37) - svg_z(62) + pu["dy"]
        pup.hide_render = pu["r"] == 0
        pup.hide_viewport = pu["r"] == 0
        hi.hide_render = not pu["hi"]
        hi.hide_viewport = not pu["hi"]
    for mood_key, m in owl["mouths"].items():
        on = mood_key == mood
        m.hide_render = not on
        m.hide_viewport = not on
    pose = HEAD_POSE[mood]
    owl["head_yaw"].rotation_euler = (0, 0, math.radians(-pose["yaw"]))
    owl["head_pitch"].rotation_euler = (math.radians(-pose["pitch"]), 0, 0)
    # dance: крылья подняты (как в SVG)
    lift = math.radians(-28) if (dance_pose or mood == "dance") else math.radians(0)
    owl["wing_l"].rotation_euler.z = math.radians(8) + lift
    owl["wing_r"].rotation_euler.z = math.radians(-8) - lift


def set_yaw(owl, deg):
    owl["root"].rotation_euler = (0, 0, math.radians(deg))


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 15
    # AgX по умолчанию выжигает насыщенность — палитра Mascot должна быть
    # узнаваемой (#f4a51a — жёлто-оранжевый, а не бежевый)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    # свет: key слева-сверху, fill справа, мягкий ambient (сонный тон — без GL)
    key = bpy.data.lights.new("key", "SUN")
    key.energy = 3.2
    key.angle = math.radians(24)
    ko = bpy.data.objects.new("key", key)
    scene.collection.objects.link(ko)
    ko.rotation_euler = (math.radians(56), 0, math.radians(-38))
    fill = bpy.data.lights.new("fill", "SUN")
    fill.energy = 1.1
    fo = bpy.data.objects.new("fill", fill)
    scene.collection.objects.link(fo)
    fo.rotation_euler = (math.radians(70), 0, math.radians(140))
    amb = bpy.data.lights.new("amb", "SUN")
    amb.energy = 0.7
    ao = bpy.data.objects.new("amb", amb)
    scene.collection.objects.link(ao)
    ao.rotation_euler = (math.radians(-40), 0, 0)

    # камера: фронт, чуть ниже центра (как svg-взгляд)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 58
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -6.2, 1.25)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam


def count_triangles():
    total = 0
    for ob in bpy.data.objects:
        if ob.type == "MESH":
            mesh = ob.data
            total += len(mesh.loop_triangles) if mesh.loop_triangles else len(mesh.polygons) * 2
    return total


def render_clip(owl, clip, kind, param, out_dir, samples):
    scene = bpy.context.scene
    scene.cycles.samples = samples
    os.makedirs(out_dir, exist_ok=True)
    n = 0
    if kind == "circle":
        for i in range(16):
            set_mood(owl, "idle")
            set_yaw(owl, i * 22.5)
            path = os.path.join(out_dir, f"{clip}-{i:02d}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            n += 1
    else:
        mood = param
        for i, angle in enumerate(FACE_ANGLES):
            set_mood(owl, mood)
            set_yaw(owl, angle)
            path = os.path.join(out_dir, f"{clip}-{i:02d}.png")
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
            n += 1
    return n


def main():
    ap = argparse.ArgumentParser(description="Рендер кадров БУКа (Blender headless)")
    ap.add_argument("--stage", default="all", choices=STAGES + ["all"])
    ap.add_argument("--frames-dir", default=None, help="куда кадры (default: images-src/buk/frames)")
    ap.add_argument("--blend", default=None, help="сохранить .blend (default: images-src/buk/model.blend)")
    ap.add_argument("--samples", type=int, default=8)
    ap.add_argument("--clips", default=None, help="список клипов через запятую (по умолчанию все)")
    args = ap.parse_args()

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frames_dir = args.frames_dir or os.path.join(root_dir, "images-src", "buk", "frames")
    blend_path = args.blend or os.path.join(root_dir, "images-src", "buk", "model.blend")
    stages = STAGES if args.stage == "all" else [args.stage]
    clips = CLIPS
    if args.clips:
        wanted = set(args.clips.split(","))
        clips = [c for c in CLIPS if c[0] in wanted]
        if not clips:
            sys.exit(f"клипы не найдены: {args.clips}")

    t0 = time.time()
    total = 0
    for stage_index, stage in enumerate(STAGES):
        if stage not in stages:
            continue
        clear_scene()
        setup_render()
        owl = build_owl(stage_index)
        tris = count_triangles()
        if tris > 5000:
            print(f"⚠ {stage}: {tris} треугольников > бюджета 5000 (§6.3)")
        else:
            print(f"· {stage}: {tris} треугольников")
        out_dir = os.path.join(frames_dir, stage)
        for clip, kind, param in clips:
            n = render_clip(owl, clip, kind, param, out_dir, args.samples)
            total += n
            print(f"  {stage}/{clip}: {n} кадров")
        # после всех клипов — исходник сцены для ручной доработки
        if args.stage == "all" or True:
            os.makedirs(os.path.dirname(blend_path), exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)

    dt = time.time() - t0
    print(f"✓ {total} кадров за {dt:.1f} с → {frames_dir}")
    if total == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
