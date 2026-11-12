import ExcelJS from 'exceljs'
import type { Lang, Snapshot, Code } from '../types'
import { master, effective, codeScore, effectiveImpact, assigneeOf, rollup, standings, sortIds, subById, pillarById, departmentOf, supportDepartments, fulfilRows, fulfilSum, type FulfilRow } from '../store/scoring'

let LANG: Lang = 'ar'
const H = (ar: string, en: string) => LANG === 'ar' ? ar : en
const SN = (ar: string, en: string) => H(ar, en).slice(0, 31)
const STATUS_T: Record<string, [string, string]> = { yes: ['نعم', 'Yes'], partial: ['جزئي', 'Partial'], no: ['لا', 'No'], na: ['لا ينطبق', 'N/A'] }
const STATE_T: Record<string, [string, string]> = { none: ['لم يبدأ', 'Not started'], draft: ['مسودة', 'Draft'], submitted: ['مُرسل', 'Submitted'], returned: ['مُعاد', 'Returned'], approved: ['معتمد', 'Approved'] }
const IMP_T: Record<string, [string, string]> = { high: ['عالي', 'High'], medium: ['متوسط', 'Medium'], low: ['منخفض', 'Low'], none: ['غير محدد', 'Not specified'] }
const CYS_T: Record<string, [string, string]> = { planning: ['تخطيط', 'Planning'], open: ['مفتوحة', 'Open'], review: ['قيد المراجعة', 'In review'], closed: ['مغلقة', 'Closed'] }
const ROLE_T: Record<string, [string, string]> = { admin: ['مدير', 'Admin'], evaluator: ['مقيّم', 'Evaluator'], viewer: ['مطّلع', 'Viewer'] }
const FLAG_T: Record<string, [string, string]> = { duplicate_id_in_pdf: ['رقم مكرر في المستند', 'Duplicate number in PDF'], impact_not_specified_in_pdf: ['مستوى الأثر غير محدد في المستند', 'Impact not marked in PDF'], duplicate_item_in_pdf: ['متطلب مكرر في المستند (أُدرج مرة)', 'Requirement repeated in PDF (listed once)'], criteria_mismatch_in_pdf: ['معايير الرصد في المستند لا تطابق المعيار', 'Printed criteria do not match the code'] }
const L = (m: Record<string, [string, string]>, k?: string | null) => k && m[k] ? H(...m[k]) : ''
/** Timestamps are written as local wall-clock time (what the user sees in the app), not UTC. */
const iso = (s?: string | null) => { if (!s) return null; const d = new Date(s); return new Date(d.getTime() - d.getTimezoneOffset() * 60000) }
const day = (s?: string | null) => s ? new Date(s + 'T00:00:00') : null
const YN = (b: boolean) => b ? H('نعم', 'Yes') : H('لا', 'No')

export async function exportWorkbook(snap: Snapshot, cycleId: string, lang: Lang) {
  LANG = lang
  const cfg = snap.config; const cycle = cfg.cycles.find(c => c.id === cycleId)
  const wb = new ExcelJS.Workbook(); wb.creator = H('بطولة كود الإمارات', 'UAE Code Championship'); wb.created = new Date()
  const rtl = lang === 'ar'
  const cname = (c?: { name: string; name_en?: string }) => c ? (lang === 'ar' ? c.name : (c.name_en || c.name)) : ''
  const uname = (id: string | null | undefined) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : '' }
  const pname = (id?: string | null) => { const p = cfg.projects.find(x => x.id === id); return p ? (lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)) : '' }
  const txt = (o: { text_ar: string; text_en?: string }) => lang === 'ar' ? o.text_ar : (o.text_en || o.text_ar)
  const desc = (o: { desc_ar: string; desc_en?: string }) => lang === 'ar' ? o.desc_ar : (o.desc_en || o.desc_ar)
  const nm = (o: { name_ar: string; name_en?: string }) => lang === 'ar' ? o.name_ar : (o.name_en || o.name_ar)
  const dname = (id?: string | null) => { const d = cfg.departments?.find(x => x.id === id); return d ? nm(d) : '' }
  const DATE = 'yyyy-mm-dd hh:mm', PCT = '0%', NUM = '0.0'

  /** Adds a sheet as an Excel table (filterable, pivot-ready) with typed columns. */
  const table = (title: [string, string], tname: string, cols: { h: [string, string]; w: number; fmt?: string }[], rows: unknown[][]) => {
    const ws = wb.addWorksheet(SN(...title)); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }]
    if (rows.length === 0) rows = [cols.map(() => null)]
    ws.addTable({ name: tname, ref: 'A1', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true }, columns: cols.map(c => ({ name: H(...c.h), filterButton: true })), rows })
    cols.forEach((c, i) => { const col = ws.getColumn(i + 1); col.width = c.w; col.alignment = { wrapText: true, vertical: 'top' }; if (c.fmt) col.numFmt = c.fmt })
    ws.getRow(1).font = { bold: true }
    return ws
  }

  /* ---------- gather facts ---------- */
  const codes = [...master.codes].sort((a, b) => sortIds(a.id, b.id))
  const facts = codes.map(c => {
    const e = effective(snap, cycleId, c.id); const a = e.answer; const imp = effectiveImpact(c, cfg); const w = cfg.settings.weights[imp]
    const items = c.requirements.map(r => a?.items[String(r.n)]); const cnt = { yes: 0, partial: 0, no: 0, na: 0 }
    for (const it of items) if (it?.status) cnt[it.status]++
    const answered = cnt.yes + cnt.partial + cnt.no + cnt.na
    const score = codeScore(a, c, cfg)
    const links = cfg.mapping[c.id] || []
    const primary = links.find(pid => { const p = cfg.projects.find(x => x.id === pid && x.active); return !!p?.ownerId }) || links[0]
    const owner = primary ? cfg.projects.find(p => p.id === primary)?.ownerId : null
    const evid = items.reduce((n, it) => n + (it?.evidence?.length || 0), 0)
    const clar = items.filter(it => it?.clarify?.flag).length
    const openClar = c.requirements.filter(r => a?.items[String(r.n)]?.clarify?.flag && !snap.reviews.clarifications?.[cycleId]?.[c.id]?.[String(r.n)]).length
    // only the review that applies to the current submission is reported; a superseded one is not "current"
    const review = e.review && (e.state === 'approved' || e.state === 'returned') ? e.review : null
    const dept = departmentOf(snap, cycleId, c.id)
    return { c, e, a, imp, w, cnt, answered, score, links, primary, owner, evid, clar, openClar, review, dept, supports: supportDepartments(cfg, c.id), complete: answered === c.requirements.length, assignee: assigneeOf(c.id, cycleId, cfg) }
  })
  const order = new Map(codes.map((c, i) => [c.id, i + 1]))
  const PTS = cfg.settings.points || { high: 30, medium: 20, low: 10, none: 20 }

  /* ---------- 0. Tracking sheet: the original template's columns plus management columns ---------- */
  {
    const ws = wb.addWorksheet(SN('المتابعة', 'Tracking')); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }]
    const cols: { h: [string, string]; w: number; c?: boolean; fmt?: string }[] = [
      { h: ['الدورة', 'Cycle'], w: 9, c: true }, { h: ['الترتيب', 'Order'], w: 6, c: true },
      { h: ['رقم المحور', 'Pillar #'], w: 5, c: true }, { h: ['المحور', 'Pillar'], w: 22 }, { h: ['رقم المحور الفرعي', 'Sub-pillar #'], w: 7, c: true }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 24 }, { h: ['الكود', 'Code ID'], w: 8, c: true }, { h: ['المعيار (نص الكود)', 'Code text'], w: 55 }, { h: ['مستوى الأثر', 'Impact'], w: 10, c: true }, { h: ['جميع المتطلبات', 'All requirements'], w: 50 }, { h: ['جميع معايير الرصد', 'All monitoring criteria'], w: 50 },
      { h: ['رقم المتطلب', 'Req #'], w: 5, c: true }, { h: ['المتطلب', 'Requirement'], w: 45 }, { h: ['معيار الرصد', 'Monitoring criterion'], w: 40 }, { h: ['التقييم', 'Evaluation'], w: 11, c: true }, { h: ['نتائج الرصد / الدليل', 'Monitoring result / evidence'], w: 40 }, { h: ['عدد الأدلة (المتطلب)', 'Evidence count (requirement)'], w: 8, c: true },
      { h: ['المسؤول عن التقييم (المُسند إليه)', 'Assignee'], w: 20 }, { h: ['المشروع', 'Project'], w: 30 }, { h: ['مالك المشروع', 'Project owner'], w: 18 }, { h: ['الإدارة المسؤولة', 'Responsible department'], w: 24 }, { h: ['إدارة المتطلب', 'Requirement department'], w: 24 }, { h: ['حالة الكود', 'Code state'], w: 12, c: true }, { h: ['نتيجة الكود', 'Code score'], w: 9, c: true, fmt: NUM },
      { h: ['المراجع', 'Reviewer'], w: 16 }, { h: ['تاريخ آخر تحديث', 'Last updated'], w: 16, c: true, fmt: DATE }, { h: ['يحتاج توضيح', 'Needs clarification'], w: 9, c: true }, { h: ['ملاحظات', 'Notes'], w: 30 },
    ]
    cols.forEach((c, i) => { const cell = ws.getCell(1, i + 1); cell.value = H(...c.h); cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA7812D' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      const col = ws.getColumn(i + 1); col.width = c.w; col.alignment = { wrapText: true, vertical: 'top', horizontal: c.c ? 'center' : (rtl ? 'right' : 'left') }; if (c.fmt) col.numFmt = c.fmt })
    ws.getRow(1).height = 32
    for (const f of facts) { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!; const paired = f.c.criteria.length === f.c.requirements.length
      const owners = [...new Set(f.links.map(pid => cfg.projects.find(p => p.id === pid)?.ownerId).filter(Boolean))].map(id => uname(id as string)).join(' | ')
      const allReq = f.c.requirements.map(x => `${x.n}. ${txt(x)}`).join('\n'), allCrit = f.c.criteria.map(x => `${x.n}. ${txt(x)}`).join('\n')
      f.c.requirements.forEach((r, i) => { const it = f.a?.items[String(r.n)]; const crit = paired ? txt(f.c.criteria[i]) : allCrit
        const row = ws.addRow([cycleId, order.get(f.c.id), Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, desc(f.c), L(IMP_T, f.imp), allReq, allCrit, r.n, txt(r), crit, L(STATUS_T, it?.status),
          [(it?.evidence || []).map(ev => ev.title ? `${ev.title}: ${ev.url}` : ev.url).join('\n'), it?.status === 'na' && it.justification ? `${H('مبرر عدم الانطباق', 'N/A justification')}: ${it.justification}` : ''].filter(Boolean).join('\n'), it?.evidence?.length || 0,
          uname(f.assignee) || H('غير مُسند', 'Unassigned'), f.links.map(pname).join(' | '), owners, dname(f.dept), dname(it?.departmentId || f.dept), L(STATE_T, f.e.state), i === 0 && f.score !== null ? Math.round(f.score * 10) / 10 : null,
          uname(f.review?.reviewedBy), iso(f.a?.updatedAt), YN(!!it?.clarify?.flag), [it?.note, it?.clarify?.flag ? `${H('سؤال', 'Question')}: ${it.clarify.question}` : '', f.review?.comment ? `${H('المراجع', 'Reviewer')}: ${f.review.comment}` : ''].filter(Boolean).join(' | ')])
        let lines = 1; row.eachCell((cell, n) => { const v = cell.value == null ? '' : String(cell.value); const w = cols[n - 1].w * 1.9; const l = v.split('\n').reduce((a, part) => a + Math.max(1, Math.ceil(part.length / w)), 0); if (l > lines) lines = l }); row.height = Math.min(409, 15 * lines + 4) }) }
    const last = ws.rowCount
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, last), column: cols.length } }
    for (let r = 2; r <= last; r++) { ws.getCell(`O${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${['yes', 'partial', 'no', 'na'].map(k => L(STATUS_T, k)).join(',')}"`] }; ws.getCell(`W${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${['none', 'draft', 'submitted', 'returned', 'approved'].map(k => L(STATE_T, k)).join(',')}"`] } }
  }

  /* ---------- 1. Summary ---------- */
  const all = rollup(snap, cycleId, master.codes, true), allW = rollup(snap, cycleId, master.codes, false)
  const s = wb.addWorksheet(SN('الملخص', 'Summary')); s.views = [{ rightToLeft: rtl }]
  s.columns = [{ width: 44 }, { width: 26 }, { width: 26 }]
  const rows: unknown[][] = [
    [H('الجهة', 'Entity'), lang === 'ar' ? cfg.entity.name_ar : cfg.entity.name_en],
    [H('الدورة', 'Cycle'), cname(cycle), cycle ? L(CYS_T, cycle.status) : ''],
    [H('معرّف الدورة', 'Cycle ID'), cycleId], [H('فترة الدورة', 'Cycle period'), day(cycle?.start), day(cycle?.end)], [H('تاريخ الاستحقاق', 'Due date'), day(cycle?.due)],
    [H('تاريخ التصدير', 'Exported at'), new Date()], [],
    ['', H('المعتمد فقط', 'Approved only'), H('كل ما أُجيب عنه', 'All answered')],
    [H('إجمالي الأكواد', 'Total codes'), all.total, allW.total],
    [H('أكواد مُجابة', 'Codes answered'), all.answered, allW.answered],
    [H('أكواد مُرسلة', 'Codes submitted'), all.submitted, allW.submitted],
    [H('أكواد معتمدة', 'Codes approved'), all.approved, allW.approved],
    [H('الجاهزية (معتمد ÷ الإجمالي)', 'Readiness (approved ÷ total)'), all.total ? all.approved / all.total : 0, allW.total ? allW.approved / allW.total : 0],
    [H('نسبة الإنجاز (مُجاب ÷ الإجمالي)', 'Completion (answered ÷ total)'), all.total ? all.answered / all.total : 0, allW.total ? allW.answered / allW.total : 0],
    [H('الامتثال المرجح', 'Weighted compliance'), all.score === null ? null : all.score / 100, allW.score === null ? null : allW.score / 100],
    [H('الفجوات (نتيجة أقل من 100)', 'Gaps (score below 100)'), all.gaps, allW.gaps],
    [H('علامات "يحتاج توضيح"', 'Clarification flags'), allW.clarifications],
    [H('طلبات التوضيح المفتوحة (بدون رد)', 'Open clarification requests (no reply yet)'), facts.reduce((n, f) => n + f.openClar, 0)],
    [H('المقيّمون النشطون', 'Active evaluators'), cfg.users.filter(u => u.active && u.role !== 'viewer').length],
    [H('المشاريع النشطة', 'Active projects'), cfg.projects.filter(p => p.active).length],
    [H('أكواد غير مرتبطة بمشروع', 'Codes without a project'), facts.filter(f => !f.links.length).length], [],
    [H('قاعدة الاحتساب', 'Scoring rule'), `${H('نعم', 'Yes')}=${cfg.settings.scores.yes} · ${H('جزئي', 'Partial')}=${cfg.settings.scores.partial} · ${H('لا', 'No')}=${cfg.settings.scores.no} · ${H('لا ينطبق مستبعد', 'N/A excluded')}`],
    [H('أوزان الأثر', 'Impact weights'), `${H('عالي', 'High')}=${cfg.settings.weights.high} · ${H('متوسط', 'Medium')}=${cfg.settings.weights.medium} · ${H('منخفض', 'Low')}=${cfg.settings.weights.low} · ${H('غير محدد', 'Not specified')}=${cfg.settings.weights.none}`],
    [H('نتيجة الكود', 'Code score'), H('متوسط درجات متطلباته (0–100)', 'Average of its requirement scores (0–100)')],
    [H('الامتثال المرجح', 'Weighted compliance'), H('مجموع (نتيجة الكود × الوزن) ÷ مجموع الأوزان', 'Sum of (code score × weight) ÷ sum of weights')],
    [H('نقاط الترتيب', 'Standings points'), H('نصف نسبة الاعتماد + نصف الامتثال على ما أُجيب عنه', 'Half approval rate + half compliance on answered codes')],
  ]
  s.addRows(rows); s.getColumn(1).font = { bold: true }
  rows.forEach((r, i) => { const n = i + 1; const label = String(r[0] || '')
    if (label === H('تاريخ التصدير', 'Exported at')) s.getCell(`B${n}`).numFmt = DATE
    if (label === H('فترة الدورة', 'Cycle period') || label === H('تاريخ الاستحقاق', 'Due date')) { s.getCell(`B${n}`).numFmt = 'yyyy-mm-dd'; s.getCell(`C${n}`).numFmt = 'yyyy-mm-dd' }
    if (label.startsWith(H('الجاهزية', 'Readiness')) || label.startsWith(H('نسبة الإنجاز', 'Completion')) || label === H('الامتثال المرجح', 'Weighted compliance') && typeof r[1] !== 'string') { s.getCell(`B${n}`).numFmt = PCT; s.getCell(`C${n}`).numFmt = PCT }
    if (r[1] === H('المعتمد فقط', 'Approved only')) s.getRow(n).font = { bold: true } })

  /* ---------- 2. Codes (one row per code) ---------- */
  table(['الأكواد', 'Codes'], 'Codes', [
    { h: ['الدورة', 'Cycle'], w: 10 }, { h: ['الترتيب', 'Order'], w: 6 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 26 }, { h: ['رقم المحور الفرعي', 'Sub-pillar #'], w: 8 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 28 },
    { h: ['الكود', 'Code ID'], w: 9 }, { h: ['رقم الكود في المستند', 'PDF code #'], w: 9 }, { h: ['نص الكود', 'Code text'], w: 60 }, { h: ['مستوى الأثر', 'Impact'], w: 11 }, { h: ['وزن الأثر', 'Impact weight'], w: 8 },
    { h: ['عدد المتطلبات', 'Requirements'], w: 8 }, { h: ['متطلبات مُجابة', 'Requirements answered'], w: 8 }, { h: ['نعم', 'Yes'], w: 6 }, { h: ['جزئي', 'Partial'], w: 6 }, { h: ['لا', 'No'], w: 6 }, { h: ['لا ينطبق', 'N/A'], w: 7 },
    { h: ['نتيجة الكود', 'Code score'], w: 9, fmt: NUM }, { h: ['النقاط المرجحة', 'Weighted points'], w: 9, fmt: NUM }, { h: ['مكتمل', 'Complete'], w: 8 }, { h: ['حالة الكود', 'State'], w: 12 }, { h: ['يُحتسب رسمياً', 'Counts officially'], w: 9 },
    { h: ['المقيّم (كاتب الإجابة)', 'Evaluator (answer author)'], w: 20 }, { h: ['معرّف المقيّم', 'Evaluator ID'], w: 16 }, { h: ['المُسند إليه', 'Assignee'], w: 20 }, { h: ['معرّف المُسند إليه', 'Assignee ID'], w: 16 }, { h: ['المشاريع المرتبطة', 'Linked projects'], w: 34 }, { h: ['المشروع الرئيسي', 'Primary project'], w: 26 }, { h: ['مالك المشروع', 'Project owner'], w: 18 }, { h: ['الإدارة المسؤولة', 'Responsible department'], w: 24 }, { h: ['إدارات مساندة', 'Supporting departments'], w: 24 },
    { h: ['عدد الأدلة (الكود)', 'Evidence count (code)'], w: 8 }, { h: ['تم التحقق من الأدلة', 'Evidence verified'], w: 9 }, { h: ['علامات توضيح', 'Clarification flags'], w: 9 }, { h: ['توضيحات بلا رد', 'Open clarifications'], w: 9 },
    { h: ['آخر تحديث', 'Updated at'], w: 17, fmt: DATE }, { h: ['تاريخ الإرسال', 'Submitted at'], w: 17, fmt: DATE }, { h: ['تاريخ المراجعة', 'Reviewed at'], w: 17, fmt: DATE }, { h: ['المراجع', 'Reviewer'], w: 18 }, { h: ['تعليق المراجع', 'Reviewer comment'], w: 30 },
    { h: ['مُرحّل من', 'Carried from'], w: 10 }, { h: ['صفحة PDF', 'PDF page'], w: 7 }, { h: ['ملاحظات المستند', 'Source flags'], w: 24 },
  ], facts.map(f => { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!
    return [cycleId, order.get(f.c.id), Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, f.c.pdf_id, desc(f.c), L(IMP_T, f.imp), f.w,
      f.c.requirements.length, f.answered, f.cnt.yes, f.cnt.partial, f.cnt.no, f.cnt.na,
      f.score === null ? null : Math.round(f.score * 10) / 10, f.score === null ? null : Math.round(f.score * f.w * 10) / 10, YN(f.complete), L(STATE_T, f.e.state), YN(f.e.state === 'approved'),
      uname(f.e.userId), f.e.userId || '', uname(f.assignee) || H('غير مُسند', 'Unassigned'), f.assignee || '', f.links.map(pname).join(' | '), pname(f.primary), uname(f.owner), dname(f.dept), f.supports.map(dname).filter(Boolean).join(' | '),
      f.evid, YN(!!f.review?.evidenceVerified), f.clar, f.openClar,
      iso(f.a?.updatedAt), iso(f.a?.submittedAt), iso(f.review?.reviewedAt), uname(f.review?.reviewedBy), f.review?.comment || '',
      f.a?.carriedFrom || '', f.c.pdf_page, f.c.flags.map(x => FLAG_T[x] ? H(...FLAG_T[x]) : x).join('; ')] }))

  /* ---------- 3. Requirements (one row per requirement) ---------- */
  table(['المتطلبات', 'Requirements'], 'Requirements', [
    { h: ['الدورة', 'Cycle'], w: 10 }, { h: ['الترتيب', 'Order'], w: 6 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 24 }, { h: ['رقم المحور الفرعي', 'Sub-pillar #'], w: 8 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 26 }, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['نص الكود', 'Code text'], w: 50 }, { h: ['مستوى الأثر', 'Impact'], w: 11 }, { h: ['وزن الأثر', 'Impact weight'], w: 7 },
    { h: ['رقم المتطلب', 'Req #'], w: 6 }, { h: ['المتطلب', 'Requirement'], w: 50 }, { h: ['معيار الرصد', 'Monitoring criterion'], w: 45 },
    { h: ['التقييم', 'Evaluation'], w: 12 }, { h: ['رمز التقييم', 'Evaluation code'], w: 9 }, { h: ['الدرجة', 'Score'], w: 7 }, { h: ['مبرر عدم الانطباق', 'N/A justification'], w: 30 },
    { h: ['عدد الأدلة (المتطلب)', 'Evidence count (requirement)'], w: 8 }, { h: ['الأدلة', 'Evidence'], w: 40 }, { h: ['ملاحظة', 'Note'], w: 30 }, { h: ['مشروع المتطلب', 'Requirement project'], w: 26 }, { h: ['معرّف المشروع', 'Project ID'], w: 9 }, { h: ['الخدمة', 'Service'], w: 18 },
    { h: ['يحتاج توضيح', 'Needs clarification'], w: 9 }, { h: ['سؤال التوضيح', 'Clarification question'], w: 30 }, { h: ['رد المراجع', 'Clarification reply'], w: 30 },
    { h: ['المقيّم (كاتب الإجابة)', 'Evaluator (answer author)'], w: 18 }, { h: ['المُسند إليه', 'Assignee'], w: 18 }, { h: ['معرّف المُسند إليه', 'Assignee ID'], w: 16 }, { h: ['المشروع الرئيسي', 'Primary project'], w: 26 }, { h: ['الإدارة المسؤولة (الكود)', 'Responsible department (code)'], w: 24 }, { h: ['الإدارة المسؤولة (المتطلب)', 'Responsible department (requirement)'], w: 24 }, { h: ['نقاط الأثر', 'Impact points'], w: 8 }, { h: ['النقاط المحققة', 'Points earned'], w: 8, fmt: NUM }, { h: ['محتسب في الاستيفاء', 'Counted in fulfilment'], w: 9 }, { h: ['نتيجة الكود', 'Code score'], w: 9, fmt: NUM }, { h: ['مكتمل', 'Complete'], w: 8 }, { h: ['حالة الكود', 'Code state'], w: 12 }, { h: ['يُحتسب رسمياً', 'Counts officially'], w: 9 }, { h: ['آخر تحديث', 'Updated at'], w: 17, fmt: DATE }, { h: ['تاريخ الإرسال', 'Submitted at'], w: 17, fmt: DATE }, { h: ['صفحة PDF', 'PDF page'], w: 7 },
  ], facts.flatMap(f => { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!; const paired = f.c.criteria.length === f.c.requirements.length
    return f.c.requirements.map((r, i) => { const it = f.a?.items[String(r.n)]; const cl = snap.reviews.clarifications?.[cycleId]?.[f.c.id]?.[String(r.n)]
      const crit = paired ? txt(f.c.criteria[i]) : (i === 0 ? f.c.criteria.map(x => '• ' + txt(x)).join('\n') : '')
      return [cycleId, order.get(f.c.id), Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, desc(f.c), L(IMP_T, f.imp), f.w, r.n, txt(r), crit,
        L(STATUS_T, it?.status), it?.status || '', it?.status && it.status !== 'na' ? cfg.settings.scores[it.status] : null, it?.status === 'na' ? (it.justification || '') : '',
        it?.evidence?.length || 0, (it?.evidence || []).map(ev => ev.title ? `${ev.title}: ${ev.url}` : ev.url).join('\n'), it?.note || '', pname(it?.projectId), it?.projectId || '', it?.service || '',
        YN(!!it?.clarify?.flag), it?.clarify?.question || '', cl?.answer || '',
        uname(f.e.userId), uname(f.assignee) || H('غير مُسند', 'Unassigned'), f.assignee || '', pname(f.primary), dname(f.dept), dname(it?.departmentId || f.dept), PTS[f.imp], it?.status === 'na' ? null : it?.status === 'yes' ? PTS[f.imp] : it?.status === 'partial' ? PTS[f.imp] / 2 : 0, YN(it?.status !== 'na'), f.score === null ? null : Math.round(f.score * 10) / 10, YN(f.complete), L(STATE_T, f.e.state), YN(f.e.state === 'approved'), iso(f.a?.updatedAt), iso(f.a?.submittedAt), f.c.pdf_page] }) }))

  /* ---------- 4. Evidence ---------- */
  table(['الأدلة', 'Evidence'], 'Evidence', [
    { h: ['الدورة', 'Cycle'], w: 10 }, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['رقم المتطلب', 'Req #'], w: 6 }, { h: ['المتطلب', 'Requirement'], w: 44 }, { h: ['العنوان', 'Title'], w: 28 }, { h: ['الرابط', 'Link'], w: 50 }, { h: ['نوع الدليل', 'Evidence type'], w: 22 }, { h: ['أضافه', 'Added by'], w: 18 }, { h: ['تاريخ الإضافة', 'Added at'], w: 17, fmt: DATE }, { h: ['التقييم', 'Evaluation'], w: 10 }, { h: ['حالة الكود', 'Code state'], w: 12 }, { h: ['تم التحقق', 'Verified by reviewer'], w: 9 },
  ], facts.flatMap(f => f.c.requirements.flatMap(r => { const it = f.a?.items[String(r.n)]; return (it?.evidence || []).map(ev => [cycleId, f.c.id, r.n, txt(r), ev.title, ev.url, ev.strength === 'conclusive' ? H('دليل دامغ لا يقبل التعديل', 'Conclusive') : ev.strength === 'editable' ? H('دليل يمكن التعديل فيه', 'Editable') : '', uname(ev.addedBy), iso(ev.addedAt), L(STATUS_T, it?.status), L(STATE_T, f.e.state), YN(!!f.review?.evidenceVerified)]) })))

  /* ---------- 5. Pillars / 6. Sub-pillars ---------- */
  const agg = (list: Code[], cy: string = cycleId) => { const r = rollup(snap, cy, list, true), rw = rollup(snap, cy, list, false); return [r.total, rw.answered, rw.submitted, r.approved, r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100, rw.score === null ? null : rw.score / 100, rw.gaps, rw.clarifications] }
  const aggCols = [{ h: ['أكواد', 'Codes'] as [string, string], w: 8 }, { h: ['مُجاب', 'Answered'] as [string, string], w: 8 }, { h: ['مُرسل', 'Submitted'] as [string, string], w: 8 }, { h: ['معتمد', 'Approved'] as [string, string], w: 8 }, { h: ['الجاهزية', 'Readiness'] as [string, string], w: 9, fmt: PCT }, { h: ['الامتثال (معتمد)', 'Compliance (approved)'] as [string, string], w: 11, fmt: PCT }, { h: ['الامتثال (الكل)', 'Compliance (all)'] as [string, string], w: 11, fmt: PCT }, { h: ['فجوات', 'Gaps'] as [string, string], w: 7 }, { h: ['توضيحات', 'Clarifications'] as [string, string], w: 8 }]
  const CY = { h: ['الدورة', 'Cycle'] as [string, string], w: 10 }
  table(['المحاور', 'Pillars'], 'Pillars', [CY, { h: ['رقم المحور', 'Pillar #'], w: 5 }, { h: ['المحور', 'Pillar'], w: 40 }, { h: ['محاور فرعية', 'Sub-pillars'], w: 8 }, ...aggCols],
    master.pillars.map(pl => [cycleId, Number(pl.id), nm(pl), master.subpillars.filter(x => x.pillar === pl.id).length, ...agg(master.codes.filter(c => c.pillar === pl.id))]))
  table(['المحاور الفرعية', 'Sub-pillars'], 'SubPillars', [CY, { h: ['رقم المحور الفرعي', 'Sub-pillar #'], w: 7 }, { h: ['ترتيب المحور الفرعي', 'Sub-pillar seq'], w: 6 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 26 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 40 }, ...aggCols],
    master.subpillars.map((sb, i) => [cycleId, sb.id, i + 1, Number(sb.pillar), nm(pillarById.get(sb.pillar)!), nm(sb), ...agg(master.codes.filter(c => c.sub === sb.id))]))

  /* ---------- 7. Projects ---------- */
  table(['المشاريع', 'Projects'], 'Projects', [CY, { h: ['معرّف المشروع', 'Project ID'], w: 9 }, { h: ['المشروع', 'Project'], w: 40 }, { h: ['المالك', 'Owner'], w: 20 }, { h: ['نشط', 'Active'], w: 7 }, { h: ['محاور فرعية مغطاة', 'Sub-pillars covered'], w: 24 }, ...aggCols],
    cfg.projects.map(p => { const list = master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id)); return [cycleId, p.id, nm(p), uname(p.ownerId), YN(p.active), [...new Set(list.map(c => c.sub))].sort(sortIds).join(', '), ...agg(list)] }))

  /* ---------- 7b. Departments ---------- */
  table(['حسب الإدارة', 'Departments'], 'Departments', [CY, { h: ['معرّف الإدارة', 'Department ID'], w: 10 }, { h: ['الإدارة', 'Department'], w: 40 }, { h: ['نشطة', 'Active'], w: 7 }, { h: ['أكواد مساندة', 'Supporting on codes'], w: 9 }, ...aggCols],
    (cfg.departments || []).map(d => { const list = facts.filter(f => f.dept === d.id).map(f => f.c); return [cycleId, d.id, nm(d), YN(d.active), facts.filter(f => f.supports.includes(d.id)).length, ...agg(list)] }).filter(r => Number(r[5]) > 0 || Number(r[4]) > 0))

  /* ---------- 7c. Fulfilment (points) ---------- */
  {
    const fr = fulfilRows(snap, cycleId, false); const frA = fulfilRows(snap, cycleId, true)
    const FC = [{ h: ['أكواد', 'Codes'] as [string, string], w: 7 }, { h: ['متطلبات محتسبة', 'Requirements counted'] as [string, string], w: 9 }, { h: ['نعم', 'Yes'] as [string, string], w: 6 }, { h: ['جزئي', 'Partial'] as [string, string], w: 6 }, { h: ['لا', 'No'] as [string, string], w: 6 }, { h: ['غير مُجاب', 'Unanswered'] as [string, string], w: 8 }, { h: ['لا ينطبق', 'N/A'] as [string, string], w: 7 }, { h: ['النقاط المحققة', 'Points earned'] as [string, string], w: 9, fmt: NUM }, { h: ['النقاط الممكنة', 'Points possible'] as [string, string], w: 9 }, { h: ['الاستيفاء (الكل)', 'Fulfilment (all)'] as [string, string], w: 10, fmt: PCT }, { h: ['الاستيفاء (معتمد)', 'Fulfilment (approved)'] as [string, string], w: 10, fmt: PCT }]
    const line = (rs: FulfilRow[], rsA: FulfilRow[]) => { const f = fulfilSum(rs), a = fulfilSum(rsA); return [f.codes, f.counted, f.yes, f.partial, f.no, f.unanswered, f.na, Math.round(f.earned * 10) / 10, f.possible, f.pct === null ? null : f.pct / 100, a.pct === null ? null : a.pct / 100] }
    const groups: unknown[][] = [[cycleId, H('الكل', 'Total'), '', H('كود الإمارات', 'UAE Code'), ...line(fr, frA)]]
    for (const pl of master.pillars) groups.push([cycleId, H('محور', 'Pillar'), Number(pl.id), nm(pl), ...line(fr.filter(r => r.code.pillar === pl.id), frA.filter(r => r.code.pillar === pl.id))])
    for (const sb of master.subpillars) groups.push([cycleId, H('محور فرعي', 'Sub-pillar'), sb.id, nm(sb), ...line(fr.filter(r => r.code.sub === sb.id), frA.filter(r => r.code.sub === sb.id))])
    for (const u of cfg.users.filter(x => x.active && x.role !== 'viewer')) groups.push([cycleId, H('مقيّم', 'Evaluator'), u.id, uname(u.id), ...line(fr.filter(r => r.assignee === u.id), frA.filter(r => r.assignee === u.id))])
    for (const d of cfg.departments || []) { const rs = fr.filter(r => r.dept === d.id); if (rs.length) groups.push([cycleId, H('إدارة', 'Department'), d.id, nm(d), ...line(rs, frA.filter(r => r.dept === d.id))]) }
    const none = fr.filter(r => !r.dept); if (none.length) groups.push([cycleId, H('إدارة', 'Department'), '', H('بدون إدارة', 'No department'), ...line(none, frA.filter(r => !r.dept))])
    table(['الاستيفاء', 'Fulfilment'], 'Fulfilment', [CY, { h: ['المستوى', 'Level'], w: 10 }, { h: ['المعرّف', 'ID'], w: 10 }, { h: ['الاسم', 'Name'], w: 40 }, ...FC], groups)
  }

  /* ---------- 8. Evaluators (standings) ---------- */
  const st = standings(snap, cycleId)
  table(['المقيّمون', 'Evaluators'], 'Evaluators', [CY, { h: ['المركز', 'Rank'], w: 7 }, { h: ['المقيّم', 'Evaluator'], w: 22 }, { h: ['المعرّف', 'User ID'], w: 18 }, { h: ['الدور', 'Role'], w: 10 }, { h: ['المشاريع', 'Projects'], w: 8 }, { h: ['أكواد مُسندة', 'Assigned codes'], w: 9 }, { h: ['مُجاب', 'Answered'], w: 8 }, { h: ['معتمد', 'Approved'], w: 8 }, { h: ['نسبة الاعتماد', 'Approval rate'], w: 9, fmt: PCT }, { h: ['الامتثال', 'Compliance'], w: 9, fmt: PCT }, { h: ['النقاط', 'Points'], w: 8, fmt: NUM }, { h: ['توضيحات مفتوحة', 'Open clarifications'], w: 9 }],
    cfg.users.filter(u => u.active && u.role !== 'viewer').map(u => { const sx = st.find(x => x.userId === u.id); const mine = facts.filter(f => f.assignee === u.id)
      return [cycleId, sx?.rank ?? null, uname(u.id), u.id, L(ROLE_T, u.role), cfg.projects.filter(p => p.active && p.ownerId === u.id).length, mine.length, sx?.answered ?? mine.filter(f => f.answered === f.c.requirements.length).length, sx?.approved ?? 0, sx ? sx.approvedPct / 100 : null, sx?.score === null || sx?.score === undefined ? null : sx.score / 100, sx ? Math.round(sx.points * 10) / 10 : null, mine.reduce((n, f) => n + f.clar, 0)] }).sort((a, b) => (Number(a[1]) || 99) - (Number(b[1]) || 99)))

  /* ---------- 9. Gaps ---------- */
  table(['الفجوات', 'Gaps'], 'Gaps', [CY, { h: ['الترتيب', 'Order'], w: 6 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 24 }, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['نص الكود', 'Code text'], w: 55 }, { h: ['مستوى الأثر', 'Impact'], w: 11 }, { h: ['وزن الأثر', 'Weight'], w: 7 }, { h: ['نتيجة الكود', 'Code score'], w: 9, fmt: NUM }, { h: ['الفجوة المرجحة', 'Weighted gap'], w: 9, fmt: NUM }, { h: ['المتطلبات غير المستوفاة', 'Unmet requirements'], w: 60 }, { h: ['المشروع الرئيسي', 'Primary project'], w: 24 }, { h: ['المُسند إليه', 'Assignee'], w: 18 }, { h: ['حالة الكود', 'State'], w: 12 }, { h: ['يُحتسب رسمياً', 'Counts officially'], w: 9 }],
    facts.filter(f => f.score !== null && f.score < 100 && (f.complete || f.e.state === 'approved')).sort((a, b) => (b.w - a.w) || (a.score! - b.score!)).map(f => [cycleId, order.get(f.c.id), Number(f.c.pillar), nm(pillarById.get(f.c.pillar)!), f.c.id, desc(f.c), L(IMP_T, f.imp), f.w, Math.round(f.score! * 10) / 10, Math.round((100 - f.score!) * f.w * 10) / 10,
      f.c.requirements.filter(r => { const s0 = f.a?.items[String(r.n)]?.status; return s0 === 'no' || s0 === 'partial' }).map(r => `${r.n}. ${txt(r)} (${L(STATUS_T, f.a!.items[String(r.n)].status)})`).join('\n'), pname(f.primary), uname(f.assignee) || H('غير مُسند', 'Unassigned'), L(STATE_T, f.e.state), YN(f.e.state === 'approved')]))

  /* ---------- 10. Clarifications ---------- */
  table(['طلبات التوضيح', 'Clarifications'], 'Clarifications', [CY, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['رقم المتطلب', 'Req #'], w: 6 }, { h: ['المتطلب', 'Requirement'], w: 50 }, { h: ['السؤال', 'Question'], w: 40 }, { h: ['المقيّم', 'Evaluator'], w: 18 }, { h: ['تاريخ الطلب', 'Raised at'], w: 17, fmt: DATE }, { h: ['الرد', 'Reply'], w: 40 }, { h: ['رد بواسطة', 'Replied by'], w: 18 }, { h: ['تاريخ الرد', 'Replied at'], w: 17, fmt: DATE }, { h: ['الحالة', 'Status'], w: 10 }],
    facts.flatMap(f => f.c.requirements.flatMap(r => { const it = f.a?.items[String(r.n)]; if (!it?.clarify?.flag) return []; const cl = snap.reviews.clarifications?.[cycleId]?.[f.c.id]?.[String(r.n)]
      return [[cycleId, f.c.id, r.n, txt(r), it.clarify.question, uname(f.e.userId), iso(it.clarify.raisedAt), cl?.answer || '', uname(cl?.answeredBy), iso(cl?.answeredAt), cl ? H('تم الرد', 'Replied') : H('مفتوح', 'Open')]] })))

  /* ---------- 11. Cycles & trend ---------- */
  const cyc = [...cfg.cycles].sort((a, b) => a.start.localeCompare(b.start))
  table(['الدورات', 'Cycles'], 'Cycles', [{ h: ['معرّف الدورة', 'Cycle ID'], w: 10 }, { h: ['الدورة', 'Cycle'], w: 30 }, { h: ['الحالة', 'Status'], w: 12 }, { h: ['البداية', 'Start'], w: 11, fmt: 'yyyy-mm-dd' }, { h: ['النهاية', 'End'], w: 11, fmt: 'yyyy-mm-dd' }, { h: ['الاستحقاق', 'Due'], w: 11, fmt: 'yyyy-mm-dd' }, { h: ['مُرحّلة من', 'Prefilled from'], w: 10 }, ...aggCols],
    cyc.map(c => [c.id, cname(c), L(CYS_T, c.status), day(c.start), day(c.end), day(c.due), c.prefillFrom || '', ...agg(master.codes, c.id)]))
  table(['الاتجاه', 'Trend'], 'Trend', [{ h: ['المستوى', 'Level'], w: 10 }, { h: ['#', '#'], w: 7 }, { h: ['الاسم', 'Name'], w: 36 }, ...cyc.flatMap(c => [{ h: [`${c.id} ${'جاهزية'}`, `${c.id} readiness`] as [string, string], w: 12, fmt: PCT }, { h: [`${c.id} ${'امتثال'}`, `${c.id} compliance`] as [string, string], w: 12, fmt: PCT }])],
    [[H('الإجمالي', 'Total'), '', H('كل الأكواد', 'All codes'), ...cyc.flatMap(c => { const r = rollup(snap, c.id, master.codes, true); return [r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100] })],
      ...master.pillars.map(pl => [H('محور', 'Pillar'), Number(pl.id), nm(pl), ...cyc.flatMap(c => { const r = rollup(snap, c.id, master.codes.filter(x => x.pillar === pl.id), true); return [r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100] })]),
      ...master.subpillars.map(sb => [H('محور فرعي', 'Sub-pillar'), sb.id, nm(sb), ...cyc.flatMap(c => { const r = rollup(snap, c.id, master.codes.filter(x => x.sub === sb.id), true); return [r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100] })])])

  /* ---------- 12. Mapping / 13. Users / 14. Audit ---------- */
  table(['ربط المشاريع', 'Project mapping'], 'Mapping', [CY, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 34 }, { h: ['المشروع', 'Project'], w: 36 }, { h: ['معرّف المشروع', 'Project ID'], w: 9 }, { h: ['مالك المشروع', 'Project owner'], w: 20 }, { h: ['المُسند إليه فعلياً', 'Effective assignee'], w: 20 }, { h: ['إسناد يدوي', 'Manual override'], w: 9 }],
    facts.flatMap(f => (f.links.length ? f.links : [null]).map(pid => [cycleId, f.c.id, nm(subById.get(f.c.sub)!), pid ? pname(pid) : H('— بدون مشروع', '— no project'), pid || '', uname(pid ? cfg.projects.find(p => p.id === pid)?.ownerId : null), uname(f.assignee) || H('غير مُسند', 'Unassigned'), YN(!!cfg.overrides[cycleId]?.[f.c.id])])))
  table(['السجل', 'Audit log'], 'Audit', [{ h: ['الوقت', 'Time'], w: 17, fmt: DATE }, { h: ['بواسطة', 'By'], w: 20 }, { h: ['الإجراء', 'Action'], w: 12 }, { h: ['الهدف', 'Target'], w: 30 }],
    [...snap.audit].reverse().map(a => [iso(a.at), uname(a.by) || a.by, a.action, a.target]))

  /* ---------- 15. Dictionary ---------- */
  const d = wb.addWorksheet(SN('دليل الأعمدة', 'Dictionary')); d.views = [{ rightToLeft: rtl }]; d.columns = [{ width: 24 }, { width: 30 }, { width: 90 }]
  d.addRows([[H('الورقة', 'Sheet'), H('العمود', 'Column'), H('المعنى', 'Meaning')],
    [H('المتابعة', 'Tracking'), H('نتيجة الكود', 'Code score'), H('تظهر مرة واحدة لكل كود في صف متطلبه الأول، فتبقى المجاميع والمتوسطات على مستوى الكود. للتحليل استخدم ورقة الأكواد أو المتطلبات.', 'Appears once per code on its first requirement row so SUM/AVERAGE stay per code. For analysis use the Codes or Requirements sheets.')],
    [H('المتابعة', 'Tracking'), H('نتائج الرصد / الدليل', 'Monitoring result / evidence'), H('روابط الأدلة سطرًا سطرًا، ويليها مبرر عدم الانطباق عند اختيار "لا ينطبق".', 'Evidence links one per line, followed by the N/A justification when "N/A" is chosen.')],
    [H('المتابعة', 'Tracking'), H('جميع معايير الرصد', 'All monitoring criteria'), H('عندما لا يتساوى عدد معايير الرصد مع عدد المتطلبات (10 أكواد)، تُدرج القائمة كاملة في كل صف.', 'When the criteria count differs from the requirements count (10 codes) the full list is repeated on every row.')],
    [H('الأكواد', 'Codes'), H('نتيجة الكود', 'Code score'), `${H('متوسط درجات المتطلبات المُجابة', 'Average of answered requirement scores')} (${H('نعم', 'Yes')}=${cfg.settings.scores.yes}، ${H('جزئي', 'Partial')}=${cfg.settings.scores.partial}، ${H('لا', 'No')}=${cfg.settings.scores.no})، ${H('مع استبعاد "لا ينطبق". فارغ إذا لم يُجب عن أي متطلب.', 'N/A excluded. Blank when nothing is answered.')}`],
    [H('الاستيفاء', 'Fulfilment'), H('النقاط', 'Points'), `${H('نقاط كل متطلب بحسب أثر معياره', 'Each requirement is worth its code\'s impact points')}: ${H('عالي', 'High')} ${PTS.high} · ${H('متوسط', 'Medium')} ${PTS.medium} · ${H('منخفض', 'Low')} ${PTS.low}. ${H('نعم = كامل النقاط، جزئي = النصف، لا = صفر، لا ينطبق مستبعد، غير المُجاب = صفر.', 'Yes = all points, Partial = half, No = none, N/A excluded, unanswered = none.')}`],
    [H('عام', 'General'), H('الإدارة المسؤولة', 'Responsible department'), H('الوحدة التنظيمية المسؤولة عن الكود وفق الهيكل التنظيمي (قرار 18 لسنة 2023)، أو اختيار مالك الكود إن عدّلها. على مستوى المتطلب تُورَّث من الكود ما لم يحددها المالك.', 'Organisational unit responsible for the code per the structure decision 18/2023, or the owner\'s own choice when adjusted. At requirement level it is inherited from the code unless the owner sets one.')],
    [H('عام', 'General'), H('الترتيب', 'Order'), H('رقم تسلسلي للكود بترتيب المستند (1.9 قبل 1.10)؛ استخدمه للفرز بدل معرّف الكود النصي.', 'Sequential number of the code in document order (1.9 before 1.10); sort by it instead of the text ID.')],
    [H('عام', 'General'), H('المُسند إليه / المقيّم', 'Assignee / Evaluator'), H('المُسند إليه هو المسؤول عن الكود في الدورة؛ المقيّم هو من كتب الإجابة المعتمدة (عادة الشخص نفسه).', 'Assignee owns the code in this cycle; Evaluator wrote the effective answer (usually the same person).')],
    [H('الأكواد', 'Codes'), H('النقاط المرجحة', 'Weighted points'), H('نتيجة الكود × وزن الأثر. مجموعها ÷ مجموع الأوزان = الامتثال المرجح.', 'Code score × impact weight. Sum ÷ sum of weights = weighted compliance.')],
    [H('الأكواد', 'Codes'), H('يُحتسب رسمياً', 'Counts officially'), H('نعم فقط للأكواد المعتمدة من المراجع. الأرقام الرسمية تُحسب من هذه الأكواد.', 'Yes only for reviewer-approved codes. Official numbers use these codes only.')],
    [H('الأكواد', 'Codes'), H('المقيّم / المُسند إليه', 'Evaluator / Assignee'), H('المقيّم هو من كتب الإجابة المعتمدة؛ المُسند إليه هو المسؤول الحالي عن الكود في الدورة.', 'Evaluator wrote the effective answer; Assignee is who currently owns the code in this cycle.')],
    [H('المتطلبات', 'Requirements'), H('رمز التقييم', 'Evaluation code'), 'yes / partial / no / na'],
    [H('المتطلبات', 'Requirements'), H('معيار الرصد', 'Monitoring criterion'), H('من المستند الرسمي، مقترن بالمتطلب بنفس الترتيب عندما يتساوى العدد.', 'From the official document, paired to the requirement by order when counts match.')],
    [H('المحاور', 'Pillars'), H('الجاهزية', 'Readiness'), H('الأكواد المعتمدة ÷ إجمالي الأكواد.', 'Approved codes ÷ total codes.')],
    [H('المحاور', 'Pillars'), H('الامتثال (معتمد) / (الكل)', 'Compliance (approved) / (all)'), H('الامتثال المرجح على الأكواد المعتمدة فقط، أو على كل كود أُجيب عنه بالكامل.', 'Weighted compliance on approved codes only, or on every fully answered code.')],
    [H('المقيّمون', 'Evaluators'), H('النقاط', 'Points'), H('0.5 × نسبة الاعتماد + 0.5 × الامتثال على ما أُجيب عنه (0–100).', '0.5 × approval rate + 0.5 × compliance on answered codes (0–100).')],
    [H('الفجوات', 'Gaps'), H('الفجوة المرجحة', 'Weighted gap'), H('(100 − نتيجة الكود) × وزن الأثر؛ كلما كبرت كان الأثر على الامتثال أكبر.', '(100 − code score) × impact weight; larger means more effect on compliance.')],
    [H('الاتجاه', 'Trend'), '', H('الجاهزية والامتثال (معتمد فقط) لكل دورة، على مستوى الإجمالي والمحاور والمحاور الفرعية.', 'Readiness and compliance (approved only) per cycle at total, pillar and sub-pillar level.')],
    [H('عام', 'General'), H('التواريخ', 'Dates'), H('قيم تاريخ/وقت حقيقية في Excel بالتوقيت المحلي للجهاز الذي صدّر الملف.', 'Real Excel date/time values in the local time of the computer that exported the file.')],
    [H('عام', 'General'), H('النسب', 'Percentages'), H('قيم رقمية بين 0 و1 منسقة كنسبة مئوية، صالحة للجداول المحورية.', 'Numeric 0–1 values formatted as percentages, pivot-ready.')],
  ]); d.getRow(1).font = { bold: true }; d.getColumn(1).font = { bold: true }

  /* Excel decides paragraph direction per cell; force it so Arabic lines that start with "1." read right-to-left. */
  const ro = rtl ? 'rtl' as const : 'ltr' as const
  wb.eachSheet(ws => { (ws.columns || []).forEach(col => { if (col.alignment) col.alignment = { ...col.alignment, readingOrder: ro } })
    ws.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: true }, cell => { cell.alignment = { ...(cell.alignment || {}), readingOrder: ro } })) })
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `UAE-Code-Championship_${cycleId}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
