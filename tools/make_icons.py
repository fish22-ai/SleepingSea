# -*- coding: utf-8 -*-
"""生成「睡前水族馆」的 PWA 图标 —— 16-bit 像素风（纯标准库，手写 PNG 编码）

思路：先在一个 32×32 的低分辨率网格上把整幅场景画出来（水体渐变 → 沙地 →
水草 → 小丑鱼 → 气泡），再按整数倍最近邻放大到目标尺寸。这样图标和 App 里的
鱼缸用的是同一套像素语言，不会出现「图标是扁平插画、应用是像素风」的割裂。

产出：
  icon-192.png            192 圆角，manifest "any"
  icon-512.png            512 圆角，manifest "any"
  icon-maskable-512.png   512 满幅，内容缩到 75%，四周用边缘像素延伸
  apple-touch-icon.png    192 满幅直角，iOS 加到主屏时用
"""
import zlib, struct, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
os.makedirs(OUT, exist_ok=True)

G = 32          # 低分辨率网格边长
SCENE = 32.0    # 场景坐标范围（与 G 一一对应）


# ================= PNG 编码 =================
def write_png(path, w, h, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)
        raw.extend(row)

    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


# ================= 颜色（与 js/aquarium.js 的 PAL_DAY 同源） =================
def h2(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


WATER = [h2(c) for c in ('#8ad8cf', '#75c6c0', '#65b6b1', '#55a3a2', '#458f95', '#2f6b7a')]
SAND, SAND_TOP, SAND_MOUND, SAND_DOT = h2('#f0dcae'), h2('#fff4cc'), h2('#e6cd97'), h2('#d3b478')
GRASS, GRASS_HI = h2('#63b544'), h2('#a3e06a')
FISH, FISH_HI, FISH_LO, FISH_FIN = h2('#f5843c'), h2('#ffb877'), h2('#ffd2a2'), h2('#e0672a')
BAND, EYE, GLINT, BUBBLE = h2('#fffaf2'), h2('#1b2430'), h2('#ffffff'), h2('#dff6f8')

SAND_LINE = 26.0          # 沙地平线
DIP_X0, DIP_X1 = 11.0, 22.0   # 这一段沙地往下凹 1 格，让画面不那么死板


def mix(a, b, t):
    if t <= 0.0:
        return a
    if t >= 1.0:
        return b
    return (a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t)


def clamp(v, lo, hi):
    return lo if v < lo else (hi if v > hi else v)


# ================= 几何 =================
def in_ellipse(dx, dy, rx, ry):
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0


def in_tri(px, py, ax, ay, bx, by, cx, cy):
    d1 = (px - cx) * (ay - cy) - (ax - cx) * (py - cy)
    d2 = (px - ax) * (by - ay) - (bx - ax) * (py - ay)
    d3 = (px - bx) * (cy - by) - (cx - bx) * (py - by)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


# ================= 场景元素 =================
BUBBLES = [(26.0, 4.0, 1.0), (23.5, 8.5, 0.6), (28.5, 6.5, 0.5), (22.5, 12.5, 0.42)]
BLADES = [(5, 3), (6, 5), (7, 2), (24, 4), (25, 6), (26, 3)]


def sand_top(x):
    return SAND_LINE + (1.0 if DIP_X0 <= x <= DIP_X1 else 0.0)


def water_color(y):
    t = clamp(y / SAND_LINE, 0.0, 1.0) * (len(WATER) - 1)
    i = int(t)
    return mix(WATER[i], WATER[min(i + 1, len(WATER) - 1)], t - i)


def blade_at(x, y):
    """返回水草颜色；不在水草上返回 None"""
    for bx, hb in BLADES:
        bx = float(bx)
        if not (bx <= x < bx + 1.0):
            continue
        top = sand_top(bx) - hb
        if top <= y < sand_top(bx):
            return GRASS_HI if y < top + 1.0 else GRASS
    return None


def fish_at(x, y):
    """返回小丑鱼的像素颜色；不在鱼身上返回 None"""
    # 身体：椭圆，朝右
    if in_ellipse(x - 15.6, y - 15.3, 7.2, 4.6):
        # 眼睛（含高光）
        if math.hypot(x - 20.2, y - 13.4) <= 0.55:
            return GLINT
        if math.hypot(x - 20.6, y - 13.9) <= 1.15:
            return EYE
        # 两道白色环带
        if 12.0 <= x < 14.0 or 17.0 <= x < 19.0:
            return BAND
        t = clamp((y - 10.7) / 9.2, 0.0, 1.0)
        col = mix(FISH_HI, FISH, clamp(t * 1.7, 0.0, 1.0))
        if t > 0.64:
            return mix(col, FISH_LO, (t - 0.64) / 0.36)
        return col
    # 尾巴
    if in_tri(x, y, 9.2, 15.3, 3.4, 10.6, 3.4, 20.0):
        return FISH_FIN
    # 背鳍
    if in_tri(x, y, 13.4, 11.8, 16.6, 8.0, 19.8, 11.6):
        return FISH_FIN
    # 胸鳍（从头部右下角探出来一点点）
    if in_tri(x, y, 20.0, 16.0, 23.6, 18.9, 19.8, 19.6):
        return mix(FISH_FIN, FISH, 0.52)
    return None


def bubble_at(x, y):
    for cx, cy, r in BUBBLES:
        d = math.hypot(x - cx, y - cy)
        if d <= r * 0.55:
            return mix(water_color(y), BUBBLE, 0.32)
        if d <= r:
            return BUBBLE
    return None


def paint(x, y):
    """场景坐标 (x, y) → RGB"""
    c = fish_at(x, y)
    if c:
        return c
    c = bubble_at(x, y)
    if c:
        return c
    c = blade_at(x, y)
    if c:
        return c
    st = sand_top(x)
    if y >= st:
        if y - st < 1.0:
            return SAND_TOP
        h = ((int(x) * 7919 + int(y) * 104729) % 100) / 100.0
        if h < 0.09:
            return SAND_DOT
        if h < 0.30:
            return SAND_MOUND
        return SAND
    return water_color(y)


# ================= 栅格化 =================
def build_grid():
    """32×32 低分辨率网格，每个格子取场景中心点的颜色"""
    grid = []
    for cy in range(G):
        row = []
        y = (cy + 0.5) / G * SCENE
        for cx in range(G):
            x = (cx + 0.5) / G * SCENE
            row.append(paint(x, y))
        grid.append(row)
    return grid


GRID = build_grid()


def rounded_alpha(u, v, radius):
    """u,v 是 0~1 的归一化坐标，返回 0~255 的圆角覆盖率"""
    lim = 0.5 - radius
    hx, hy = abs(u - 0.5), abs(v - 0.5)
    dx, dy = hx - lim, hy - lim
    if dx <= 0 or dy <= 0:
        return 255
    if dx * dx + dy * dy <= radius * radius:
        return 255
    return 0


def render_square(size, rounded, ss=4):
    """整数倍最近邻放大；rounded=True 时按 iOS 风格圆角裁切（4×4 超采样抗锯齿）"""
    step = size // G
    assert step * G == size, 'size 必须是 %d 的整数倍' % G
    radius = 0.222 if rounded else 0.0
    rows = []
    for py in range(size):
        row = bytearray()
        gy = py // step
        for px in range(size):
            r, g, b = GRID[gy][px // step]
            r, g, b = int(r), int(g), int(b)
            a = 255
            if rounded:
                cov = 0
                for oy in (0.25, 0.75):
                    for ox in (0.25, 0.75):
                        cov += rounded_alpha((px + ox) / size, (py + oy) / size, radius)
                a = cov // 4
            row.extend((r, g, b, a))
        rows.append(row)
    return rows


def render_maskable(size, cell=12):
    """满幅图标：场景按整数倍放大居中，四周不是拉伸边缘像素，而是让「缸」继续往外延伸
    （因为每个格子仍然在同一个 12px 网格上，整张图不会出现被拉长的条纹）。"""
    off = (size - cell * G) // 2
    cache = {}

    def cell_color(vcx, vcy):
        key = (vcx, vcy)
        c = cache.get(key)
        if c is None:
            x = (vcx + 0.5) / G * SCENE
            y = (vcy + 0.5) / G * SCENE
            r, g, b = paint(x, y)
            c = (int(r), int(g), int(b))
            cache[key] = c
        return c

    rows = []
    for py in range(size):
        vcy = (py - off) // cell
        row = bytearray()
        for px in range(size):
            r, g, b = cell_color((px - off) // cell, vcy)
            row.extend((r, g, b, 255))
        rows.append(row)
    return rows


if __name__ == '__main__':
    import time
    jobs = [
        ('icon-192.png', 192, 'round'),
        ('icon-512.png', 512, 'round'),
        ('apple-touch-icon.png', 192, 'square'),
        ('icon-maskable-512.png', 512, 'maskable'),
    ]
    for name, size, kind in jobs:
        t0 = time.time()
        if kind == 'maskable':
            rows = render_maskable(size)
        else:
            rows = render_square(size, rounded=(kind == 'round'))
        write_png(os.path.join(OUT, name), size, size, rows)
        print('written %-24s %4d  %.2fs' % (name, size, time.time() - t0))
