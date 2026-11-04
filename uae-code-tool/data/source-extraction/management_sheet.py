"""Builds the Arabic management workbook (ورقة متابعة التقييم) from the master dataset, the project list and the mapping seed.
Usage: python3 -I management_sheet.py <master.json> <projects.json> <mapping-seed.json> <out.xlsx> [answers_snapshot.json]"""
import json, sys, collections
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

master, projects, seed, out = sys.argv[1:5]
M = json.load(open(master, encoding='utf-8')); P = json.load(open(projects, encoding='utf-8')); S = json.load(open(seed, encoding='utf-8'))
snap = json.load(open(sys.argv[5], encoding='utf-8')) if len(sys.argv) > 5 else None

# ---- people, projects, mapping (same rules as the tool) ----
owner_of, pname, active = {}, {}, {}
for o in P['owners']:
    for p in o['projects']:
        pid = 'p%02d' % p['id']; pname[pid] = p['name_ar']; owner_of[pid] = None if o.get('removed') else o['name_ar']; active[pid] = not o.get('removed')
excl = S['excludeIfText']
mapping = collections.defaultdict(list)
for pid, p in S['projects'].items():
    for c in M['codes']:
        if c['sub'] in p['subs'] and not any(x in c['desc_ar'] for x in excl): mapping[c['id']].append(pid)
CORE = 'الفريق الأساسي (غير مُسند بعد)'
def assignee(cid):
    for pid in mapping.get(cid, []):
        if owner_of.get(pid): return owner_of[pid]
    return CORE
IMP = {'high': 'عالي', 'medium': 'متوسط', 'low': 'منخفض', None: 'غير محدد'}
pillars = {p['id']: p for p in M['pillars']}; subs = {s['id']: s for s in M['subpillars']}

# ---- styles ----
GOLD = 'A7812D'; hdr_fill = PatternFill('solid', fgColor=GOLD); hdr_font = Font(bold=True, color='FFFFFF', name='Arial', size=10)
body_font = Font(name='Arial', size=10); bold = Font(name='Arial', size=10, bold=True)
thin = Side(style='thin', color='D9D2C3'); border = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical='top', horizontal='right'); center = Alignment(horizontal='center', vertical='top', wrap_text=True)
sub_fill = PatternFill('solid', fgColor='F3ECDD'); pil_fill = PatternFill('solid', fgColor='E6D7A2')
def header(ws, cols, widths, row=1):
    for i, (h, w) in enumerate(zip(cols, widths), 1):
        c = ws.cell(row=row, column=i, value=h); c.fill = hdr_fill; c.font = hdr_font; c.alignment = center; c.border = border
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[row].height = 32; ws.freeze_panes = ws.cell(row=row + 1, column=1); ws.sheet_view.rightToLeft = True
    ws.auto_filter.ref = f"A{row}:{get_column_letter(len(cols))}{row}"

wb = Workbook()
# ============ 1. ورقة التقييم (نفس أعمدة النموذج الأصلي + أعمدة الإدارة) ============
ws = wb.active; ws.title = 'التقييم الذاتي'
cols = ['#', 'المحور', '#', 'المحور الفرعي', '#', 'المعيار', 'مستوى الأثر', '#', 'المتطلب', 'معيار الرصد', 'التقييم', 'نتائج الرصد / الدليل', 'عدد الأدلة',
        'المسؤول عن التقييم', 'المشروع', 'مالك المشروع', 'حالة الكود', 'نتيجة الكود', 'المراجع', 'تاريخ آخر تحديث', 'يحتاج توضيح', 'ملاحظات']
widths = [4, 22, 6, 24, 7, 55, 10, 4, 45, 40, 11, 40, 8, 20, 30, 18, 12, 9, 16, 16, 9, 30]
header(ws, cols, widths)
r = 2
for c in sorted(M['codes'], key=lambda c: [int(x.rstrip('b')) for x in c['id'].split('.')] + [c['id'].endswith('b')]):
    pl = pillars[c['pillar']]; sb = subs[c['sub']]; paired = len(c['criteria']) == len(c['requirements'])
    links = mapping.get(c['id'], []); prj = ' | '.join(pname[p] for p in links); own = ' | '.join(sorted(set(owner_of[p] for p in links if owner_of.get(p)))) or ''
    for i, req in enumerate(c['requirements']):
        crit = c['criteria'][i]['text_ar'] if paired and i < len(c['criteria']) else ('\n'.join('• ' + x['text_ar'] for x in c['criteria']) if i == 0 and not paired else '')
        vals = [int(c['pillar']), pl['name_ar'], c['sub'], sb['name_ar'], c['id'], c['desc_ar'], IMP[c['impact']], req['n'], req['text_ar'], crit,
                '', '', 0, assignee(c['id']), prj, own, 'لم يبدأ', '', '', '', '', '']
        for j, v in enumerate(vals, 1):
            cell = ws.cell(row=r, column=j, value=v); cell.font = body_font; cell.border = border
            cell.alignment = center if j in (1, 3, 5, 7, 8, 11, 13, 17, 18, 20, 21) else wrap
        r += 1
dv1 = DataValidation(type='list', formula1='"نعم,لا,جزئي,لا ينطبق"', allow_blank=True); dv1.add(f'K2:K{r-1}'); ws.add_data_validation(dv1)
dv2 = DataValidation(type='list', formula1='"لم يبدأ,مسودة,مُرسل,مُعاد,معتمد"', allow_blank=True); dv2.add(f'Q2:Q{r-1}'); ws.add_data_validation(dv2)
dv3 = DataValidation(type='list', formula1='"نعم,لا"', allow_blank=True); dv3.add(f'U2:U{r-1}'); ws.add_data_validation(dv3)
dv4 = DataValidation(type='list', formula1='"عالي,متوسط,منخفض"', allow_blank=True); dv4.add(f'G2:G{r-1}'); ws.add_data_validation(dv4)
last = r - 1

# ============ 2. حسب المحور ============
ws2 = wb.create_sheet('الملخص حسب المحور')
cols2 = ['#', 'المحور', 'محاور فرعية', 'أكواد', 'متطلبات', 'أكواد مرتبطة بمشاريع', 'أكواد للفريق الأساسي', 'المسؤولون (عدد الأكواد)', 'متطلبات مُجابة', 'نسبة الإنجاز', 'نتيجة المحور (امتثال)']
header(ws2, cols2, [4, 36, 9, 8, 9, 12, 12, 60, 12, 11, 12])
rr = 2
for pid, pl in pillars.items():
    cs = [c for c in M['codes'] if c['pillar'] == pid]; nreq = sum(len(c['requirements']) for c in cs)
    cnt = collections.Counter(assignee(c['id']) for c in cs); who = '، '.join(f'{k} ({v})' for k, v in cnt.most_common())
    row = [int(pid), pl['name_ar'], len([s for s in M['subpillars'] if s['pillar'] == pid]), len(cs), nreq, len([c for c in cs if mapping.get(c['id'])]), len([c for c in cs if not mapping.get(c['id'])]), who,
           f'=COUNTIFS(\'التقييم الذاتي\'!$A$2:$A${last},{int(pid)},\'التقييم الذاتي\'!$K$2:$K${last},"<>")', f'=IFERROR(I{rr}/E{rr},0)',
           f'=IFERROR((COUNTIFS(\'التقييم الذاتي\'!$A$2:$A${last},{int(pid)},\'التقييم الذاتي\'!$K$2:$K${last},"نعم")*100+COUNTIFS(\'التقييم الذاتي\'!$A$2:$A${last},{int(pid)},\'التقييم الذاتي\'!$K$2:$K${last},"جزئي")*50)/(I{rr}-COUNTIFS(\'التقييم الذاتي\'!$A$2:$A${last},{int(pid)},\'التقييم الذاتي\'!$K$2:$K${last},"لا ينطبق"))/100,0)']
    for j, v in enumerate(row, 1):
        cell = ws2.cell(row=rr, column=j, value=v); cell.font = body_font; cell.border = border; cell.alignment = wrap if j in (2, 8) else center
    ws2.cell(row=rr, column=10).number_format = '0%'; ws2.cell(row=rr, column=11).number_format = '0%'; rr += 1
tot = ['', 'الإجمالي', f'=SUM(C2:C{rr-1})', f'=SUM(D2:D{rr-1})', f'=SUM(E2:E{rr-1})', f'=SUM(F2:F{rr-1})', f'=SUM(G2:G{rr-1})', '', f'=SUM(I2:I{rr-1})', f'=IFERROR(I{rr}/E{rr},0)', f'=IFERROR(SUMPRODUCT(K2:K{rr-1},I2:I{rr-1})/I{rr},0)']
for j, v in enumerate(tot, 1):
    cell = ws2.cell(row=rr, column=j, value=v); cell.font = bold; cell.border = border; cell.fill = sub_fill; cell.alignment = center
ws2.cell(row=rr, column=10).number_format = '0%'; ws2.cell(row=rr, column=11).number_format = '0%'

# ============ 3. حسب المحور الفرعي ============
ws3 = wb.create_sheet('حسب المحور الفرعي')
cols3 = ['#', 'المحور', 'المحور الفرعي', 'أكواد', 'متطلبات', 'المسؤول', 'المشاريع', 'متطلبات مُجابة', 'نسبة الإنجاز', 'نتيجة (امتثال)']
header(ws3, cols3, [6, 26, 36, 7, 9, 28, 50, 11, 10, 10])
rr = 2
for sid, sb in subs.items():
    cs = [c for c in M['codes'] if c['sub'] == sid]; nreq = sum(len(c['requirements']) for c in cs)
    cnt = collections.Counter(assignee(c['id']) for c in cs); who = '، '.join(f'{k} ({v})' for k, v in cnt.most_common())
    prs = sorted(set(pname[p] for c in cs for p in mapping.get(c['id'], [])))
    row = [sid, pillars[sb['pillar']]['name_ar'], sb['name_ar'], len(cs), nreq, who, '، '.join(prs),
           f'=COUNTIFS(\'التقييم الذاتي\'!$C$2:$C${last},"{sid}",\'التقييم الذاتي\'!$K$2:$K${last},"<>")', f'=IFERROR(H{rr}/E{rr},0)',
           f'=IFERROR((COUNTIFS(\'التقييم الذاتي\'!$C$2:$C${last},"{sid}",\'التقييم الذاتي\'!$K$2:$K${last},"نعم")*100+COUNTIFS(\'التقييم الذاتي\'!$C$2:$C${last},"{sid}",\'التقييم الذاتي\'!$K$2:$K${last},"جزئي")*50)/(H{rr}-COUNTIFS(\'التقييم الذاتي\'!$C$2:$C${last},"{sid}",\'التقييم الذاتي\'!$K$2:$K${last},"لا ينطبق"))/100,0)']
    for j, v in enumerate(row, 1):
        cell = ws3.cell(row=rr, column=j, value=v); cell.font = body_font; cell.border = border; cell.alignment = wrap if j in (2, 3, 6, 7) else center
    ws3.cell(row=rr, column=9).number_format = '0%'; ws3.cell(row=rr, column=10).number_format = '0%'; rr += 1

# ============ 4. حسب المسؤول ============
ws4 = wb.create_sheet('حسب المسؤول')
cols4 = ['المسؤول', 'المشاريع تحت مسؤوليته', 'أكواد مُسندة', 'متطلبات', 'المحاور الفرعية', 'متطلبات مُجابة', 'نسبة الإنجاز', 'نتيجة (امتثال)']
header(ws4, cols4, [24, 60, 10, 9, 60, 11, 10, 10])
rr = 2
people = [o['name_ar'] for o in P['owners'] if not o.get('removed')] + [CORE]
for who in people:
    cs = [c for c in M['codes'] if assignee(c['id']) == who]; nreq = sum(len(c['requirements']) for c in cs)
    prs = [pname[pid] for pid, ow in owner_of.items() if ow == who and active[pid]]
    sbs = sorted(set(c['sub'] for c in cs), key=lambda x: [int(i) for i in x.split('.')])
    row = [who, '، '.join(prs), len(cs), nreq, '، '.join(sbs),
           f'=COUNTIFS(\'التقييم الذاتي\'!$N$2:$N${last},A{rr},\'التقييم الذاتي\'!$K$2:$K${last},"<>")', f'=IFERROR(F{rr}/D{rr},0)',
           f'=IFERROR((COUNTIFS(\'التقييم الذاتي\'!$N$2:$N${last},A{rr},\'التقييم الذاتي\'!$K$2:$K${last},"نعم")*100+COUNTIFS(\'التقييم الذاتي\'!$N$2:$N${last},A{rr},\'التقييم الذاتي\'!$K$2:$K${last},"جزئي")*50)/(F{rr}-COUNTIFS(\'التقييم الذاتي\'!$N$2:$N${last},A{rr},\'التقييم الذاتي\'!$K$2:$K${last},"لا ينطبق"))/100,0)']
    for j, v in enumerate(row, 1):
        cell = ws4.cell(row=rr, column=j, value=v); cell.font = body_font; cell.border = border; cell.alignment = wrap if j in (1, 2, 5) else center
    ws4.cell(row=rr, column=7).number_format = '0%'; ws4.cell(row=rr, column=8).number_format = '0%'; rr += 1

# ============ 5. حسب المشروع ============
ws5 = wb.create_sheet('حسب المشروع')
cols5 = ['المشروع', 'المالك', 'المحاور الفرعية المغطاة', 'أكواد مرتبطة', 'متطلبات', 'متطلبات مُجابة', 'نسبة الإنجاز']
header(ws5, cols5, [40, 22, 50, 10, 9, 11, 10])
rr = 2
for pid in sorted(S['projects'], key=lambda x: int(x[1:])):
    cs = [c for c in M['codes'] if pid in mapping.get(c['id'], [])]; nreq = sum(len(c['requirements']) for c in cs)
    row = [pname[pid], owner_of.get(pid) or '', '، '.join(S['projects'][pid]['subs']), len(cs), nreq,
           f'=COUNTIFS(\'التقييم الذاتي\'!$O$2:$O${last},"*"&A{rr}&"*",\'التقييم الذاتي\'!$K$2:$K${last},"<>")', f'=IFERROR(F{rr}/E{rr},0)']
    for j, v in enumerate(row, 1):
        cell = ws5.cell(row=rr, column=j, value=v); cell.font = body_font; cell.border = border; cell.alignment = wrap if j in (1, 2, 3) else center
    ws5.cell(row=rr, column=7).number_format = '0%'; rr += 1

# ============ 6. دليل الاستخدام ============
ws6 = wb.create_sheet('دليل الاستخدام'); ws6.sheet_view.rightToLeft = True; ws6.column_dimensions['A'].width = 28; ws6.column_dimensions['B'].width = 100
guide = [('الغرض', 'ورقة متابعة التقييم الذاتي للهيئة مقابل كود الإمارات للخدمات الحكومية وتصفير البيروقراطية — 8 محاور، 60 محوراً فرعياً، 371 كوداً، 787 متطلباً.'),
         ('ورقة التقييم الذاتي', 'صف لكل متطلب. الأعمدة من # إلى معيار الرصد هي أعمدة النموذج الأصلي. أعمدة التقييم ونتائج الرصد تُملأ من قبل المسؤول. باقي الأعمدة (المسؤول، المشروع، مالك المشروع، الحالة، المراجع…) أعمدة إدارة المشروع.'),
         ('التقييم', 'نعم = 100، جزئي = 50، لا = 0، لا ينطبق = مستبعد من الاحتساب. قائمة منسدلة.'),
         ('المسؤول عن التقييم', 'مالك أول مشروع مرتبط بالكود. الأكواد غير المرتبطة بأي مشروع (المحور 5 كاملاً، 6.6، 8.3 إلى 8.8، وأكواد الذكاء الاصطناعي) تذهب إلى الفريق الأساسي.'),
         ('حالة الكود', 'لم يبدأ / مسودة / مُرسل / مُعاد / معتمد. الأرقام الرسمية تُحسب من المعتمد.'),
         ('أوراق الملخص', 'تُحسب تلقائياً بمعادلات من ورقة التقييم الذاتي: نسبة الإنجاز = المتطلبات المُجابة ÷ إجمالي المتطلبات، والامتثال = متوسط درجات المتطلبات المُجابة.'),
         ('الأداة', 'هذا الملف يُصدَّر أيضاً من أداة «بطولة كود الإمارات» (ورقة «المتابعة») مع الإجابات الفعلية والأدلة بشكل مستمر.'),
         ('ملاحظات على المستند الرسمي', 'الكودان 2.1.11 و2.3.4 مكرران في المستند الرسمي وأُضيفت لهما لاحقة b. الكود 5.4.7 بلا مستوى أثر في المستند.')]
for i, (k, v) in enumerate(guide, 1):
    a = ws6.cell(row=i, column=1, value=k); a.font = bold; a.alignment = wrap; b = ws6.cell(row=i, column=2, value=v); b.font = body_font; b.alignment = wrap
wb.save(out); print('saved', out, 'rows', last - 1)
