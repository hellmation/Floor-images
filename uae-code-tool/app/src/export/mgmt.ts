import ExcelJS from 'exceljs'
import type { Lang, Snapshot, Code } from '../types'
import { master, effective, codeScore, effectiveImpact, assigneeOf, rollup, standings, sortIds, subById, pillarById } from '../store/scoring'

/* Management presentation pack: the team's tracking layout (one row per requirement, responsible first,
 * title row, gold header) followed by chart-ready summary sheets and auto-written talking points. */

let LANG: Lang = 'ar'
const H = (ar: string, en: string) => LANG === 'ar' ? ar : en
const SN = (ar: string, en: string) => H(ar, en).slice(0, 31)
const STATUS_T: Record<string, [string, string]> = { yes: ['نعم', 'Yes'], partial: ['جزئي', 'Partial'], no: ['لا', 'No'], na: ['لا ينطبق', 'N/A'] }
const STATE_T: Record<string, [string, string]> = { none: ['لم يبدأ', 'Not started'], draft: ['مسودة', 'Draft'], submitted: ['مُرسل', 'Submitted'], returned: ['مُعاد', 'Returned'], approved: ['معتمد', 'Approved'] }
const IMP_T: Record<string, [string, string]> = { high: ['عالي', 'High'], medium: ['متوسط', 'Medium'], low: ['منخفض', 'Low'], none: ['غير محدد', 'Not specified'] }
const L = (m: Record<string, [string, string]>, k?: string | null) => k && m[k] ? H(...m[k]) : ''
const iso = (s?: string | null) => s ? new Date(s) : null
const GOLD = 'FFA7812D', GOLD_SOFT = 'FFF4ECDC', INK = 'FF1F1F1F', GREEN = 'FF2E7D32', RED = 'FFC62828', AMBER = 'FFB68A35'
const thin: Partial<ExcelJS.Borders> = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } }
const pct1 = (n: number, d: number) => d ? n / d : 0

export async function exportManagementPack(snap: Snapshot, cycleId: string, lang: Lang) {
  LANG = lang
  const cfg = snap.config; const cycle = cfg.cycles.find(c => c.id === cycleId)
  const rtl = lang === 'ar'
  const wb = new ExcelJS.Workbook(); wb.creator = H('بطولة كود الإمارات', 'UAE Code Championship'); wb.created = new Date()
  const uname = (id: string | null | undefined) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : '' }
  const pname = (id?: string | null) => { const p = cfg.projects.find(x => x.id === id); return p ? (lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)) : '' }
  const txt = (o: { text_ar: string; text_en?: string }) => lang === 'ar' ? o.text_ar : (o.text_en || o.text_ar)
  const desc = (o: { desc_ar: string; desc_en?: string }) => lang === 'ar' ? o.desc_ar : (o.desc_en || o.desc_ar)
  const nm = (o: { name_ar: string; name_en?: string }) => lang === 'ar' ? o.name_ar : (o.name_en || o.name_ar)
  const cname = (c?: { name: string; name_en?: string }) => c ? (lang === 'ar' ? c.name : (c.name_en || c.name)) : ''
  const DATE = 'yyyy-mm-dd', PCT = '0%', NUM = '0.0'
  const font = { name: 'Arial', size: 10 }

  /* ---------- facts ---------- */
  const codes = [...master.codes].sort((a, b) => sortIds(a.id, b.id))
  const facts = codes.map(c => {
    const e = effective(snap, cycleId, c.id); const a = e.answer; const imp = effectiveImpact(c, cfg); const w = cfg.settings.weights[imp]
    const items = c.requirements.map(r => a?.items[String(r.n)]); const cnt = { yes: 0, partial: 0, no: 0, na: 0 }
    for (const it of items) if (it?.status) cnt[it.status]++
    const answered = cnt.yes + cnt.partial + cnt.no + cnt.na
    const score = codeScore(a, c, cfg)
    const links = cfg.mapping[c.id] || []; const primary = links[0]; const owner = primary ? cfg.projects.find(p => p.id === primary)?.ownerId : null
    const evid = items.reduce((n, it) => n + (it?.evidence?.length || 0), 0)
    const clar = items.filter(it => it?.clarify?.flag).length
    return { c, e, a, imp, w, cnt, answered, score, links, primary, owner, evid, clar, assignee: assigneeOf(c.id, cycleId, cfg) }
  })
  const pm = uname(cfg.settings.defaultAssigneeId) || H('مدير المشروع', 'Project manager')

  /* ---------- 1. Detailed sheet in the team's layout ---------- */
  {
    const ws = wb.addWorksheet(SN('تقييمات كود الامارات', 'UAE Code evaluations')); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 2 }]
    const cols: { h: [string, string]; w: number; c?: boolean; fmt?: string }[] = [
      { h: ['المسؤول عن التقييم', 'Responsible evaluator'], w: 18 },
      { h: ['#', '#'], w: 4, c: true }, { h: ['المحور', 'Pillar'], w: 20 }, { h: ['#', '#'], w: 6, c: true }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 22 }, { h: ['#', '#'], w: 9, c: true }, { h: ['المعيار', 'Code'], w: 40 }, { h: ['مستوى الأثر', 'Impact'], w: 9, c: true },
      { h: ['جميع المتطلبات', 'All requirements'], w: 36 }, { h: ['جميع معايير الرصد', 'All monitoring criteria'], w: 36 },
      { h: ['#', '#'], w: 4, c: true }, { h: ['المتطلب', 'Requirement'], w: 45 }, { h: ['معيار الرصد', 'Monitoring criterion'], w: 42 }, { h: ['التقييم', 'Evaluation'], w: 11, c: true }, { h: ['الدليل', 'Evidence'], w: 36 }, { h: ['عدد الأدلة', 'Evidence count'], w: 8, c: true }, { h: ['يحتاج توضيح', 'Needs clarification'], w: 9, c: true },
      { h: ['المشروع', 'Project'], w: 30 }, { h: ['مالك المشروع', 'Project owner'], w: 16 }, { h: ['حالة الكود', 'Code state'], w: 11, c: true }, { h: ['نتيجة الكود', 'Code score'], w: 9, c: true, fmt: NUM },
      { h: ['المراجع', 'Reviewer'], w: 14 }, { h: ['تاريخ آخر تحديث', 'Last updated'], w: 13, c: true, fmt: DATE }, { h: ['سؤال التوضيح', 'Clarification question'], w: 30 }, { h: ['ملاحظات', 'Notes'], w: 30 },
    ]
    const N = cols.length; const lastCol = ws.getColumn(N).letter
    ws.mergeCells(`A1:${lastCol}1`)
    const title = ws.getCell('A1'); title.value = `${H('كود الإمارات للخدمات الحكومية وتصفير البيروقراطية — التقييم الذاتي', 'UAE Code for Government Services and Zero Bureaucracy — self-assessment')} · ${cname(cycle)}`
    title.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }; title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }; title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 34
    cols.forEach((c, i) => { const cell = ws.getCell(2, i + 1); cell.value = H(...c.h); cell.font = { ...font, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; cell.border = thin
      const col = ws.getColumn(i + 1); col.width = c.w; if (c.fmt) col.numFmt = c.fmt })
    ws.getRow(2).height = 30
    for (const f of facts) { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!; const paired = f.c.criteria.length === f.c.requirements.length
      const owners = [...new Set(f.links.map(pid => cfg.projects.find(p => p.id === pid)?.ownerId).filter(Boolean))].map(id => uname(id as string)).join(' | ')
      const allReq = f.c.requirements.map(x => `${x.n}. ${txt(x)}`).join('\n'), allCrit = f.c.criteria.map(x => `${x.n}. ${txt(x)}`).join('\n')
      f.c.requirements.forEach((r, i) => { const it = f.a?.items[String(r.n)]; const crit = paired ? txt(f.c.criteria[i]) : allCrit
        const row = ws.addRow([uname(f.assignee) || pm, Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, desc(f.c), L(IMP_T, f.imp), allReq, allCrit, r.n, txt(r), crit, L(STATUS_T, it?.status),
          [(it?.evidence || []).map(ev => ev.title ? `${ev.title}: ${ev.url}` : ev.url).join('\n'), it?.status === 'na' && it.justification ? `${H('مبرر عدم الانطباق', 'N/A justification')}: ${it.justification}` : ''].filter(Boolean).join('\n'), it?.evidence?.length || 0, it?.clarify?.flag ? H('نعم', 'Yes') : '',
          f.links.map(pname).join(' | '), owners, L(STATE_T, f.e.state), i === 0 && f.score !== null ? Math.round(f.score * 10) / 10 : null,
          uname(f.e.review?.reviewedBy), iso(f.a?.updatedAt), it?.clarify?.flag ? (it.clarify.question || '') : '', [it?.note, f.e.review?.comment ? `${H('المراجع', 'Reviewer')}: ${f.e.review.comment}` : ''].filter(Boolean).join(' | ')])
        let lines = 1
        row.eachCell({ includeEmpty: true }, (cell, n) => { const c = cols[n - 1]; cell.font = font; cell.border = thin; cell.alignment = { wrapText: true, vertical: 'middle', horizontal: c.c ? 'center' : (rtl ? 'right' : 'left') }
          const v = cell.value == null ? '' : String(cell.value); const l = v.split('\n').reduce((a, part) => a + Math.max(1, Math.ceil(part.length / (c.w * 1.9))), 0); if (l > lines) lines = l })
        const st = it?.status; if (st) { const cell = row.getCell(14); cell.font = { ...font, bold: true, color: { argb: st === 'yes' ? GREEN : st === 'no' ? RED : st === 'partial' ? AMBER : 'FF666666' } } }
        row.height = Math.min(409, 14 * lines + 6) }) }
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: N } }
    const last = ws.rowCount
    for (let r = 3; r <= last; r++) { ws.getCell(`N${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['=Lists!$A$2:$A$5'] }; ws.getCell(`T${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['=Lists!$B$2:$B$6'] } }
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  }

  /* ---------- helpers for summary sheets ---------- */
  const sheet = (title: [string, string], widths: number[]) => { const ws = wb.addWorksheet(SN(...title)); ws.views = [{ rightToLeft: rtl }]; widths.forEach((w, i) => { ws.getColumn(i + 1).width = w }); return ws }
  const banner = (ws: ExcelJS.Worksheet, text: string, span: number) => { const r = ws.addRow([text]); ws.mergeCells(r.number, 1, r.number, span); const c = r.getCell(1); c.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }; c.alignment = { horizontal: rtl ? 'right' : 'left', vertical: 'middle' }; r.height = 26; return r }
  const header = (ws: ExcelJS.Worksheet, hs: string[]) => { const r = ws.addRow(hs); r.eachCell(c => { c.font = { ...font, bold: true, color: { argb: INK } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD_SOFT } }; c.border = thin; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true } }); r.height = 28; return r }
  const body = (ws: ExcelJS.Worksheet, rows: unknown[][], fmts: Record<number, string> = {}, centerFrom = 2) => rows.map(v => { const r = ws.addRow(v); r.eachCell({ includeEmpty: true }, (c, n) => { c.font = font; c.border = thin; c.alignment = { vertical: 'middle', wrapText: true, horizontal: n >= centerFrom ? 'center' : (rtl ? 'right' : 'left') }; if (fmts[n]) c.numFmt = fmts[n] }); return r })
  const agg = (list: Code[]) => { const r = rollup(snap, cycleId, list, true), rw = rollup(snap, cycleId, list, false)
    const fs = facts.filter(f => list.includes(f.c)); const cnt = { yes: 0, partial: 0, no: 0, na: 0 }; let reqs = 0, evid = 0, withEv = 0, hiGaps = 0
    for (const f of fs) { cnt.yes += f.cnt.yes; cnt.partial += f.cnt.partial; cnt.no += f.cnt.no; cnt.na += f.cnt.na; reqs += f.c.requirements.length; evid += f.evid; if (f.evid) withEv++; if (f.imp === 'high' && f.score !== null && f.score < 100) hiGaps++ }
    return { r, rw, cnt, reqs, evid, withEv, hiGaps, n: fs.length } }
  const aggRow = (a: ReturnType<typeof agg>) => [a.n, a.rw.answered, a.rw.submitted, a.r.approved, pct1(a.r.approved, a.n), a.r.score === null ? null : a.r.score / 100, a.rw.score === null ? null : a.rw.score / 100, a.cnt.yes, a.cnt.partial, a.cnt.no, a.cnt.na, a.rw.gaps, a.hiGaps, a.withEv, a.evid, a.rw.clarifications]
  const aggH = [H('أكواد', 'Codes'), H('مُجاب', 'Answered'), H('مُرسل', 'Submitted'), H('معتمد', 'Approved'), H('الجاهزية', 'Readiness'), H('الامتثال (معتمد)', 'Compliance (approved)'), H('الامتثال (الكل)', 'Compliance (all)'), H('نعم', 'Yes'), H('جزئي', 'Partial'), H('لا', 'No'), H('لا ينطبق', 'N/A'), H('فجوات', 'Gaps'), H('فجوات عالية الأثر', 'High-impact gaps'), H('أكواد بأدلة', 'Codes with evidence'), H('عدد الأدلة', 'Evidence'), H('توضيحات', 'Clarifications')]
  const aggF: Record<number, string> = {}
  const aggFmt = (offset: number) => { const f: Record<number, string> = {}; f[offset + 5] = PCT; f[offset + 6] = PCT; f[offset + 7] = PCT; return f }
  void aggF

  const total = agg(master.codes)
  const byPillar = master.pillars.map(pl => ({ pl, a: agg(master.codes.filter(c => c.pillar === pl.id)) }))
  const bySub = master.subpillars.map(sb => ({ sb, a: agg(master.codes.filter(c => c.sub === sb.id)) }))
  const scoreOf = (a: ReturnType<typeof agg>) => a.rw.score

  /* ---------- 2. Dashboard (KPIs) ---------- */
  {
    const ws = sheet(['لوحة العرض', 'Dashboard'], [46, 22, 22, 22])
    banner(ws, `${H('لوحة العرض الإداري', 'Management dashboard')} · ${lang === 'ar' ? cfg.entity.name_ar : cfg.entity.name_en}`, 4)
    body(ws, [[H('الدورة', 'Cycle'), cname(cycle), cycle?.due ? `${H('الاستحقاق', 'Due')}: ${cycle.due}` : ''], [H('تاريخ التصدير', 'Exported at'), new Date().toISOString().slice(0, 10)], [H('نطاق الأرقام الرسمية', 'Official figures scope'), H('الأكواد المعتمدة من المراجع فقط', 'Reviewer-approved codes only')]])
    ws.addRow([])
    header(ws, [H('المؤشر', 'Indicator'), H('معتمد فقط (رسمي)', 'Approved only (official)'), H('كل ما أُجيب عنه', 'All answered'), H('ملاحظة', 'Note')])
    body(ws, [
      [H('إجمالي الأكواد', 'Total codes'), total.n, total.n, `8 ${H('محاور', 'pillars')} · 60 ${H('محور فرعي', 'sub-pillars')} · ${total.reqs} ${H('متطلب', 'requirements')}`],
      [H('أكواد مُجابة بالكامل', 'Fully answered codes'), total.rw.answered, total.rw.answered, ''],
      [H('أكواد مُرسلة للمراجعة', 'Codes submitted'), total.rw.submitted, total.rw.submitted, ''],
      [H('أكواد معتمدة', 'Codes approved'), total.r.approved, '', ''],
      [H('الجاهزية (معتمد ÷ الإجمالي)', 'Readiness (approved ÷ total)'), pct1(total.r.approved, total.n), pct1(total.rw.answered, total.n), H('عمود "الكل" = نسبة الإنجاز', '"All" column = completion rate')],
      [H('الامتثال المرجح', 'Weighted compliance'), total.r.score === null ? null : total.r.score / 100, total.rw.score === null ? null : total.rw.score / 100, H('نعم=100 · جزئي=50 · لا=0 · لا ينطبق مستبعد · أوزان الأثر 3/2/1', 'Yes=100 · Partial=50 · No=0 · N/A excluded · impact weights 3/2/1')],
      [H('متطلبات: نعم', 'Requirements: Yes'), '', total.cnt.yes, ''], [H('متطلبات: جزئي', 'Requirements: Partial'), '', total.cnt.partial, ''], [H('متطلبات: لا', 'Requirements: No'), '', total.cnt.no, ''], [H('متطلبات: لا ينطبق', 'Requirements: N/A'), '', total.cnt.na, ''],
      [H('أكواد بها فجوة (نتيجة أقل من 100)', 'Codes with a gap (score below 100)'), total.r.gaps, total.rw.gaps, ''],
      [H('فجوات عالية الأثر', 'High-impact gaps'), '', total.hiGaps, ''],
      [H('أكواد لها أدلة', 'Codes with evidence'), '', total.withEv, `${total.evid} ${H('رابط دليل', 'evidence links')}`],
      [H('طلبات توضيح مفتوحة', 'Open clarification requests'), '', total.rw.clarifications, ''],
      [H('المقيّمون النشطون', 'Active evaluators'), '', cfg.users.filter(u => u.active && u.role !== 'viewer').length, ''],
    ], { 2: '0', 3: '0' }).forEach((r, i) => { if (i === 4 || i === 5) { r.getCell(2).numFmt = PCT; r.getCell(3).numFmt = PCT } })
    ws.addRow([])
    header(ws, [H('حسب مستوى الأثر', 'By impact level'), H('أكواد', 'Codes'), H('الامتثال (الكل)', 'Compliance (all)'), H('فجوات', 'Gaps')])
    body(ws, (['high', 'medium', 'low', 'none'] as const).map(k => { const a = agg(master.codes.filter(c => effectiveImpact(c, cfg) === k)); return [L(IMP_T, k), a.n, a.rw.score === null ? null : a.rw.score / 100, a.rw.gaps] }).filter(r => Number(r[1]) > 0), { 3: PCT })
  }

  /* ---------- 3. By pillar / 4. By sub-pillar ---------- */
  {
    const ws = sheet(['حسب المحور', 'By pillar'], [5, 40, ...aggH.map(() => 10)]); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 2 }]
    banner(ws, H('نتائج المحاور الثمانية (جاهزة للرسم البياني)', 'Results per pillar (chart-ready)'), 2 + aggH.length)
    header(ws, ['#', H('المحور', 'Pillar'), ...aggH])
    body(ws, byPillar.map(({ pl, a }) => [Number(pl.id), nm(pl), ...aggRow(a)]), aggFmt(2), 3)
    const tr = body(ws, [[H('الكل', 'All'), '', ...aggRow(total)]], aggFmt(2), 3)[0]; tr.eachCell(c => { c.font = { ...font, bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD_SOFT } } })
  }
  {
    const ws = sheet(['حسب المحور الفرعي', 'By sub-pillar'], [7, 24, 40, ...aggH.map(() => 10)]); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 2 }]
    banner(ws, H('نتائج المحاور الفرعية الستين (خريطة حرارية)', 'Results per sub-pillar (heat map)'), 3 + aggH.length)
    header(ws, ['#', H('المحور', 'Pillar'), H('المحور الفرعي', 'Sub-pillar'), ...aggH])
    body(ws, bySub.map(({ sb, a }) => [sb.id, nm(pillarById.get(sb.pillar)!), nm(sb), ...aggRow(a)]), aggFmt(3), 4)
  }

  /* ---------- 5. By evaluator / 6. By project ---------- */
  {
    const st = standings(snap, cycleId)
    const ws = sheet(['حسب المسؤول', 'By evaluator'], [8, 24, 10, ...aggH.map(() => 10), 10])
    banner(ws, H('إنجاز الفريق (الترتيب)', 'Team progress (standings)'), 3 + aggH.length + 1)
    header(ws, [H('المركز', 'Rank'), H('المسؤول', 'Evaluator'), H('المشاريع', 'Projects'), ...aggH, H('النقاط', 'Points')])
    body(ws, cfg.users.filter(u => u.active && u.role !== 'viewer').map(u => { const sx = st.find(x => x.userId === u.id); const mine = facts.filter(f => f.assignee === u.id).map(f => f.c)
      return [sx?.rank ?? '', uname(u.id), cfg.projects.filter(p => p.active && p.ownerId === u.id).length, ...aggRow(agg(mine)), sx ? Math.round(sx.points * 10) / 10 : null] }).sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99)), { ...aggFmt(3), [3 + aggH.length + 1]: NUM }, 3)
  }
  {
    const ws = sheet(['حسب المشروع', 'By project'], [8, 44, 20, ...aggH.map(() => 10)])
    banner(ws, H('نتائج المشاريع', 'Results per project'), 3 + aggH.length)
    header(ws, [H('المعرّف', 'ID'), H('المشروع', 'Project'), H('المالك', 'Owner'), ...aggH])
    body(ws, cfg.projects.filter(p => p.active).map(p => [p.id, nm(p), uname(p.ownerId), ...aggRow(agg(master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id))))]).filter(r => Number(r[3]) > 0).sort((a, b) => Number(b[3]) - Number(a[3])), aggFmt(3), 4)
  }

  /* ---------- 7. Top gaps / 8. Strengths ---------- */
  {
    const ws = sheet(['أهم الفجوات', 'Top gaps'], [6, 22, 9, 50, 9, 9, 10, 50, 26, 18, 11])
    banner(ws, H('أهم 25 فجوة بحسب الأثر المرجح (الأولويات المقترحة)', 'Top 25 gaps by weighted impact (suggested priorities)'), 11)
    header(ws, [H('الترتيب', 'Rank'), H('المحور', 'Pillar'), H('الكود', 'Code'), H('المعيار', 'Code text'), H('الأثر', 'Impact'), H('النتيجة', 'Score'), H('الفجوة المرجحة', 'Weighted gap'), H('المتطلبات غير المستوفاة', 'Unmet requirements'), H('المشروع', 'Project'), H('المسؤول', 'Responsible'), H('الحالة', 'State')])
    const gaps = facts.filter(f => f.score !== null && f.score < 100).sort((a, b) => ((100 - b.score!) * b.w) - ((100 - a.score!) * a.w) || sortIds(a.c.id, b.c.id)).slice(0, 25)
    body(ws, gaps.map((f, i) => [i + 1, nm(pillarById.get(f.c.pillar)!), f.c.id, desc(f.c), L(IMP_T, f.imp), Math.round(f.score! * 10) / 10, Math.round((100 - f.score!) * f.w * 10) / 10,
      f.c.requirements.filter(r => { const s0 = f.a?.items[String(r.n)]?.status; return s0 === 'no' || s0 === 'partial' }).map(r => `${r.n}. ${txt(r)} (${L(STATUS_T, f.a!.items[String(r.n)].status)})`).join('\n'), pname(f.primary), uname(f.assignee) || pm, L(STATE_T, f.e.state)]), { 6: NUM, 7: NUM }, 5)
    if (!gaps.length) body(ws, [[H('لا توجد فجوات مُسجلة بعد', 'No gaps recorded yet')]])
  }
  {
    const ws = sheet(['نقاط القوة', 'Strengths'], [9, 22, 40, 9, 9, 10, 10])
    banner(ws, H('المحاور الفرعية الأعلى امتثالاً (أكواد مُجابة بالكامل)', 'Highest-compliance sub-pillars (fully answered codes)'), 7)
    header(ws, ['#', H('المحور', 'Pillar'), H('المحور الفرعي', 'Sub-pillar'), H('أكواد', 'Codes'), H('مُجاب', 'Answered'), H('الامتثال (الكل)', 'Compliance (all)'), H('معتمد', 'Approved')])
    const strong = bySub.filter(({ a }) => scoreOf(a) !== null && a.rw.answered >= Math.max(1, Math.ceil(a.n / 2))).sort((x, y) => (scoreOf(y.a) ?? 0) - (scoreOf(x.a) ?? 0)).slice(0, 15)
    body(ws, strong.map(({ sb, a }) => [sb.id, nm(pillarById.get(sb.pillar)!), nm(sb), a.n, a.rw.answered, (scoreOf(a) ?? 0) / 100, a.r.approved]), { 6: PCT }, 4)
    if (!strong.length) body(ws, [[H('تظهر نقاط القوة بعد الإجابة عن نصف أكواد المحور الفرعي على الأقل', 'Strengths appear once at least half of a sub-pillar\'s codes are answered')]])
  }

  /* ---------- 9. Talking points ---------- */
  {
    const ws = sheet(['رسائل العرض', 'Talking points'], [110])
    banner(ws, H('رسائل جاهزة للعرض التقديمي (تُحدَّث تلقائياً من البيانات)', 'Ready-to-use messages for the presentation (generated from the data)'), 1)
    const p = (n: number) => `${Math.round(n * 100)}%`
    const ranked = byPillar.filter(x => scoreOf(x.a) !== null).sort((x, y) => (scoreOf(y.a) ?? 0) - (scoreOf(x.a) ?? 0))
    const best = ranked[0], worst = ranked[ranked.length - 1]
    const lines: string[] = [
      `${H('نطاق التقييم', 'Scope')}: 8 ${H('محاور', 'pillars')} · 60 ${H('محور فرعي', 'sub-pillars')} · ${total.n} ${H('كود', 'codes')} · ${total.reqs} ${H('متطلب', 'requirements')} — ${cname(cycle)}.`,
      `${H('الإنجاز', 'Completion')}: ${H('أُجيب عن', 'answered')} ${total.rw.answered} ${H('من', 'of')} ${total.n} ${H('كود', 'codes')} (${p(pct1(total.rw.answered, total.n))})، ${H('اعتُمد منها', 'approved')} ${total.r.approved} (${H('جاهزية', 'readiness')} ${p(pct1(total.r.approved, total.n))}).`,
      total.rw.score === null ? H('لم تُحتسب نسبة امتثال بعد؛ لا توجد أكواد مُجابة بالكامل.', 'No compliance figure yet; no fully answered codes.') : `${H('الامتثال المرجح على ما أُجيب عنه', 'Weighted compliance on answered codes')}: ${p(total.rw.score / 100)}${total.r.score !== null ? ` — ${H('على المعتمد فقط', 'approved only')}: ${p(total.r.score / 100)}` : ''}.`,
      `${H('توزيع المتطلبات', 'Requirement outcomes')}: ${H('نعم', 'Yes')} ${total.cnt.yes} · ${H('جزئي', 'Partial')} ${total.cnt.partial} · ${H('لا', 'No')} ${total.cnt.no} · ${H('لا ينطبق', 'N/A')} ${total.cnt.na}.`,
      best ? `${H('أقوى محور', 'Strongest pillar')}: ${nm(best.pl)} (${p((scoreOf(best.a) ?? 0) / 100)}).` : '',
      worst && worst !== best ? `${H('أكثر محور يحتاج تدخلاً', 'Pillar needing most attention')}: ${nm(worst.pl)} (${p((scoreOf(worst.a) ?? 0) / 100)}) ${H('وبه', 'with')} ${worst.a.rw.gaps} ${H('فجوة مسجلة', 'recorded gaps')}.` : '',
      `${H('الفجوات عالية الأثر', 'High-impact gaps')}: ${total.hiGaps} ${H('كود — وهي أولوية خطة المعالجة.', 'codes — the priority of the remediation plan.')}`,
      `${H('الأدلة', 'Evidence')}: ${total.withEv} ${H('كود موثّق بأدلة', 'codes backed by evidence')} (${total.evid} ${H('رابط', 'links')}) · ${H('طلبات توضيح مفتوحة', 'open clarifications')}: ${total.rw.clarifications}.`,
      `${H('ملكية التقييم', 'Ownership')}: ${cfg.users.filter(u => u.active && u.role !== 'viewer').length} ${H('مقيّمين موزعين على', 'evaluators across')} ${cfg.projects.filter(x => x.active).length} ${H('مشروعاً، وكل كود مرتبط بمشروع أو بمدير المشروع.', 'projects; every code is linked to a project or to the project manager.')}`,
      `${H('الخطوة التالية', 'Next step')}: ${H('إغلاق الفجوات عالية الأثر، واستكمال الأدلة، ثم إعادة القياس في الدورة التالية ومقارنة الاتجاه.', 'close the high-impact gaps, complete the evidence, then re-measure in the next cycle and compare the trend.')}`,
    ].filter(Boolean)
    body(ws, lines.map((l, i) => [`${i + 1}. ${l}`])).forEach(r => { r.height = 30 })
  }

  /* ---------- Lists (validation) ---------- */
  {
    const ws = wb.addWorksheet('Lists'); ws.views = [{ rightToLeft: rtl }]; ws.columns = [{ width: 14 }, { width: 14 }]
    ws.addRow([H('التقييم', 'Evaluation'), H('حالة الكود', 'Code state')]).font = { ...font, bold: true }
    const ev = ['yes', 'partial', 'no', 'na'].map(k => L(STATUS_T, k)), stt = ['none', 'draft', 'submitted', 'returned', 'approved'].map(k => L(STATE_T, k))
    for (let i = 0; i < 5; i++) ws.addRow([ev[i] || '', stt[i] || ''])
    ws.state = 'veryHidden'
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `UAE-Code-Management-Pack_${cycleId}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
