"""PWA 아이콘 생성. 실행: python3 scripts/make-icons.py

로고 파일을 따로 두지 않고 코드로 만든다 — 색이나 글자를 바꾸려면 여기만 고치면 된다.
maskable 대응: 글자를 캔버스의 45%로 잡아 안전영역(중앙 80%) 안에 들어오게 한다.
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

BG = (37, 99, 235)      # tailwind blue-600 — 헤더 색과 맞춘다
FG = (255, 255, 255)
TEXT = "청도"
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
OUT = Path(__file__).resolve().parent.parent / "public"


def render(size: int, path: Path) -> None:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    font = ImageFont.truetype(FONT, int(size * 0.45), index=8)  # index 8 = Bold
    left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
    draw.text(
        ((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top),
        TEXT,
        font=font,
        fill=FG,
    )

    img.save(path, "PNG", optimize=True)
    print(f"{path.name}  {size}x{size}  {path.stat().st_size:,}B")


for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    render(size, OUT / name)
