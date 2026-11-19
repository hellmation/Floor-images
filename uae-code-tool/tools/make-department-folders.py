#!/usr/bin/env python3
"""Builds release/أدلة الإدارات - مجلدات الأكواد.zip: one folder per responsible department, and inside it one empty
folder per code named with the code number only (e.g. 2.1.1). The departments come from the tool's default mapping
(the first department of each code); re-run after the mapping changes."""
import collections, json, pathlib, re, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'app' / 'src' / 'data'
OUT = ROOT / 'release' / 'أدلة الإدارات - مجلدات الأكواد.zip'
TOP = 'كود الإمارات - أدلة الإدارات'
NONE = 'بدون إدارة مسؤولة - تحتاج تحديد'

master = json.loads((SRC / 'master.json').read_text(encoding='utf-8'))
seed = json.loads((SRC / 'departments-seed.json').read_text(encoding='utf-8'))
depts = {d['id']: d for d in seed['departments']}


def resolve(i):
    for _ in range(6):
        d = depts.get(i)
        if not d or not d.get('mergedInto'):
            break
        i = d['mergedInto']
    return i


safe = lambda s: re.sub(r'[\\/:*?"<>|]', ' ', s).strip().rstrip('. ')
key = lambda cid: [(int(re.match(r'\d+', x).group()), x) for x in cid.split('.')]   # ids such as 5.4.11b sort after 5.4.11
by = collections.defaultdict(list)
for c in master['codes']:
    m = seed['mapping'].get(c['id']) or []
    by[resolve(m[0]) if m else None].append(c['id'])

order = sorted(by, key=lambda k: (k is None, -len(by[k])))
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_STORED) as z:
    z.writestr(TOP + '/', '')
    for k in order:
        name = safe(depts[k]['name_ar']) if k else NONE
        z.writestr(f'{TOP}/{name}/', '')
        for cid in sorted(by[k], key=key):
            z.writestr(f'{TOP}/{name}/{cid}/', '')
        print(f'{len(by[k]):4d}  {name}')
print(f'{sum(len(v) for v in by.values())} code folders in {len(by)} department folders -> {OUT.name} ({OUT.stat().st_size // 1024} KB)')
