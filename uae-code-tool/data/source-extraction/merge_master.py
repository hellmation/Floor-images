import json,sys,os,glob
ar=json.load(open(sys.argv[1])); endir=sys.argv[2]; OUT=sys.argv[3]
en={}
for f in sorted(glob.glob(os.path.join(endir,'pillar_*.json'))):
    d=json.load(open(f))
    en[d['pillar']['id']]=d
missing=[]
for p in ar['pillars']:
    e=en.get(p['id'])
    if not e: missing.append('pillar '+p['id']); continue
    p['name_en']=e['pillar'].get('name_en'); p['desc_en']=e['pillar'].get('desc_en')
    subs={s['id']:s for s in e['subpillars']}
    for s in ar['subpillars']:
        if s['pillar']==p['id']: s['name_en']=subs.get(s['id'],{}).get('name_en') or missing.append('sub '+s['id'])
    codes={c['id']:c for c in e['codes']}
    for c in ar['codes']:
        if c['pillar']!=p['id']: continue
        ec=codes.get(c['id'])
        if not ec: missing.append('code '+c['id']); continue
        c['desc_en']=ec.get('desc_en')
        for lst in ('requirements','criteria'):
            for r,er in zip(c[lst],ec[lst]): r['text_en']=er.get('text_en')
json.dump(ar,open(OUT,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
print('missing',missing)
