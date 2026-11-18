#!/usr/bin/env python3
"""Builds release/UAE-Code-Session.html: the awareness session deck for management and focal points.

One self-contained file (fonts and logo embedded). Every number on the slides is computed here from the
tool's own data, so re-running this script after the mapping changes refreshes the deck:

    python3 uae-code-tool/presentation/build.py
"""
import base64, collections, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'app' / 'src'
OUT = ROOT / 'release' / 'UAE-Code-Session.html'

master = json.loads((SRC / 'data/master.json').read_text(encoding='utf-8'))
seed = json.loads((SRC / 'data/departments-seed.json').read_text(encoding='utf-8'))
codes = master['codes']


def b64(rel):
    return base64.b64encode((SRC / rel).read_bytes()).decode()


def B(ar, en):
    """A bilingual run of text: both languages are in the page, CSS shows the active one."""
    return f'<span class="ar">{ar}</span><span class="en">{en}</span>'


# ---------- numbers ----------
N_P, N_S, N_C = len(master['pillars']), len(master['subpillars']), len(codes)
N_R = sum(len(c['requirements']) for c in codes)
pillars = []
for p in master['pillars']:
    cs = [c for c in codes if c['pillar'] == p['id']]
    pillars.append(dict(id=p['id'], ar=p['name_ar'], en=p['name_en'], codes=len(cs), reqs=sum(len(c['requirements']) for c in cs)))
max_reqs = max(p['reqs'] for p in pillars)
imp = collections.Counter(c.get('impact') or 'none' for c in codes)
dept_name = {d['id']: (d['name_ar'], d['name_en']) for d in seed['departments']}
primary = collections.Counter((seed['mapping'].get(c['id']) or ['-'])[0] for c in codes)
multi = sum(1 for c in codes if len(seed['mapping'].get(c['id']) or []) > 1)
depts = [dict(ar=dept_name[k][0], en=dept_name[k][1], n=v) for k, v in primary.most_common() if k != '-']
if primary.get('-'):
    depts.append(dict(ar='لم تُحدَّد بعد', en='Not yet assigned', n=primary['-'], none=True))
max_dept = max(d['n'] for d in depts)
pct = lambda n, d=N_C: round(n * 100 / d)
ex_sub = next(s for s in master['subpillars'] if s['id'] == '1.6')
ex_code = next(c for c in codes if c['id'] == '1.6.2')

# ---------- scenes ----------
S = []  # (title_ar, title_en, duration_ms, extra_class, html)


def scene(ar, en, dur, html, cls=''):
    S.append((ar, en, dur, cls, html))


def head(eye_ar, eye_en, h_ar, h_en, lead_ar='', lead_en=''):
    lead = f'<p class="lead a" style="--d:2">{B(lead_ar, lead_en)}</p>' if lead_ar else ''
    return f'<div class="eyebrow a" style="--d:0"><i></i>{B(eye_ar, eye_en)}</div><h2 class="h2 a" style="--d:1">{B(h_ar, h_en)}</h2>{lead}'


# 1 — opening
scene('من المعيار إلى الممارسة', 'From standard to practice', 9000, f'''
<div class="hero">
  <img class="lockup a fade" style="--d:0" alt="Federal Tax Authority" src="data:image/png;base64,{b64('assets/brand/fta-lockup-light.png')}">
  <div class="eyebrow a" style="--d:2"><i></i>{B('جلسة تعريفية · الإدارة وضباط الاتصال', 'Awareness session · Management and focal points')}</div>
  <h1 class="h1 a" style="--d:3">{B('كود الإمارات للخدمات الحكومية', 'The UAE Code for Government Services')}</h1>
  <div class="hrule a grow" style="--d:5"></div>
  <p class="lead a" style="--d:6">{B('من المعيار إلى الممارسة: كيف نمتثل معًا', 'From standard to practice: how we comply together')}</p>
  <p class="meta a fade" style="--d:8">{B('فريق تطوير الخدمات · مكتب دعم دافعي الضرائب · نوفمبر 2026', 'Service Development Team · Taxpayer Support Office · November 2026')}</p>
</div>''', 'center')

# 2 — what the Code is
scene('مرجعية اتحادية واحدة', 'One federal reference', 13000, head(
    'ما هو الكود؟', 'What is the Code?',
    'مرجعية اتحادية واحدة لجودة الخدمات', 'One federal reference for service quality',
    'وثيقة «كود الإمارات للخدمات الحكومية وتصفير البيروقراطية» صادرة عن وزارة شؤون مجلس الوزراء، واعتمدها مجلس الوزراء لتوحيد معايير تقديم الخدمات في الجهات الاتحادية.',
    'The “UAE Code for Government Services and Zero Bureaucracy” is issued by the Ministry of Cabinet Affairs and was adopted by the Cabinet to unify how federal entities deliver services.') + f'''
<div class="grid g3">
  <div class="card a" style="--d:4"><b class="k">01</b><h3>{B('جودة الخدمة', 'Service quality')}</h3><p>{B('معايير وطنية واضحة لما يجب أن تكون عليه الخدمة.', 'Clear national standards for what a service must be.')}</p></div>
  <div class="card a" style="--d:5"><b class="k">02</b><h3>{B('تبسيط الإجراءات', 'Simpler procedures')}</h3><p>{B('إلغاء ما لا يلزم من خطوات ومتطلبات ومستندات.', 'Removing steps, requirements and documents that are not needed.')}</p></div>
  <div class="card a" style="--d:6"><b class="k">03</b><h3>{B('تجربة المتعامل', 'Customer experience')}</h3><p>{B('رحلة متسقة عبر كل القنوات، رقمية وغير رقمية.', 'A consistent journey across every channel, digital or not.')}</p></div>
</div>
<p class="note a fade" style="--d:8">{B('عمليًا: الكود دليل تشغيل يصف كيف تدير الجهة خدماتها.', 'In practice: the Code is an operating manual for how an entity runs its services.')}</p>''')

# 3 — eight pillars
scene('ثمانية محاور', 'Eight pillars', 14000, head(
    'بنية الكود', 'How the Code is built',
    'ثمانية محاور، منظومة واحدة', 'Eight pillars, one system') + '<div class="grid g4 pillars">' + ''.join(
    f'<div class="card pill a" style="--d:{3 + i}"><b class="k">{p["id"]}</b><h3>{B(p["ar"], p["en"])}</h3><span class="tag">{p["codes"]} {B("كودًا", "codes")}</span></div>' for i, p in enumerate(pillars)) + '</div>')

# 4 — the language of the Code
scene('لغة الكود', 'The language of the Code', 16000, head(
    'تعريفات', 'Definitions',
    'لغة الكود: من المحور إلى المتطلب', 'From pillar to requirement') + f'''
<div class="ladder">
  <div class="rung a" style="--d:3"><span class="lv">{N_P}</span><div><h3>{B('المحور', 'Pillar')}</h3><p>{B('مجال رئيسي من مجالات تقديم الخدمة.', 'A main area of service delivery.')}</p><em>{B('مثال: 1 ·', 'Example: 1 ·')} {B(pillars[0]['ar'], pillars[0]['en'])}</em></div></div>
  <div class="rung a" style="--d:4"><span class="lv">{N_S}</span><div><h3>{B('المحور الفرعي', 'Sub-pillar')}</h3><p>{B('موضوع محدد داخل المحور.', 'A specific topic within a pillar.')}</p><em>{B('مثال: 1.6 ·', 'Example: 1.6 ·')} {B(ex_sub['name_ar'], ex_sub['name_en'])}</em></div></div>
  <div class="rung a" style="--d:5"><span class="lv">{N_C}</span><div><h3>{B('الكود', 'Code')}</h3><p>{B('التزام محدد يجب أن تحققه الجهة.', 'A specific commitment the entity must meet.')}</p><em>{B('مثال: 1.6.2 · إتاحة «سداد الإمارات UAE Pay» كأحد خيارات الدفع', 'Example: 1.6.2 · Offer UAE Pay as one of the payment options')}</em></div></div>
  <div class="rung key a" style="--d:6"><span class="lv">{N_R}</span><div><h3>{B('المتطلب', 'Requirement')}</h3><p>{B('ما يُفحص فعليًا. نجيب عنه: نعم، جزئي، لا، أو لا ينطبق.', 'What is actually checked. We answer: Yes, Partial, No, or Not applicable.')}</p><em>{B('هذه هي الوحدة التي نجيب عنها ونقدّم لها الدليل.', 'This is the unit we answer and provide evidence for.')}</em></div></div>
</div>
<div class="chips a fade" style="--d:8">
  <span><b>{B('مستوى الأثر', 'Impact level')}</b>{B('وزن الكود في النتيجة', 'the code’s weight in the score')}</span>
  <span><b>{B('الدليل', 'Evidence')}</b>{B('ما يثبت الإجابة', 'what proves the answer')}</span>
  <span><b>{B('الإدارة المسؤولة', 'Responsible department')}</b>{B('من يملك الدليل', 'who holds the evidence')}</span>
  <span><b>{B('الفجوة', 'Gap')}</b>{B('متطلب غير مستوفى', 'a requirement not yet met')}</span>
</div>''')

# 5 — why compliance matters
scene('لماذا الامتثال؟', 'Why compliance matters', 13000, head(
    'أهمية الامتثال', 'Why it matters',
    'الامتثال يُقاس بالدليل، لا بالانطباع', 'Compliance is measured by evidence, not by impression') + f'''
<div class="grid g4">
  <div class="card a" style="--d:3"><b class="k">01</b><h3>{B('معيار اتحادي معتمد', 'An adopted federal standard')}</h3><p>{B('الكود مرجعية معتمدة لكل الجهات الاتحادية، ونحن منها.', 'The Code is the adopted reference for all federal entities, including ours.')}</p></div>
  <div class="card a" style="--d:4"><b class="k">02</b><h3>{B('المتعامل يلمس النتيجة', 'The customer feels the result')}</h3><p>{B('كل متطلب يتحول إلى تجربة أبسط وأسرع وأوضح لدافع الضريبة.', 'Every requirement becomes a simpler, faster, clearer experience for the taxpayer.')}</p></div>
  <div class="card a" style="--d:5"><b class="k">03</b><h3>{B('نعرف موقعنا بالأرقام', 'We know where we stand, in numbers')}</h3><p>{B('التقييم الذاتي يعطينا نتيجة لكل محور ولكل إدارة.', 'Self-assessment gives us a score for every pillar and every department.')}</p></div>
  <div class="card a" style="--d:6"><b class="k">04</b><h3>{B('الفجوة تصبح خطة', 'A gap becomes a plan')}</h3><p>{B('ما لا نستوفيه اليوم يدخل خطط التحسين ومشاريع التطوير.', 'What we do not meet today feeds improvement plans and development projects.')}</p></div>
</div>''')

# 6 — the four totals
scene('الكود بالأرقام', 'The Code in numbers', 9000, f'''
<div class="eyebrow a" style="--d:0"><i></i>{B('الكود بالأرقام', 'The Code in numbers')}</div>
<div class="bignums">
  <div class="a" style="--d:1"><b class="count" data-to="{N_P}">0</b><span>{B('محاور', 'pillars')}</span></div>
  <div class="a" style="--d:3"><b class="count" data-to="{N_S}">0</b><span>{B('محورًا فرعيًا', 'sub-pillars')}</span></div>
  <div class="a" style="--d:5"><b class="count" data-to="{N_C}">0</b><span>{B('كودًا', 'codes')}</span></div>
  <div class="a key" style="--d:7"><b class="count" data-to="{N_R}">0</b><span>{B('متطلبًا', 'requirements')}</span></div>
</div>
<p class="lead center a" style="--d:10">{B('كل متطلب يحتاج إجابة، وكل «نعم» تحتاج دليلًا.', 'Every requirement needs an answer, and every “Yes” needs evidence.')}</p>''', 'center')

# 7 — weight by pillar
top = max(pillars, key=lambda p: p['reqs'])
scene('أين يقع الثقل؟', 'Where the weight sits', 14000, head(
    'تحليل الكود', 'Analysis',
    'أين يقع الثقل؟', 'Where the weight sits',
    f'عدد المتطلبات في كل محور. الأثقل: المحور {top["id"]} بـ{top["reqs"]} متطلبًا في {top["codes"]} كودًا.',
    f'Requirements per pillar. The heaviest is pillar {top["id"]}: {top["reqs"]} requirements across {top["codes"]} codes.') + '<div class="bars">' + ''.join(
    f'<div class="bar-row{" top" if p is top else ""} a" style="--d:{3 + i}"><span class="bl"><b>{p["id"]}</b>{B(p["ar"], p["en"])}</span><span class="bt"><i class="grow" style="--w:{p["reqs"] * 100 / max_reqs:.1f}%;--d:{4 + i}"></i></span><span class="bv">{p["reqs"]}<small>{p["codes"]} {B("كودًا", "codes")}</small></span></div>' for i, p in enumerate(pillars)) + '</div>')

# 8 — impact levels
scene('ليست كل الأكواد بالوزن نفسه', 'Not all codes weigh the same', 14000, head(
    'مستوى الأثر', 'Impact level',
    'ليست كل الأكواد بالوزن نفسه', 'Not all codes weigh the same') + f'''
<div class="stack a" style="--d:3">
  <i class="hi grow" style="flex:{imp['high']};--d:4"></i><i class="me grow" style="flex:{imp['medium']};--d:5"></i><i class="lo grow" style="flex:{imp['low'] + imp.get('none', 0)};--d:6"></i>
</div>
<div class="grid g3 impact">
  <div class="a" style="--d:5"><b class="num hi count" data-to="{imp['high']}">0</b><h3>{B('أثر عالٍ', 'High impact')} · {pct(imp['high'])}%</h3><p>{B('30 نقطة لكل متطلب', '30 points per requirement')}</p></div>
  <div class="a" style="--d:6"><b class="num me count" data-to="{imp['medium']}">0</b><h3>{B('أثر متوسط', 'Medium impact')} · {pct(imp['medium'])}%</h3><p>{B('20 نقطة لكل متطلب', '20 points per requirement')}</p></div>
  <div class="a" style="--d:7"><b class="num lo count" data-to="{imp['low']}">0</b><h3>{B('أثر منخفض', 'Low impact')} · {pct(imp['low'])}%</h3><p>{B('10 نقاط لكل متطلب', '10 points per requirement')}</p></div>
</div>
<div class="chips a fade" style="--d:9">
  <span><b>{B('نعم', 'Yes')}</b>{B('كامل النقاط', 'all the points')}</span>
  <span><b>{B('جزئي', 'Partial')}</b>{B('نصف النقاط', 'half the points')}</span>
  <span><b>{B('لا', 'No')}</b>{B('صفر', 'none')}</span>
  <span><b>{B('لا ينطبق', 'Not applicable')}</b>{B('خارج الحساب', 'left out of the score')}</span>
</div>''')

# 9 — distribution by department
scene('لكل إدارة نصيب', 'Every department has a share', 15000, head(
    'توزيع الأكواد', 'Distribution',
    'لكل إدارة نصيب', 'Every department has a share',
    'عدد الأكواد التي تكون الإدارة مسؤولة عنها، أي من يملك الدليل.',
    'The number of codes each department is responsible for, meaning who holds the evidence.') + '<div class="bars dept">' + ''.join(
    f'<div class="bar-row{" none" if d.get("none") else ""} a" style="--d:{3 + i * 0.6:.1f}"><span class="bl">{B(d["ar"], d["en"])}</span><span class="bt"><i class="grow" style="--w:{max(d["n"] * 100 / max_dept, 0.8):.1f}%;--d:{4 + i * 0.6:.1f}"></i></span><span class="bv">{d["n"]}<small>{pct(d["n"])}%</small></span></div>' for i, d in enumerate(depts)) + '</div>')

# 10 — the turn
scene('لا أحد يمتثل وحده', 'No one complies alone', 11000, f'''
<svg class="web a fade" style="--d:0" viewBox="0 0 800 420" aria-hidden="true"><g id="webg"></g></svg>
<div class="turn">
  <div class="a" style="--d:2"><b class="mega count" data-to="{multi}">0</b><span class="of">{B(f'من {N_C} كودًا', f'of {N_C} codes')}</span></div>
  <h2 class="h2 a" style="--d:5">{B('تحتاج أكثر من إدارة واحدة', 'need more than one department')}</h2>
  <div class="hrule a grow" style="--d:6"></div>
  <p class="lead a" style="--d:7">{B(f'{pct(multi)}% من الكود لا تستطيع إدارة واحدة أن تستوفيه وحدها.', f'{pct(multi)}% of the Code cannot be met by any single department on its own.')}</p>
</div>''', 'center')

# 11 — evidence
scene('ما الذي يُعدّ دليلًا؟', 'What counts as evidence', 15000, head(
    'الدليل', 'Evidence',
    'الدليل ثلاثة أجزاء', 'Evidence has three parts') + f'''
<div class="steps3">
  <div class="card a" style="--d:3"><b class="k">1</b><h3>{B('وثيقة منظِّمة', 'A governing document')}</h3><p>{B('سياسة، إجراء عمل، قانون، دليل، عملية أو إجراء يوضح كيف يُنفَّذ المطلوب.', 'A policy, SOP, law, guide, process or procedure that says how it is done.')}</p></div>
  <div class="card a" style="--d:5"><b class="k">2</b><h3>{B('إثبات التنفيذ الفعلي', 'Proof of execution')}</h3><p>{B('سجلات، تقارير نظام، لقطات شاشة مؤرخة، محاضر.', 'Records, system reports, dated screenshots, minutes.')}</p></div>
  <div class="card a" style="--d:7"><b class="k">3</b><h3>{B('مراقبة جودة التنفيذ', 'Quality monitoring')}</h3><p>{B('مؤشرات، تقارير متابعة، نتائج تدقيق أو استطلاع.', 'Indicators, follow-up reports, audit or survey results.')}</p></div>
</div>
<div class="grid g2 a fade" style="--d:9">
  <p class="note">{B('الأدلة تُحفظ في مجلد الكود على المجلد المشترك، ويوضع الرابط فقط في الأداة.', 'Evidence is saved in the code’s folder on the shared drive; only the link goes into the tool.')}</p>
  <p class="note warn">{B('الخطط والنوايا والتأكيد الشفهي ليست دليلًا.', 'Plans, intentions and verbal confirmation are not evidence.')}</p>
</div>''')

# 12 — work plan
phases = [
    ('التجهيز', 'Preparation', 'الأداة، هيكل الكود، توزيع الأكواد على الإدارات والمقيّمين', 'The tool, the Code structure, codes distributed to departments and evaluators', 'done'),
    ('التقييم الذاتي', 'Self-assessment', 'المقيّمون يجيبون عن المتطلبات على دفعات أسبوعية', 'Evaluators answer the requirements in weekly batches', 'now'),
    ('جمع الأدلة', 'Evidence collection', 'ضباط الاتصال يوفّرون أدلة إداراتهم', 'Focal points supply their departments’ evidence', 'start'),
    ('المراجعة والاعتماد', 'Review and approval', 'التحقق من الإجابة والدليل، اعتماد أو إعادة', 'Checking answer and evidence, approving or returning', 'later'),
    ('عرض النتائج', 'Results', 'عرض النتائج ومراجعة الإدارة', 'Presenting the results and management review', 'later'),
    ('خطط التحسين', 'Improvement plans', 'تحويل الفجوات إلى توصيات ومشاريع تطوير', 'Turning gaps into recommendations and development projects', 'later'),
]
st = {'done': B('مكتمل', 'Done'), 'now': B('جارٍ', 'In progress'), 'start': B('يبدأ الآن', 'Starting now'), 'later': B('التالي', 'Next')}
scene('خطة العمل', 'The work plan', 16000, head(
    'خطة العمل', 'Work plan',
    'نعرف أين نحن، وإلى أين نتجه', 'We know where we are, and where we are going') + '<div class="timeline"><i class="tl a grow" style="--d:3"></i>' + ''.join(
    f'<div class="ph {s} a" style="--d:{4 + i}"><span class="dot"></span><span class="st">{st[s]}</span><h3>{i + 1}. {B(a, e)}</h3><p>{B(da, de)}</p></div>' for i, (a, e, da, de, s) in enumerate(phases)) + f'''</div>
<div class="grid g2 a fade" style="--d:11">
  <p class="note">{B('دفعة هذا الأسبوع (16–21 نوفمبر): 10 أكواد لكل مقيّم.', 'This week’s batch (16–21 November): 10 codes per evaluator.')}</p>
  <p class="note">{B('الموعد المستهدف لدورة خط الأساس 2026: 15 ديسمبر 2026.', 'Target date for the 2026 baseline cycle: 15 December 2026.')}</p>
</div>''')

# 13 — roles
roles = [
    ('المقيّم', 'Evaluator', 'فريق تطوير الخدمات', 'Service Development Team', 'يجيب عن متطلبات أكواده ويربط مجلد الأدلة.', 'Answers the requirements of their codes and links the evidence folder.'),
    ('ضابط الاتصال', 'Focal point', 'في كل إدارة', 'In every department', 'يوفّر أدلة إدارته ويوضّح الواقع الفعلي.', 'Supplies the department’s evidence and explains what actually happens.'),
    ('المراجع', 'Reviewer', 'فريق المشروع', 'Project team', 'يتحقق من الإجابة والدليل، فيعتمد أو يعيد.', 'Checks answer and evidence, then approves or returns.'),
    ('مدير المشروع', 'Project manager', 'فريق تطوير الخدمات', 'Service Development Team', 'يوزّع ويتابع ويعرض النتائج.', 'Distributes, follows up and presents the results.'),
    ('الإدارة', 'Management', 'القيادة', 'Leadership', 'تعتمد الخطة وتزيل العوائق وتراجع النتائج.', 'Endorses the plan, removes obstacles and reviews the results.'),
]
scene('من يفعل ماذا؟', 'Who does what', 14000, head(
    'الأدوار', 'Roles',
    'لكل دور مهمة واحدة واضحة', 'Each role has one clear job') + '<div class="grid g5">' + ''.join(
    f'<div class="card role{" key" if i == 1 else ""} a" style="--d:{3 + i}"><span class="tag">{B(wa, we)}</span><h3>{B(a, e)}</h3><p>{B(da, de)}</p></div>' for i, (a, e, wa, we, da, de) in enumerate(roles)) + '</div>')

# 14 — five asks
asks = [
    ('اعرف أكواد إدارتك', 'Know your department’s codes', 'راجع قائمة الأكواد المسندة إلى إدارتك.', 'Go through the list of codes assigned to your department.'),
    ('وفّر الدليل بأجزائه الثلاثة', 'Provide all three parts of the evidence', 'في مجلد الكود على المجلد المشترك.', 'In the code’s folder on the shared drive.'),
    ('قل الواقع كما هو', 'Say it as it is', '«لا» و«جزئي» إجابتان مفيدتان: الفجوة المعلنة تُعالج.', '“No” and “Partial” are useful answers: a declared gap gets fixed.'),
    ('ردّ على طلبات التوضيح في وقتها', 'Answer clarification requests on time', 'تأخر الرد يوقف اعتماد الكود.', 'A late reply holds up the code’s approval.'),
    ('بادر', 'Take the first step', 'بلّغ عن أي تغيير أو دليل جديد دون انتظار السؤال.', 'Report any change or new evidence without waiting to be asked.'),
]
scene('خمسة أشياء نطلبها منك', 'Five things we ask of you', 15000, head(
    'إلى ضباط الاتصال', 'To the focal points',
    'خمسة أشياء نطلبها منك', 'Five things we ask of you') + '<ol class="asks">' + ''.join(
    f'<li class="a" style="--d:{3 + i * 1.4:.1f}"><b>{i + 1}</b><div><h3>{B(a, e)}</h3><p>{B(da, de)}</p></div></li>' for i, (a, e, da, de) in enumerate(asks)) + '</ol>')

# 15 — the spirit
scene('تعاون، انسجام، استباقية', 'Cooperation, harmony, proactiveness', 15000, head(
    'روح العمل', 'How we work together',
    'تعاون، انسجام، استباقية', 'Cooperation, harmony, proactiveness') + f'''
<div class="grid g3 spirit">
  <div class="card a" style="--d:3"><h3>{B('التعاون', 'Cooperation')}</h3><p>{B('للكود الواحد إدارة مسؤولة وإدارات مساندة؛ كل منا يكمل دليل الآخر.', 'A code has a responsible department and supporting ones; each of us completes the other’s evidence.')}</p><em>{B('شارك ما لديك حتى لو لم تكن الإدارة المسؤولة.', 'Share what you have, even when you are not the responsible department.')}</em></div>
  <div class="card a" style="--d:5"><h3>{B('الانسجام', 'Harmony')}</h3><p>{B('لغة واحدة، مجلد واحد، موعد واحد.', 'One language, one folder, one deadline.')}</p><em>{B('نستخدم التعريفات نفسها ومكان الحفظ نفسه.', 'We use the same definitions and the same place to save.')}</em></div>
  <div class="card a" style="--d:7"><h3>{B('الاستباقية', 'Proactiveness')}</h3><p>{B('الفجوة التي نعلنها اليوم أسهل من التي تُكتشف غدًا.', 'A gap we declare today is easier than one discovered tomorrow.')}</p><em>{B('ارفع الفجوة مبكرًا ومعها مقترح المعالجة.', 'Raise the gap early, with a proposed fix.')}</em></div>
</div>''')

# 16 — from gaps to enhancement
flow = [('تقييم ذاتي', 'Self-assessment'), ('فجوة موثّقة', 'Documented gap'), ('توصية وخطة تحسين', 'Recommendation and plan'), ('مشروع تطوير', 'Development project'), ('إعادة القياس', 'Measure again')]
scene('من الفجوة إلى التطوير', 'From gap to improvement', 13000, head(
    'الغاية', 'The purpose',
    'هدفان: نعرف نتيجتنا، ونحوّل الفجوات إلى تطوير', 'Two aims: know our score, and turn gaps into improvement') + '<div class="flow">' + ''.join(
    f'<div class="fstep a" style="--d:{3 + i * 1.3:.1f}"><b>{i + 1}</b><span>{B(a, e)}</span></div>' + ('<i class="farrow a grow" style="--d:%.1f"></i>' % (3.6 + i * 1.3) if i < len(flow) - 1 else '') for i, (a, e) in enumerate(flow)) + f'''</div>
<p class="note a fade" style="--d:11">{B('التقييم ليس غاية بذاته: نتائجه تغذي خطط التحسين ومشاريع فريق التطوير، ثم نقيس من جديد في الدورة التالية.', 'The assessment is not the goal: its results feed improvement plans and the development team’s projects, and we measure again in the next cycle.')}</p>''')

# 17 — close
scene('الخطوات القادمة', 'Next steps', 12000, f'''
<div class="hero">
  <div class="eyebrow a" style="--d:0"><i></i>{B('الخطوات القادمة', 'Next steps')}</div>
  <h1 class="h1 a" style="--d:1">{B('خيط واحد، وأيدٍ كثيرة', 'One thread, many hands')}</h1>
  <div class="hrule a grow" style="--d:3"></div>
  <ol class="next">
    <li class="a" style="--d:4"><b>1</b>{B('استلم قائمة أكواد إدارتك.', 'Receive your department’s list of codes.')}</li>
    <li class="a" style="--d:5"><b>2</b>{B('ارفع الأدلة في مجلد كل كود على المجلد المشترك.', 'Upload the evidence to each code’s folder on the shared drive.')}</li>
    <li class="a" style="--d:6"><b>3</b>{B('متابعة أسبوعية حتى 15 ديسمبر 2026.', 'Weekly follow-up until 15 December 2026.')}</li>
  </ol>
  <p class="meta a fade" style="--d:8">{B('شكرًا لكم · فريق تطوير الخدمات', 'Thank you · Service Development Team')}</p>
</div>''', 'center')

scenes_html = ''.join(
    f'<section class="scene {cls}" id="s{i + 1}" data-ar="{ar}" data-en="{en}" data-dur="{dur}"><i class="vthread"></i><div class="in">{html}</div></section>'
    for i, (ar, en, dur, cls, html) in enumerate(S))

fonts = ''.join(
    f"@font-face{{font-family:'Tajawal';font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b64(f'assets/fonts/tajawal-arabic-{w}.woff2')}) format('woff2')}}"
    for w in (400, 500, 700)) + f"@font-face{{font-family:'Inter';font-weight:400 700;font-display:swap;src:url(data:font/woff2;base64,{b64('assets/fonts/Inter-latin.woff2')}) format('woff2')}}"

page = (pathlib.Path(__file__).parent / 'template.html').read_text(encoding='utf-8')
page = page.replace('/*FONTS*/', fonts).replace('<!--SCENES-->', scenes_html).replace('{{EMBLEM}}', b64('assets/brand/fta-emblem.png')).replace('{{COUNT}}', str(len(S)))
OUT.write_text(page, encoding='utf-8')
print(f'{OUT.relative_to(ROOT.parent)}  {len(S)} scenes  {OUT.stat().st_size // 1024} KB')
print(f'numbers: {N_P} pillars, {N_S} sub-pillars, {N_C} codes, {N_R} requirements; multi-department codes {multi} ({pct(multi)}%)')
