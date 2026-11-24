# Setzt das Blue-Moth-Icon als Android-Launcher-Icon (läuft nach "cap add android").
import os
from PIL import Image
src = Image.open('moth_icon.png').convert('RGBA')
base = 'android/app/src/main/res'
dens = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
for d, (legacy, fg) in dens.items():
    folder = f'{base}/mipmap-{d}'
    if not os.path.isdir(folder): continue
    canvas = Image.new('RGBA', (fg, fg), (0, 0, 0, 0)); s = int(fg * 0.58)
    canvas.paste(src.resize((s, s), Image.LANCZOS), ((fg - s) // 2, (fg - s) // 2), src.resize((s, s), Image.LANCZOS))
    canvas.save(f'{folder}/ic_launcher_foreground.png')
    for n in ('ic_launcher.png', 'ic_launcher_round.png'):
        bg = Image.new('RGBA', (legacy, legacy), (7, 19, 52, 255)); s2 = int(legacy * 0.8); ic = src.resize((s2, s2), Image.LANCZOS)
        bg.paste(ic, ((legacy - s2) // 2, (legacy - s2) // 2), ic); bg.save(f'{folder}/{n}')
bgx = f'{base}/values/ic_launcher_background.xml'
if os.path.exists(bgx):
    open(bgx, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#071334</color>\n</resources>\n')
print('Icons gesetzt')
