#!/usr/bin/env python3
"""Unicode の文字名とブロック表を data/ に生成する。
使い方: pip install fonttools unicodedata2 && python3 tools/build_data.py
(unicodedata2 が無ければ標準の unicodedata を使う。収録バージョンは Python 依存)"""
import json, os
try:
    import unicodedata2 as ud
except ImportError:
    import unicodedata as ud
from fontTools.unicodedata import Blocks

out = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(out, exist_ok=True)

# --- ブロック ---
starts, names = Blocks.RANGES, Blocks.VALUES
blocks = []
for i, s in enumerate(starts):
    e = (starts[i + 1] - 1) if i + 1 < len(starts) else 0x10FFFF
    n = names[i]
    if n == 'No_Block' or 'Surrogates' in n or 'Private Use' in n:
        continue
    blocks.append([n, s, e])
with open(os.path.join(out, 'blocks.js'), 'w', encoding='utf-8') as f:
    f.write('window.BLOCKS=' + json.dumps(blocks, ensure_ascii=False, separators=(',', ':')) + ';\n')

# --- 文字名 (CJK統合漢字など「接頭辞-コード」型は範囲にまとめる) ---
lines, run = [], None  # run = [start, end, prefix]
def flush():
    global run
    if run:
        s, e, p = run
        if e > s: lines.append('%X..%X;%s' % (s, e, p))
        else: lines.append('%X;%s%04X' % (s, p, s))
    run = None
for cp in range(0x110000):
    try: n = ud.name(chr(cp))
    except ValueError: n = None
    h = '%04X' % cp
    if n and n.endswith('-' + h):
        p = n[:-len(h)]
        if run and run[2] == p and run[1] == cp - 1: run[1] = cp
        else: flush(); run = [cp, cp, p]
        continue
    flush()
    if n: lines.append('%X;%s' % (cp, n))
flush()
with open(os.path.join(out, 'names.js'), 'w', encoding='utf-8') as f:
    f.write('window.UNAMES=`' + '\n'.join(lines) + '`;\n')
print('Unicode', ud.unidata_version, '| blocks', len(blocks), '| name lines', len(lines))
