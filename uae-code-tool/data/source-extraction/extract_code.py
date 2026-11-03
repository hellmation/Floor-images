import pdfplumber, json, re, sys, collections
U=sys.argv[1]; OUT=sys.argv[2]
pdf=pdfplumber.open(U)
AR=re.compile(r'[؀-ۿ]')
LEVELS={'عالي':'high','متوسط':'medium','منخفض':'low'}
GOLD=(0.68,0.51,0.23)

def kind(t):
    if AR.search(t): return 'R'
    if re.search(r'[A-Za-z0-9]',t): return 'L'
    return 'N'

def clean(s):
    s=re.sub(r'\s+',' ',s).strip()
    s=s.replace('لاًً','لاً')
    s=re.sub(r'لاً(?=[ء-ي])','لا',s)   # ligature artifact mid-word
    s=s.lstrip('•· ').strip()
    return s

def line_text(chars):
    toks=[c['text'] for c in sorted(chars,key=lambda c:c['x0']) if c['text']!='ـ']
    runs=[]
    for i,t in enumerate(toks):
        k=kind(t)
        if k=='N':
            j=i+1
            while j<len(toks) and toks[j].strip()=='': j+=1
            prev_k=runs[-1][0] if runs else None
            nxt_k=kind(toks[j]) if j<len(toks) else None
            if prev_k=='L' and nxt_k=='L' and t not in '()[]{}«»“”"': runs[-1][1].append(t); continue
            k='R'
        if runs and runs[-1][0]==k: runs[-1][1].append(t)
        else: runs.append([k,[t]])
    out=[]
    for k,ts in reversed(runs):
        out.append(''.join(ts) if k=='L' else ''.join(reversed(ts)))
    return clean(''.join(out))

def is_white(c): return tuple(c.get('non_stroking_color') or ())==(1.0,1.0,1.0)
def is_gold(c):
    col=c.get('non_stroking_color') or ()
    return len(col)==3 and all(abs(col[i]-GOLD[i])<0.03 for i in range(3))
def is_bullet(c): return c['size']>=15 and is_gold(c) and c['text'].strip()=='' and 'Bold' not in c['fontname']

OVERLAPS=[]
def lines_from(chars, ytol=7):
    chars=sorted(chars,key=lambda c:c['top'])
    lines=[];cur=[];start=None
    for c in chars:
        if start is not None and c['top']-start>ytol: lines.append(cur); cur=[]; start=None
        if start is None: start=c['top']
        cur.append(c)
    if cur: lines.append(cur)
    for cs in lines:   # interleaving detector: two letters sharing the same x span on one line
        xs=sorted([c for c in cs if c['text'].strip() and c['width']>2],key=lambda c:c['x0'])
        for a,b in zip(xs,xs[1:]):
            if b['x0']<a['x0']+a['width']*0.5 and b['text']!=a['text']:
                OVERLAPS.append((round(cs[0]['top']),line_text(cs)[:60])); break
    res=[]
    for cs in lines:
        fonts=collections.Counter(c['fontname'].split('+')[-1] for c in cs)
        res.append(dict(top=min(c['top'] for c in cs),bottom=max(c['bottom'] for c in cs),
            x0=min(c['x0'] for c in cs),x1=max(c['x1'] for c in cs),
            size=max(c['size'] for c in cs),font=fonts.most_common(1)[0][0],
            bullet=any(is_bullet(c) for c in cs),
            text=line_text([c for c in cs if not is_bullet(c)])))
    return res

codes=[];subpillars={};cur=None;section=None;new_item=False;order=0
pending=None
for pi in range(11,74):
    p=pdf.pages[pi]; W=p.width/2
    for half,(xa,xb) in enumerate([(W,p.width),(0,W)]):
        allc=[c for c in p.chars if xa<=c['x0']<xb and 52<c['top']<p.height-45]
        split=xa+(xb-xa)*0.66
        # 1) headers (full width)
        full=lines_from([c for c in allc if not is_white(c)])
        hdr_ranges=[]
        for l in full:
            msub=re.fullmatch(r'([1-8])\.?(\d)\s*[:\s]\s*(.+)',l['text'])
            if msub: msub=re.fullmatch(r'(\S+)\s+(.+)',msub.group(1)+'.'+msub.group(2)+' '+msub.group(3))
            if l['size']>=20 or ('Black' in l['font'] and l['size']>=18):
                hdr_ranges.append((l['top']-1,l['bottom']+1))  # pillar intro / big titles
            elif msub and 'Bold' in l['font'] and l['size']>=16:
                subpillars.setdefault(msub.group(1),msub.group(2).strip(': '))
                hdr_ranges.append((l['top']-1,l['bottom']+1))
        def in_hdr(c): return any(a<=c['top']<=b for a,b in hdr_ranges)
        body_all=[c for c in allc if c['x0']<split and not is_white(c) and not in_hdr(c)]
        bullet_tops=[c['top'] for c in body_all if is_bullet(c)]
        body=[c for c in body_all if not is_bullet(c)]
        imp_white=[c for c in allc if c['x0']>=split and is_white(c)]
        highlights=[(l['top'],l['text']) for l in lines_from(imp_white) if l['text'] in LEVELS]
        first_id_top=min([l['top'] for l in lines_from(body) if re.fullmatch(r'(?:رقم الكود:\s*)?[1-8]\.\d+\.\d+',l['text'])] or [9999])
        if pending is not None and highlights and sorted(highlights)[0][0]<first_id_top-10:
            pending['impact']=LEVELS[sorted(highlights)[0][1]]; pending['impact_note']='impact box on following page'; highlights=sorted(highlights)[1:]
        pending=None
        hdr_tops=sorted(a for a,b in hdr_ranges)
        for l in lines_from(body):
            t=l['text']
            l['bullet']=any(l['top']-10<=bt<=l['top']-1 for bt in bullet_tops)
            while hdr_tops and hdr_tops[0]<l['top']: hdr_tops.pop(0); cur=None; section=None
            m=re.fullmatch(r'(?:رقم الكود:\s*)?([1-8]\.\d+\.\d+)',t)
            if m:
                cid=m.group(1); lev=None
                for top,txt in sorted(highlights):
                    if l['top']-15<=top<l['top']+85: lev=LEVELS[txt]; break
                order+=1
                cur=dict(id=cid,sub=cid.rsplit('.',1)[0],pillar=cid.split('.')[0],impact=lev,desc=[],req=[],crit=[],pdf_page=pi+1,half='RL'[half],order=order)
                codes.append(cur);section='desc';new_item=False
                if lev is None: pending=cur
                continue
            if cur is None: continue
            if 'GEAlma-Black' in l['font'] and re.search(r' - (أبوظبي|أبو ظبي|دبي|الشارقة|عجمان|أم القيوين|رأس الخيمة|الفجيرة)',t): continue  # photo caption
            if t=='' or re.fullmatch(r'[\u064B-\u0652\u0670\s]+',t): new_item=new_item or l['bullet']; continue
            if re.fullmatch(r'المتطلب(ات)?\s*:?',t): section='req'; new_item=True; continue
            if re.fullmatch(r'معيار الرصد\s*:?',t): section='crit'; new_item=True; continue
            lst=cur[section]
            if section=='desc' or new_item or l['bullet'] or not lst: lst.append(t)
            else: lst[-1]+=' '+t
            new_item=False
for c in codes: c['desc']=' '.join(c['desc'])
# dedupe exact duplicates, flag id collisions
seen={};final=[]
for c in codes:
    key=c['id']
    if key in seen:
        prev=seen[key]
        if prev['desc']==c['desc']: continue
        c['id_note']=f"PDF shows duplicate id {key}; assigned suffix"
        c['pdf_id']=key; c['id']=key+'b'
    else: c['pdf_id']=key
    seen[key]=c; final.append(c)
codes=final
json.dump(dict(codes=codes,subpillars=subpillars),open(OUT,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print('codes',len(codes),'subpillars',len(subpillars))
print('missing impact',[c['id'] for c in codes if not c['impact']])
print('no req',[c['id'] for c in codes if not c['req']],'no crit',[c['id'] for c in codes if not c['crit']])
print('per pillar',sorted(collections.Counter(c['pillar'] for c in codes).items()))
print('req counts',collections.Counter(len(c['req']) for c in codes),'crit counts',collections.Counter(len(c['crit']) for c in codes))
print('OVERLAPS',OVERLAPS)
print('suffixed',[c['id'] for c in codes if 'id_note' in c])
