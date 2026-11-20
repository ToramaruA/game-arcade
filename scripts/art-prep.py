#!/usr/bin/env python3
"""企画の ChatGPT が描いた絵（ブランチ art/<slug> の art/<slug>/*.png）を、ゲームで使える形にする。

使い方:
  python3 scripts/art-prep.py <slug> [--branch art/<slug>] [--src <フォルダ>]

- ファイル名の頭で扱いを変える:
    char-*（キャラ）・prop-*（小物）・icon-* … 背景（白かマゼンタ一色）を透明にして切り抜く。長い辺 512px まで
    bg-*（背景）・title-*（一枚絵）      … 切り抜かない。長い辺 1600px まで
    sheet-*（キャラ表）                   … 参考用。ゲームには入れない（一覧画像にだけ載せる）
    それ以外                              … 切り抜かず、長い辺 1024px まで
- 出力: site/games/<slug>/art/<名前>.webp（品質 85）
- 確認用: test-results/<slug>/art-sheet.png（全部を実際の大きさの目安で並べた一覧。チェック柄が透明の部分）
元の大きな PNG はゲームには入れない（art/<slug> ブランチに残す）。
"""
import argparse
import io
import os
import subprocess
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CUT = ('char-', 'prop-', 'icon-')
BIG = ('bg-', 'title-')


def git_files(branch, folder):
    out = subprocess.run(['git', 'ls-tree', '--name-only', f'{branch}:{folder}'], cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f'{branch} の {folder} が見つからない（git fetch origin {branch} をしたか確認）')
    return [n for n in out.stdout.split() if n.lower().endswith('.png')]


def git_read(branch, path):
    return subprocess.run(['git', 'show', f'{branch}:{path}'], cwd=ROOT, capture_output=True, check=True).stdout


def cut_background(im, tol=38):
    """外側から続く「背景色に近い色」だけを透明にする（キャラの中の白は消さない）。"""
    rgba = np.array(im.convert('RGBA')).astype(np.int16)
    h, w = rgba.shape[:2]
    if rgba[..., 3].min() < 250:  # もともと透明がある
        return Image.fromarray(rgba.astype(np.uint8), 'RGBA')
    corners = np.array([rgba[0, 0, :3], rgba[0, -1, :3], rgba[-1, 0, :3], rgba[-1, -1, :3]])
    bg = np.median(corners, axis=0)
    dist = np.abs(rgba[..., :3] - bg).max(axis=2)
    near = dist <= tol
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    # 縁を少しだけなじませる（背景と接する1px を半透明に、背景色のにじみを弱める）
    edge = (~seen) & (np.roll(seen, 1, 0) | np.roll(seen, -1, 0) | np.roll(seen, 1, 1) | np.roll(seen, -1, 1))
    alpha[edge] = np.clip(dist[edge] * 255 // max(tol * 3, 1), 80, 255).astype(np.uint8)
    out = rgba.astype(np.uint8)
    out[..., 3] = alpha
    return Image.fromarray(out, 'RGBA')


def fit(im, limit):
    s = min(1.0, limit / max(im.size))
    return im if s >= 1 else im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def checker(w, h, cell=12):
    bg = Image.new('RGB', (w, h), (235, 235, 235))
    d = ImageDraw.Draw(bg)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if (x // cell + y // cell) % 2:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(205, 205, 205))
    return bg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug')
    ap.add_argument('--branch', default=None)
    ap.add_argument('--src', default=None, help='ブランチではなく手元のフォルダから読む')
    a = ap.parse_args()
    branch = a.branch or f'origin/art/{a.slug}'
    if not a.src and not a.branch:
        # 企画側が入れたブランチを取ってくる（なければ、そのまま下で分かりやすく止まる）
        subprocess.run(['git', 'fetch', '-q', 'origin', f'refs/heads/art/{a.slug}:refs/remotes/origin/art/{a.slug}'], cwd=ROOT)
    out_dir = os.path.join(ROOT, 'site', 'games', a.slug, 'art')
    os.makedirs(out_dir, exist_ok=True)
    if a.src:
        names = sorted(n for n in os.listdir(a.src) if n.lower().endswith('.png'))
        read = lambda n: open(os.path.join(a.src, n), 'rb').read()
    else:
        names = sorted(git_files(branch, f'art/{a.slug}'))
        read = lambda n: git_read(branch, f'art/{a.slug}/{n}')
    if not names:
        sys.exit('PNG が1枚もない')
    shown = []
    for n in names:
        base = os.path.splitext(n)[0]
        im = Image.open(io.BytesIO(read(n)))
        if base.startswith('sheet-'):
            shown.append((base + '（参考・ゲームに入れない）', fit(im.convert('RGBA'), 360)))
            continue
        if base.startswith(CUT):
            im = cut_background(im)
            box = im.getchannel('A').getbbox()
            if box:
                im = im.crop(box)
            im = fit(im, 512)
        elif base.startswith(BIG):
            im = fit(im.convert('RGB'), 1600)
        else:
            im = fit(im.convert('RGBA'), 1024)
        path = os.path.join(out_dir, base + '.webp')
        im.save(path, 'WEBP', quality=85, method=6)
        kb = os.path.getsize(path) // 1024
        print(f'{n} → site/games/{a.slug}/art/{base}.webp（{im.width}×{im.height}, {kb}KB）')
        shown.append((f'{base} {im.width}x{im.height} {kb}KB', fit(im.convert('RGBA'), 360)))
    # 一覧画像
    pad = 16; cw = 380; ch = 400; cols = 3
    rows = (len(shown) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw + pad, rows * ch + pad), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(shown):
        x = pad + (i % cols) * cw; y = pad + (i // cols) * ch
        bg = checker(cw - pad, ch - pad - 24)
        bg.paste(im, ((bg.width - im.width) // 2, (bg.height - im.height) // 2), im)
        sheet.paste(bg, (x, y + 24))
        d.text((x, y + 4), label, fill=(40, 40, 40))
    res = os.path.join(ROOT, 'test-results', a.slug)
    os.makedirs(res, exist_ok=True)
    sheet.save(os.path.join(res, 'art-sheet.png'))
    print(f'一覧：test-results/{a.slug}/art-sheet.png（開いて、切り抜き・大きさ・同じキャラに見えるかを確かめる）')


if __name__ == '__main__':
    main()
