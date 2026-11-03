import json,sys,html
d=json.load(open(sys.argv[1])); OUT=sys.argv[2]
data=json.dumps(d,ensure_ascii=False).replace('</','<\\/')
page=r'''<title>UAE Code Master Dataset</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: sticky filter bar over a single reading column; each code is a two-column AR | EN card. */
:root{--bg:#faf8f3;--surface:#ffffff;--fg:#1f1b16;--muted:#6b6257;--line:#e3dccf;--accent:#a8822f;--accent-ink:#fff;--soft:#f3ecdd;
--high:#9a3b2e;--med:#b7791f;--low:#4f7a4a;--flag:#8a2f6e;
--display:'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif;--body:'IBM Plex Sans','IBM Plex Sans Arabic',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#171410;--surface:#201c16;--fg:#efe9df;--muted:#a69c8e;--line:#352f27;--accent:#d2a654;--accent-ink:#1a1408;--soft:#2a241b;--high:#e07a6a;--med:#e0a94a;--low:#8fc08a;--flag:#d98ac4;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171410;--surface:#201c16;--fg:#efe9df;--muted:#a69c8e;--line:#352f27;--accent:#d2a654;--accent-ink:#1a1408;--soft:#2a241b;--high:#e07a6a;--med:#e0a94a;--low:#8fc08a;--flag:#d98ac4;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--body);line-height:1.5;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.wrap{max-width:1180px;margin:0 auto}
header{padding-block:28px 12px;border-bottom:2px solid var(--accent)}
h1{font-family:var(--display);font-size:1.6rem;margin:0 0 4px;text-wrap:balance}
.sub{color:var(--muted);margin:0;font-size:.95rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:16px 0}
.tile{background:var(--surface);border:1px solid var(--line);padding:10px 12px;border-radius:6px}
.tile b{display:block;font-size:1.5rem;font-variant-numeric:tabular-nums;font-weight:600}
.tile span{font-size:.75rem;color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
.notes{background:var(--soft);border-inline-start:4px solid var(--flag);padding:10px 14px;border-radius:4px;font-size:.9rem;margin:8px 0 16px}
.notes ul{margin:6px 0 0;padding-inline-start:20px}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);padding-block:10px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bar select,.bar input{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:4px;background:var(--surface);color:var(--fg);min-width:0}
.bar input{flex:1 1 200px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:4px;overflow:hidden}
.seg button{font:inherit;background:var(--surface);color:var(--fg);border:0;padding:6px 10px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink)}
.count{color:var(--muted);font-size:.85rem;margin-inline-start:auto}
h2.pillar{font-family:var(--display);font-size:1.25rem;margin:28px 0 4px;padding-top:8px}
h2.pillar small{display:block;font-weight:400;color:var(--muted);font-size:.9rem}
h3.subp{font-family:var(--display);font-size:1rem;color:var(--accent);margin:18px 0 8px}
.code{background:var(--surface);border:1px solid var(--line);border-radius:6px;margin:0 0 10px;padding:12px 14px}
.head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.id{font-family:var(--mono);font-weight:500;background:var(--soft);padding:2px 8px;border-radius:4px}
.pill{font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid currentColor}
.pill.high{color:var(--high)}.pill.medium{color:var(--med)}.pill.low{color:var(--low)}.pill.none{color:var(--flag);border-style:dashed}
.flag{font-size:.75rem;color:var(--flag)}
.pg{font-size:.75rem;color:var(--muted);margin-inline-start:auto}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.cols>div{min-width:0}
.ar{direction:rtl;text-align:right;font-family:var(--display)}
.en{direction:ltr;text-align:left}
.desc{margin:0 0 8px}
.lbl{font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:8px 0 2px}
ol{margin:0;padding-inline-start:20px}
li{margin:2px 0}
.ar .lbl{letter-spacing:0;text-transform:none;font-size:.8rem}
body[data-lang="ar"] .en,body[data-lang="en"] .ar{display:none}
body[data-lang="ar"] .cols,body[data-lang="en"] .cols{grid-template-columns:1fr}
@media (max-width:700px){.cols{grid-template-columns:1fr}}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>
<div class="wrap">
<header>
<h1>UAE Code for Government Services · master dataset for review</h1>
<p class="sub">كود الإمارات للخدمات الحكومية وتصفير البيروقراطية — extracted from the official PDF, with an unofficial English translation. Verify against the PDF page shown on each card.</p>
<div class="tiles" id="tiles"></div>
<div class="notes" id="notes"></div>
</header>
<div class="bar">
<select id="fPillar" aria-label="Pillar"></select>
<select id="fImpact" aria-label="Impact"><option value="">All impact levels</option><option value="high">High · عالي</option><option value="medium">Medium · متوسط</option><option value="low">Low · منخفض</option><option value="none">Not specified</option></select>
<input id="fText" type="search" placeholder="Search code id or text / بحث">
<div class="seg" role="group" aria-label="Language"><button id="lBoth" aria-pressed="true">AR + EN</button><button id="lAr" aria-pressed="false">عربي</button><button id="lEn" aria-pressed="false">English</button></div>
<span class="count" id="count"></span>
</div>
<main id="list"></main>
</div>
<script id="data" type="application/json">__DATA__</script>
<script>
const D=JSON.parse(document.getElementById('data').textContent);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IM={high:'عالي · High',medium:'متوسط · Medium',low:'منخفض · Low'};
const subsOf={};D.subpillars.forEach(s=>subsOf[s.id]=s);
const tiles=document.getElementById('tiles');
const nReq=D.codes.reduce((a,c)=>a+c.requirements.length,0),nCrit=D.codes.reduce((a,c)=>a+c.criteria.length,0);
const byImp={high:0,medium:0,low:0,none:0};D.codes.forEach(c=>byImp[c.impact||'none']++);
[['Pillars',D.pillars.length],['Sub-pillars',D.subpillars.length],['Codes',D.codes.length],['Requirements',nReq],['Criteria',nCrit],['High impact',byImp.high],['Medium',byImp.medium],['Low',byImp.low]].forEach(([k,v])=>{tiles.insertAdjacentHTML('beforeend',`<div class="tile"><b>${v}</b><span>${k}</span></div>`)});
const flagged=D.codes.filter(c=>c.flags&&c.flags.length);
document.getElementById('notes').innerHTML='<strong>Known issues found in the PDF itself</strong><ul>'+flagged.map(c=>`<li><span class="id">${esc(c.id)}</span> page ${c.pdf_page}: ${c.flags.map(f=>f==='duplicate_id_in_pdf'?`the PDF prints the number ${esc(c.pdf_id)} twice; this second card carries a "b" suffix until you decide its final number`:'no impact level is highlighted in the PDF; treated as medium until an admin sets it').join('; ')}</li>`).join('')+'</ul>';
const fp=document.getElementById('fPillar');fp.innerHTML='<option value="">All pillars</option>'+D.pillars.map(p=>`<option value="${p.id}">${p.id} · ${esc(p.name_ar)} · ${esc(p.name_en||'')}</option>`).join('');
function card(c){const sp=subsOf[c.sub]||{};const imp=c.impact||'none';
 const req=(lang)=>c.requirements.map(r=>`<li>${esc(lang==='ar'?r.text_ar:r.text_en)}</li>`).join('');
 const crit=(lang)=>c.criteria.map(r=>`<li>${esc(lang==='ar'?r.text_ar:r.text_en)}</li>`).join('');
 return `<article class="code" data-p="${c.pillar}" data-i="${imp}" data-t="${esc((c.id+' '+c.desc_ar+' '+(c.desc_en||'')).toLowerCase())}">
 <div class="head"><span class="id">${esc(c.id)}</span><span class="pill ${imp}">${IM[imp]||'Impact not specified'}</span>${(c.flags||[]).length?'<span class="flag">⚑ see note above</span>':''}<span class="pg">PDF p.${c.pdf_page}</span></div>
 <div class="cols"><div class="ar"><p class="desc">${esc(c.desc_ar)}</p><div class="lbl">المتطلب</div><ol>${req('ar')}</ol><div class="lbl">معيار الرصد</div><ol>${crit('ar')}</ol></div>
 <div class="en"><p class="desc">${esc(c.desc_en||'')}</p><div class="lbl">Requirements</div><ol>${req('en')}</ol><div class="lbl">Monitoring criteria</div><ol>${crit('en')}</ol></div></div></article>`}
const list=document.getElementById('list');
let h='';D.pillars.forEach(p=>{h+=`<section data-p="${p.id}"><h2 class="pillar">المحور ${p.id} · ${esc(p.name_ar)}<small>${esc(p.name_en||'')} — ${esc(p.desc_en||'')}</small></h2>`;
 D.subpillars.filter(s=>s.pillar===p.id).forEach(s=>{h+=`<h3 class="subp" data-p="${p.id}">${esc(s.id)} ${esc(s.name_ar)} · ${esc(s.name_en||'')}</h3>`;D.codes.filter(c=>c.sub===s.id).forEach(c=>h+=card(c))});h+='</section>'});
list.innerHTML=h;
const cards=[...document.querySelectorAll('.code')];
function apply(){const p=fp.value,i=document.getElementById('fImpact').value,t=document.getElementById('fText').value.trim().toLowerCase();let n=0;
 cards.forEach(el=>{const ok=(!p||el.dataset.p===p)&&(!i||el.dataset.i===i)&&(!t||el.dataset.t.includes(t));el.hidden=!ok;if(ok)n++});
 document.querySelectorAll('section').forEach(s=>{s.hidden=!s.querySelector('.code:not([hidden])')});
 document.querySelectorAll('h3.subp').forEach(hh=>{let e=hh.nextElementSibling,any=false;while(e&&e.classList.contains('code')){if(!e.hidden)any=true;e=e.nextElementSibling}hh.hidden=!any});
 document.getElementById('count').textContent=n+' of '+cards.length+' codes'}
['fPillar','fImpact','fText'].forEach(id=>document.getElementById(id).addEventListener('input',apply));apply();
const segs={lBoth:'both',lAr:'ar',lEn:'en'};Object.entries(segs).forEach(([id,v])=>document.getElementById(id).addEventListener('click',()=>{document.body.dataset.lang=v;Object.keys(segs).forEach(k=>document.getElementById(k).setAttribute('aria-pressed',k===id));try{localStorage.setItem('lang',v)}catch(e){}}));
try{const v=localStorage.getItem('lang');if(v&&v!=='both'){document.getElementById(v==='ar'?'lAr':'lEn').click()}}catch(e){}
</script>'''
open(OUT,'w',encoding='utf-8').write(page.replace('__DATA__',data))
print('wrote',OUT,len(page)+len(data),'bytes')
