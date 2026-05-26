#!/usr/bin/env python3
"""
generate_placeholder_cards.py
──────────────────────────────
Generates placeholder card images (15.png through 75.png) inside /img/
so Sinapse can run immediately before you have real artwork.

Requirements: Pillow
  pip install Pillow

Usage:
  python generate_placeholder_cards.py
"""

from PIL import Image, ImageDraw, ImageFont
import os, random, math

IMG_DIR = "img"
os.makedirs(IMG_DIR, exist_ok=True)

W, H = 300, 420

# Concepts for placeholder cards
CONCEPTS = [
    "Fire","Water","Earth","Air","Light","Shadow","Time","Space","Mind","Soul",
    "Speed","Force","Silence","Sound","Memory","Dream","Fear","Joy","Chaos","Order",
    "Animal","Machine","Nature","City","Ocean","Mountain","Desert","Forest","Sky","Void",
    "Giant","Tiny","Ancient","Future","Cold","Heat","Life","Death","Truth","Illusion",
    "Metal","Wood","Stone","Glass","Crystal","Smoke","Ice","Lightning","Wind","Rain",
    "Child","Elder","Hero","Monster","God","Spirit","Ghost","Robot","Alien","Warrior",
    "Love","Hate","Peace","War","Art","Music","Science","Magic","Power","Wisdom",
]

PALETTES = [
    ('#0a0015','#7c3aed','#00e5ff'),
    ('#001020','#0891b2','#f472b6'),
    ('#100a00','#d97706','#fbbf24'),
    ('#0f1500','#16a34a','#86efac'),
    ('#15000a','#be185d','#fb7185'),
    ('#000f15','#0e7490','#67e8f9'),
]

def draw_card(number, label, bg, accent, text_col):
    img = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(img)

    # Background gradient effect (approximated with circles)
    for i in range(10, 0, -1):
        r = int(i * 30)
        alpha_hex = format(int(i * 12), '02x')
        x0, y0 = W//2 - r, H//2 - r
        x1, y1 = W//2 + r, H//2 + r
        try:
            d.ellipse([x0, y0, x1, y1], fill=accent + alpha_hex if len(accent)==7 else accent)
        except Exception:
            pass

    # Border
    margin = 12
    d.rounded_rectangle([margin, margin, W-margin, H-margin],
                        radius=20, outline=accent, width=2)

    # Inner decoration
    d.rounded_rectangle([margin+8, margin+8, W-margin-8, H-margin-8],
                        radius=14, outline=accent+'40', width=1)

    # Card number (top-left small)
    d.text((margin+16, margin+14), f"#{number}", fill=accent+'99', font=None)

    # Concept label (center, large)
    # Try to use a font; fallback to default
    try:
        from PIL import ImageFont
        font_big  = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except Exception:
        font_big  = ImageFont.load_default()
        font_small = font_big

    # Center text
    bbox = d.textbbox((0, 0), label, font=font_big)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (W - tw) // 2
    y = (H - th) // 2 - 10
    # Glow effect
    for offset in [(-2,0),(2,0),(0,-2),(0,2)]:
        d.text((x+offset[0], y+offset[1]), label, fill=accent+'80', font=font_big)
    d.text((x, y), label, fill=text_col, font=font_big)

    # Decorative dots
    cx, cy = W//2, H//2
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        px = cx + int(math.cos(rad) * 80)
        py = cy + int(math.sin(rad) * 80) + 30
        d.ellipse([px-3, py-3, px+3, py+3], fill=accent+'60')

    return img

# === CARD BACK (15.png) ===
img_back = Image.new('RGB', (W, H), '#050508')
d = ImageDraw.Draw(img_back)
d.rounded_rectangle([10,10,W-10,H-10], radius=20, outline='#7c3aed', width=2)
d.rounded_rectangle([18,18,W-18,H-18], radius=14, outline='#00e5ff40', width=1)

# Neural pattern on back
for i in range(30):
    x1 = random.randint(20, W-20)
    y1 = random.randint(20, H-20)
    x2 = random.randint(20, W-20)
    y2 = random.randint(20, H-20)
    d.line([x1,y1,x2,y2], fill='#7c3aed30', width=1)
    d.ellipse([x1-2,y1-2,x1+2,y1+2], fill='#00e5ff60')

# SINAPSE text on back
try:
    from PIL import ImageFont
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
except Exception:
    font_title = ImageFont.load_default()

title = "SINAPSE"
bbox = d.textbbox((0,0), title, font=font_title)
tx = (W - (bbox[2]-bbox[0])) // 2
ty = (H - (bbox[3]-bbox[1])) // 2
d.text((tx, ty), title, fill='#7c3aed', font=font_title)

img_back.save(f"{IMG_DIR}/15.png")
print("Generated: img/15.png (card back)")

# === FRONT CARDS (16.png – 75.png) ===
for i, n in enumerate(range(16, 76)):
    concept_idx = i % len(CONCEPTS)
    label = CONCEPTS[concept_idx]
    palette = PALETTES[i % len(PALETTES)]
    bg, accent, text_col = palette
    card = draw_card(n, label, bg, accent, text_col)
    path = f"{IMG_DIR}/{n}.png"
    card.save(path)
    print(f"Generated: {path}  [{label}]")

print(f"\nDone! {75-15+1} card images created in ./{IMG_DIR}/")
