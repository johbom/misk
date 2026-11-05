# Ritar appikonen: en ring med åtta färgade sektorer och tomt hål i mitten (som formationen Ring).
# Kör: python3 tools/make_icons.py icons
import math, struct, zlib, sys

PALETTE = ['#e5484d', '#f5c518', '#3fb950', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#14b8a6']
BG = (18, 19, 26)
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
COLORS = [hexrgb(c) for c in PALETTE]

def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)

def sample(x, y, size, ring_scale, rounded):
    """RGBA för en punkt (x, y i px)."""
    c = size / 2
    # bakgrund: rundad kvadrat (eller full kvadrat)
    if rounded:
        rad = size * 0.22
        dx = max(rad - x, 0, x - (size - rad)); dy = max(rad - y, 0, y - (size - rad))
        if dx * dx + dy * dy > rad * rad:
            return (0, 0, 0, 0)
    R = size * 0.5 * ring_scale
    r0 = R * 0.42
    gap = size * 0.028
    px, py = x - c, y - c
    d = math.hypot(px, py)
    if r0 <= d <= R:
        n = 8
        step = 2 * math.pi / n
        a = (math.atan2(py, px) + math.pi / 2 + step / 2) % (2 * math.pi)  # 0 vid sektor 1:s vänsterkant
        k = int(a // step)
        rel = a - k * step
        edge = min(rel, step - rel)
        if d * math.sin(edge) >= gap / 2:
            col = COLORS[k]
            t = (d - r0) / (R - r0)  # mörkare inåt, ljusare utåt
            f = 0.72 + 0.28 * t
            return tuple(int(v * f) for v in col) + (255,)
    return BG + (255,)

def render(path, size, ring_scale, rounded, ss=3):
    rows = []
    for j in range(size):
        row = []
        for i in range(size):
            acc = [0, 0, 0, 0]
            for sj in range(ss):
                for si in range(ss):
                    r, g, b, a = sample(i + (si + 0.5) / ss, j + (sj + 0.5) / ss, size, ring_scale, rounded)
                    acc[0] += r * a; acc[1] += g * a; acc[2] += b * a; acc[3] += a
            n = ss * ss
            if acc[3]:
                row += [round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(acc[3] / n)]
            else:
                row += [0, 0, 0, 0]
        rows.append(row)
    write_png(path, size, size, rows)
    print('wrote', path)

out = sys.argv[1]
render(f'{out}/icon-192.png', 192, 0.78, True)
render(f'{out}/icon-512.png', 512, 0.78, True)
render(f'{out}/icon-maskable-512.png', 512, 0.62, False)   # inom säkra zonen (80 %)
render(f'{out}/apple-touch-icon.png', 180, 0.74, False)    # iOS rundar hörnen själv
render(f'{out}/favicon-32.png', 32, 0.9, True, ss=4)

# SVG-favicon med samma form
def svg():
    size = 64; c = 32; R = 32 * 0.92; r0 = R * 0.42; g = 2.2
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">',
             f'<rect width="64" height="64" rx="14" fill="#12131a"/>']
    for k, col in enumerate(PALETTE):
        a0 = -math.pi / 2 + (k - 0.5) * math.pi / 4; a1 = a0 + math.pi / 4
        ins = lambda r: min(math.asin(min(1, g / 2 / r)), math.pi / 8 * 0.95)
        pts = []
        for s in range(9):
            a = a0 + ins(R) + (a1 - ins(R) - a0 - ins(R)) * s / 8; pts.append((c + R * math.cos(a), c + R * math.sin(a)))
        for s in range(9):
            a = a1 - ins(r0) - (a1 - ins(r0) - a0 - ins(r0)) * s / 8; pts.append((c + r0 * math.cos(a), c + r0 * math.sin(a)))
        parts.append(f'<polygon fill="{col}" points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts) + '"/>')
    parts.append('</svg>')
    open(f'{out}/icon.svg', 'w').write(''.join(parts))
    print('wrote icon.svg')
svg()
