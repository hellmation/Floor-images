import ExcelJS from 'exceljs'
import type { Lang, Snapshot, Code } from '../types'
import { master, effective, codeScore, effectiveImpact, assigneeOf, rollup, standings, sortIds, subById, pillarById } from '../store/scoring'

let LANG: Lang = 'ar'
const H = (ar: string, en: string) => LANG === 'ar' ? ar : en
const SN = (ar: string, en: string) => H(ar, en).slice(0, 31)
const STATUS_T: Record<string, [string, string]> = { yes: ['نعم', 'Yes'], partial: ['جزئي', 'Partial'], no: ['لا', 'No'], na: ['لا ينطبق', 'N/A'] }
const STATE_T: Record<string, [string, string]> = { none: ['لم يبدأ', 'Not started'], draft: ['مسودة', 'Draft'], submitted: ['مُرسل', 'Submitted'], returned: ['مُعاد', 'Returned'], approved: ['معتمد', 'Approved'] }
const IMP_T: Record<string, [string, string]> = { high: ['عالي', 'High'], medium: ['متوسط', 'Medium'], low: ['منخفض', 'Low'], none: ['غير محدد', 'Not specified'] }
const CYS_T: Record<string, [string, string]> = { planning: ['تخطيط', 'Planning'], open: ['مفتوحة', 'Open'], review: ['قيد المراجعة', 'In review'], closed: ['مغلقة', 'Closed'] }
const ROLE_T: Record<string, [string, string]> = { admin: ['مدير', 'Admin'], evaluator: ['مقيّم', 'Evaluator'], viewer: ['مطّلع', 'Viewer'] }
const L = (m: Record<string, [string, string]>, k?: string | null) => k && m[k] ? H(...m[k]) : ''
const iso = (s?: string | null) => s ? new Date(s) : null

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
  const DATE = 'yyyy-mm-dd hh:mm', PCT = '0%', NUM = '0.0'

  /** Adds a sheet as an Excel table (filterable, pivot-ready) with typed columns. */
  const table = (title: [string, string], tname: string, cols: { h: [string, string]; w: number; fmt?: string }[], rows: unknown[][]) => {
    const ws = wb.addWorksheet(SN(...title)); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }]
    if (rows.length === 0) rows = [cols.map(() => '')]
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
    const links = cfg.mapping[c.id] || []; const primary = links[0]; const owner = primary ? cfg.projects.find(p => p.id === primary)?.ownerId : null
    const evid = items.reduce((n, it) => n + (it?.evidence?.length || 0), 0)
    const clar = items.filter(it => it?.clarify?.flag).length
    return { c, e, a, imp, w, cnt, answered, score, links, primary, owner, evid, clar, assignee: assigneeOf(c.id, cycleId, cfg) }
  })

  /* ---------- 0. Tracking sheet: the original template's columns plus management columns ---------- */
  {
    const ws = wb.addWorksheet(SN('المتابعة', 'Tracking')); ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }]
    const cols: { h: [string, string]; w: number; c?: boolean; fmt?: string }[] = [
      { h: ['#', '#'], w: 4, c: true }, { h: ['المحور', 'Pillar'], w: 22 }, { h: ['#', '#'], w: 6, c: true }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 24 }, { h: ['#', '#'], w: 7, c: true }, { h: ['المعيار', 'Code'], w: 55 }, { h: ['مستوى الأثر', 'Impact'], w: 10, c: true }, { h: ['جميع المتطلبات', 'All requirements'], w: 50 }, { h: ['جميع معايير الرصد', 'All monitoring criteria'], w: 50 },
      { h: ['#', '#'], w: 4, c: true }, { h: ['المتطلب', 'Requirement'], w: 45 }, { h: ['معيار الرصد', 'Monitoring criterion'], w: 40 }, { h: ['التقييم', 'Evaluation'], w: 11, c: true }, { h: ['نتائج الرصد / الدليل', 'Monitoring result / evidence'], w: 40 }, { h: ['عدد الأدلة', 'Evidence count'], w: 8, c: true },
      { h: ['المسؤول عن التقييم', 'Responsible evaluator'], w: 20 }, { h: ['المشروع', 'Project'], w: 30 }, { h: ['مالك المشروع', 'Project owner'], w: 18 }, { h: ['حالة الكود', 'Code state'], w: 12, c: true }, { h: ['نتيجة الكود', 'Code score'], w: 9, c: true, fmt: NUM },
      { h: ['المراجع', 'Reviewer'], w: 16 }, { h: ['تاريخ آخر تحديث', 'Last updated'], w: 16, c: true, fmt: DATE }, { h: ['يحتاج توضيح', 'Needs clarification'], w: 9, c: true }, { h: ['ملاحظات', 'Notes'], w: 30 },
    ]
    cols.forEach((c, i) => { const cell = ws.getCell(1, i + 1); cell.value = H(...c.h); cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA7812D' } }; cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      const col = ws.getColumn(i + 1); col.width = c.w; col.alignment = { wrapText: true, vertical: 'top', horizontal: c.c ? 'center' : (rtl ? 'right' : 'left') }; if (c.fmt) col.numFmt = c.fmt })
    ws.getRow(1).height = 32
    for (const f of facts) { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!; const paired = f.c.criteria.length === f.c.requirements.length
      const owners = [...new Set(f.links.map(pid => cfg.projects.find(p => p.id === pid)?.ownerId).filter(Boolean))].map(id => uname(id as string)).join(' | ')
      const allReq = f.c.requirements.map(x => `${x.n}. ${txt(x)}`).join('\n'), allCrit = f.c.criteria.map(x => `${x.n}. ${txt(x)}`).join('\n')
      f.c.requirements.forEach((r, i) => { const it = f.a?.items[String(r.n)]; const crit = paired ? txt(f.c.criteria[i]) : allCrit
        const row = ws.addRow([Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, desc(f.c), L(IMP_T, f.imp), allReq, allCrit, r.n, txt(r), crit, L(STATUS_T, it?.status),
          [(it?.evidence || []).map(ev => ev.title ? `${ev.title}: ${ev.url}` : ev.url).join('\n'), it?.status === 'na' && it.justification ? `${H('مبرر عدم الانطباق', 'N/A justification')}: ${it.justification}` : ''].filter(Boolean).join('\n'), it?.evidence?.length || 0,
          uname(f.assignee) || H('الفريق الأساسي (غير مُسند بعد)', 'Core team (not assigned yet)'), f.links.map(pname).join(' | '), owners, L(STATE_T, f.e.state), i === 0 && f.score !== null ? Math.round(f.score * 10) / 10 : null,
          uname(f.e.review?.reviewedBy), iso(f.a?.updatedAt), it?.clarify?.flag ? H('نعم', 'Yes') : '', [it?.note, it?.clarify?.flag ? `${H('سؤال', 'Question')}: ${it.clarify.question}` : '', f.e.review?.comment ? `${H('المراجع', 'Reviewer')}: ${f.e.review.comment}` : ''].filter(Boolean).join(' | ')])
        let lines = 1; row.eachCell((cell, n) => { const v = cell.value == null ? '' : String(cell.value); const w = cols[n - 1].w * 1.9; const l = v.split('\n').reduce((a, part) => a + Math.max(1, Math.ceil(part.length / w)), 0); if (l > lines) lines = l }); row.height = Math.min(409, 15 * lines + 4) }) }
    const last = ws.rowCount
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
    for (let r = 2; r <= last; r++) { ws.getCell(`M${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${['yes', 'partial', 'no', 'na'].map(k => L(STATUS_T, k)).join(',')}"`] }; ws.getCell(`S${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${['none', 'draft', 'submitted', 'returned', 'approved'].map(k => L(STATE_T, k)).join(',')}"`] } }
  }

  /* ---------- 1. Summary ---------- */
  const all = rollup(snap, cycleId, master.codes, true), allW = rollup(snap, cycleId, master.codes, false)
  const s = wb.addWorksheet(SN('الملخص', 'Summary')); s.views = [{ rightToLeft: rtl }]
  s.columns = [{ width: 44 }, { width: 26 }, { width: 26 }]
  const rows: unknown[][] = [
    [H('الجهة', 'Entity'), lang === 'ar' ? cfg.entity.name_ar : cfg.entity.name_en],
    [H('الدورة', 'Cycle'), cname(cycle), cycle ? L(CYS_T, cycle.status) : ''],
    [H('معرّف الدورة', 'Cycle ID'), cycleId], [H('فترة الدورة', 'Cycle period'), cycle?.start || '', cycle?.end || ''], [H('تاريخ الاستحقاق', 'Due date'), cycle?.due || ''],
    [H('تاريخ التصدير', 'Exported at'), new Date()], [],
    ['', H('المعتمد فقط', 'Approved only'), H('كل ما أُجيب عنه', 'All answered')],
    [H('إجمالي الأكواد', 'Total codes'), all.total, allW.total],
    [H('أكواد مُجابة', 'Codes answered'), all.answered, allW.answered],
    [H('أكواد مُرسلة', 'Codes submitted'), all.submitted, allW.submitted],
    [H('أكواد معتمدة', 'Codes approved'), all.approved, allW.approved],
    [H('الجاهزية (معتمد ÷ الإجمالي)', 'Readiness (approved ÷ total)'), all.total ? all.approved / all.total : 0, allW.total ? allW.answered / allW.total : 0],
    [H('الامتثال المرجح', 'Weighted compliance'), all.score === null ? null : all.score / 100, allW.score === null ? null : allW.score / 100],
    [H('الفجوات (نتيجة أقل من 100)', 'Gaps (score below 100)'), all.gaps, allW.gaps],
    [H('طلبات التوضيح المفتوحة', 'Open clarification requests'), allW.clarifications],
    [H('المقيّمون النشطون', 'Active evaluators'), cfg.users.filter(u => u.active && u.role !== 'viewer').length],
    [H('المشاريع النشطة', 'Active projects'), cfg.projects.filter(p => p.active).length],
    [H('أكواد غير مرتبطة بمشروع', 'Codes without a project'), facts.filter(f => !f.links.length).length], [],
    [H('قاعدة الاحتساب', 'Scoring rule'), `${H('نعم', 'Yes')}=${cfg.settings.scores.yes} · ${H('جزئي', 'Partial')}=${cfg.settings.scores.partial} · ${H('لا', 'No')}=${cfg.settings.scores.no} · ${H('لا ينطبق مستبعد', 'N/A excluded')}`],
    [H('أوزان الأثر', 'Impact weights'), `${H('عالي', 'High')}=${cfg.settings.weights.high} · ${H('متوسط', 'Medium')}=${cfg.settings.weights.medium} · ${H('منخفض', 'Low')}=${cfg.settings.weights.low} · ${H('غير محدد', 'Not specified')}=${cfg.settings.weights.none}`],
    [H('نتيجة الكود', 'Code score'), H('متوسط درجات متطلباته (0–100)', 'Average of its requirement scores (0–100)')],
    [H('الامتثال المرجح', 'Weighted compliance'), H('مجموع (نتيجة الكود × الوزن) ÷ مجموع الأوزان', 'Sum of (code score × weight) ÷ sum of weights')],
    [H('نقاط الترتيب', 'Standings points'), H('نصف نسبة الاعتماد + نصف الامتثال على ما أُجيب عنه', 'Half approval rate + half compliance on answered codes')],
  ]
  s.addRows(rows); s.getColumn(1).font = { bold: true }; s.getCell('B6').numFmt = DATE; ['B13', 'C13', 'B14', 'C14'].forEach(a => { s.getCell(a).numFmt = PCT })
  s.getRow(8).font = { bold: true }

  /* ---------- 2. Codes (one row per code) ---------- */
  table(['الأكواد', 'Codes'], 'Codes', [
    { h: ['الدورة', 'Cycle'], w: 10 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 26 }, { h: ['المحور الفرعي #', 'Sub-pillar #'], w: 8 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 28 },
    { h: ['الكود', 'Code ID'], w: 9 }, { h: ['رقم الكود في المستند', 'PDF code #'], w: 9 }, { h: ['نص الكود', 'Code text'], w: 60 }, { h: ['مستوى الأثر', 'Impact'], w: 11 }, { h: ['وزن الأثر', 'Impact weight'], w: 8 },
    { h: ['عدد المتطلبات', 'Requirements'], w: 8 }, { h: ['مُجاب', 'Answered'], w: 8 }, { h: ['نعم', 'Yes'], w: 6 }, { h: ['جزئي', 'Partial'], w: 6 }, { h: ['لا', 'No'], w: 6 }, { h: ['لا ينطبق', 'N/A'], w: 7 },
    { h: ['نتيجة الكود', 'Code score'], w: 9, fmt: NUM }, { h: ['النقاط المرجحة', 'Weighted points'], w: 9, fmt: NUM }, { h: ['مكتمل', 'Complete'], w: 8 }, { h: ['حالة الكود', 'State'], w: 12 }, { h: ['يُحتسب رسمياً', 'Counts officially'], w: 9 },
    { h: ['المقيّم', 'Evaluator'], w: 20 }, { h: ['معرّف المقيّم', 'Evaluator ID'], w: 16 }, { h: ['المُسند إليه', 'Assignee'], w: 20 }, { h: ['المشاريع المرتبطة', 'Linked projects'], w: 34 }, { h: ['المشروع الرئيسي', 'Primary project'], w: 26 }, { h: ['مالك المشروع', 'Project owner'], w: 18 },
    { h: ['عدد الأدلة', 'Evidence count'], w: 8 }, { h: ['تم التحقق من الأدلة', 'Evidence verified'], w: 9 }, { h: ['طلبات توضيح مفتوحة', 'Open clarifications'], w: 9 },
    { h: ['آخر تحديث', 'Updated at'], w: 17, fmt: DATE }, { h: ['تاريخ الإرسال', 'Submitted at'], w: 17, fmt: DATE }, { h: ['تاريخ المراجعة', 'Reviewed at'], w: 17, fmt: DATE }, { h: ['المراجع', 'Reviewer'], w: 18 }, { h: ['تعليق المراجع', 'Reviewer comment'], w: 30 },
    { h: ['مُرحّل من', 'Carried from'], w: 10 }, { h: ['صفحة PDF', 'PDF page'], w: 7 }, { h: ['ملاحظات المستند', 'Source flags'], w: 24 },
  ], facts.map(f => { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!
    return [cycleId, Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, f.c.pdf_id, desc(f.c), L(IMP_T, f.imp), f.w,
      f.c.requirements.length, f.answered, f.cnt.yes, f.cnt.partial, f.cnt.no, f.cnt.na,
      f.score === null ? null : Math.round(f.score * 10) / 10, f.score === null ? null : Math.round(f.score * f.w * 10) / 10, f.answered === f.c.requirements.length ? H('نعم', 'Yes') : H('لا', 'No'), L(STATE_T, f.e.state), f.e.state === 'approved' ? H('نعم', 'Yes') : H('لا', 'No'),
      uname(f.e.userId), f.e.userId || '', uname(f.assignee), f.links.map(pname).join(' | '), pname(f.primary), uname(f.owner),
      f.evid, f.e.review?.evidenceVerified ? H('نعم', 'Yes') : '', f.clar,
      iso(f.a?.updatedAt), iso(f.a?.submittedAt), iso(f.e.review?.reviewedAt), uname(f.e.review?.reviewedBy), f.e.review?.comment || '',
      f.a?.carriedFrom || '', f.c.pdf_page, f.c.flags.map(x => x === 'duplicate_id_in_pdf' ? H('رقم مكرر في المستند', 'Duplicate number in PDF') : H('مستوى الأثر غير محدد في المستند', 'Impact not marked in PDF')).join('; ')] }))

  /* ---------- 3. Requirements (one row per requirement) ---------- */
  table(['المتطلبات', 'Requirements'], 'Requirements', [
    { h: ['الدورة', 'Cycle'], w: 10 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 24 }, { h: ['المحور الفرعي #', 'Sub-pillar #'], w: 8 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 26 }, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['نص الكود', 'Code text'], w: 50 }, { h: ['مستوى الأثر', 'Impact'], w: 11 },
    { h: ['رقم المتطلب', 'Req #'], w: 6 }, { h: ['المتطلب', 'Requirement'], w: 50 }, { h: ['معيار الرصد', 'Monitoring criterion'], w: 45 },
    { h: ['التقييم', 'Evaluation'], w: 12 }, { h: ['رمز التقييم', 'Evaluation code'], w: 9 }, { h: ['الدرجة', 'Score'], w: 7 }, { h: ['مبرر عدم الانطباق', 'N/A justification'], w: 30 },
    { h: ['عدد الأدلة', 'Evidence count'], w: 8 }, { h: ['الأدلة', 'Evidence'], w: 40 }, { h: ['ملاحظة', 'Note'], w: 30 }, { h: ['المشروع', 'Project'], w: 26 }, { h: ['معرّف المشروع', 'Project ID'], w: 9 }, { h: ['الخدمة', 'Service'], w: 18 },
    { h: ['يحتاج توضيح', 'Needs clarification'], w: 9 }, { h: ['سؤال التوضيح', 'Clarification question'], w: 30 }, { h: ['رد المراجع', 'Clarification reply'], w: 30 },
    { h: ['المقيّم', 'Evaluator'], w: 18 }, { h: ['حالة الكود', 'Code state'], w: 12 }, { h: ['آخر تحديث', 'Updated at'], w: 17, fmt: DATE }, { h: ['صفحة PDF', 'PDF page'], w: 7 },
  ], facts.flatMap(f => { const sb = subById.get(f.c.sub)!, pl = pillarById.get(f.c.pillar)!; const paired = f.c.criteria.length === f.c.requirements.length
    return f.c.requirements.map((r, i) => { const it = f.a?.items[String(r.n)]; const cl = snap.reviews.clarifications?.[cycleId]?.[f.c.id]?.[String(r.n)]
      const crit = paired ? txt(f.c.criteria[i]) : (i === 0 ? f.c.criteria.map(x => '• ' + txt(x)).join('\n') : '')
      return [cycleId, Number(pl.id), nm(pl), sb.id, nm(sb), f.c.id, desc(f.c), L(IMP_T, f.imp), r.n, txt(r), crit,
        L(STATUS_T, it?.status), it?.status || '', it?.status && it.status !== 'na' ? cfg.settings.scores[it.status] : null, it?.justification || '',
        it?.evidence?.length || 0, (it?.evidence || []).map(ev => ev.title ? `${ev.title}: ${ev.url}` : ev.url).join('\n'), it?.note || '', pname(it?.projectId), it?.projectId || '', it?.service || '',
        it?.clarify?.flag ? H('نعم', 'Yes') : H('لا', 'No'), it?.clarify?.question || '', cl?.answer || '',
        uname(f.e.userId), L(STATE_T, f.e.state), iso(f.a?.updatedAt), f.c.pdf_page] }) }))

  /* ---------- 4. Evidence ---------- */
  table(['الأدلة', 'Evidence'], 'Evidence', [
    { h: ['الكود', 'Code ID'], w: 9 }, { h: ['رقم المتطلب', 'Req #'], w: 6 }, { h: ['المتطلب', 'Requirement'], w: 44 }, { h: ['العنوان', 'Title'], w: 28 }, { h: ['الرابط', 'Link'], w: 50 }, { h: ['أضافه', 'Added by'], w: 18 }, { h: ['تاريخ الإضافة', 'Added at'], w: 17, fmt: DATE }, { h: ['التقييم', 'Evaluation'], w: 10 }, { h: ['حالة الكود', 'Code state'], w: 12 }, { h: ['تم التحقق', 'Verified by reviewer'], w: 9 },
  ], facts.flatMap(f => f.c.requirements.flatMap(r => { const it = f.a?.items[String(r.n)]; return (it?.evidence || []).map(ev => [f.c.id, r.n, txt(r), ev.title, ev.url, uname(ev.addedBy), iso(ev.addedAt), L(STATUS_T, it?.status), L(STATE_T, f.e.state), f.e.review?.evidenceVerified ? H('نعم', 'Yes') : '']) })))

  /* ---------- 5. Pillars / 6. Sub-pillars ---------- */
  const agg = (list: Code[], cy: string = cycleId) => { const r = rollup(snap, cy, list, true), rw = rollup(snap, cy, list, false); return [r.total, rw.answered, rw.submitted, r.approved, r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100, rw.score === null ? null : rw.score / 100, rw.gaps, rw.clarifications] }
  const aggCols = [{ h: ['أكواد', 'Codes'] as [string, string], w: 8 }, { h: ['مُجاب', 'Answered'] as [string, string], w: 8 }, { h: ['مُرسل', 'Submitted'] as [string, string], w: 8 }, { h: ['معتمد', 'Approved'] as [string, string], w: 8 }, { h: ['الجاهزية', 'Readiness'] as [string, string], w: 9, fmt: PCT }, { h: ['الامتثال (معتمد)', 'Compliance (approved)'] as [string, string], w: 11, fmt: PCT }, { h: ['الامتثال (الكل)', 'Compliance (all)'] as [string, string], w: 11, fmt: PCT }, { h: ['فجوات', 'Gaps'] as [string, string], w: 7 }, { h: ['توضيحات', 'Clarifications'] as [string, string], w: 8 }]
  table(['المحاور', 'Pillars'], 'Pillars', [{ h: ['#', '#'], w: 5 }, { h: ['المحور', 'Pillar'], w: 40 }, { h: ['محاور فرعية', 'Sub-pillars'], w: 8 }, ...aggCols],
    master.pillars.map(pl => [Number(pl.id), nm(pl), master.subpillars.filter(x => x.pillar === pl.id).length, ...agg(master.codes.filter(c => c.pillar === pl.id))]))
  table(['المحاور الفرعية', 'Sub-pillars'], 'SubPillars', [{ h: ['#', '#'], w: 7 }, { h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 26 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 40 }, ...aggCols],
    master.subpillars.map(sb => [sb.id, Number(sb.pillar), nm(pillarById.get(sb.pillar)!), nm(sb), ...agg(master.codes.filter(c => c.sub === sb.id))]))

  /* ---------- 7. Projects ---------- */
  table(['المشاريع', 'Projects'], 'Projects', [{ h: ['معرّف المشروع', 'Project ID'], w: 9 }, { h: ['المشروع', 'Project'], w: 40 }, { h: ['المالك', 'Owner'], w: 20 }, { h: ['نشط', 'Active'], w: 7 }, { h: ['محاور فرعية مغطاة', 'Sub-pillars covered'], w: 24 }, ...aggCols],
    cfg.projects.map(p => { const list = master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id)); return [p.id, nm(p), uname(p.ownerId), p.active ? H('نعم', 'Yes') : H('لا', 'No'), [...new Set(list.map(c => c.sub))].sort(sortIds).join(', '), ...agg(list)] }))

  /* ---------- 8. Evaluators (standings) ---------- */
  const st = standings(snap, cycleId)
  table(['المقيّمون', 'Evaluators'], 'Evaluators', [{ h: ['المركز', 'Rank'], w: 7 }, { h: ['المقيّم', 'Evaluator'], w: 22 }, { h: ['المعرّف', 'User ID'], w: 18 }, { h: ['الدور', 'Role'], w: 10 }, { h: ['المشاريع', 'Projects'], w: 8 }, { h: ['أكواد مُسندة', 'Assigned codes'], w: 9 }, { h: ['مُجاب', 'Answered'], w: 8 }, { h: ['معتمد', 'Approved'], w: 8 }, { h: ['نسبة الاعتماد', 'Approval rate'], w: 9, fmt: PCT }, { h: ['الامتثال', 'Compliance'], w: 9, fmt: PCT }, { h: ['النقاط', 'Points'], w: 8, fmt: NUM }, { h: ['توضيحات مفتوحة', 'Open clarifications'], w: 9 }],
    cfg.users.filter(u => u.active).map(u => { const sx = st.find(x => x.userId === u.id); const mine = facts.filter(f => f.assignee === u.id)
      return [sx?.rank ?? '', uname(u.id), u.id, L(ROLE_T, u.role), cfg.projects.filter(p => p.active && p.ownerId === u.id).length, mine.length, sx?.answered ?? mine.filter(f => f.answered === f.c.requirements.length).length, sx?.approved ?? 0, sx ? sx.approvedPct / 100 : null, sx?.score === null || sx?.score === undefined ? null : sx.score / 100, sx ? Math.round(sx.points * 10) / 10 : null, mine.reduce((n, f) => n + f.clar, 0)] }).sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99)))

  /* ---------- 9. Gaps ---------- */
  table(['الفجوات', 'Gaps'], 'Gaps', [{ h: ['رقم المحور', 'Pillar #'], w: 7 }, { h: ['المحور', 'Pillar'], w: 24 }, { h: ['الكود', 'Code ID'], w: 9 }, { h: ['نص الكود', 'Code text'], w: 55 }, { h: ['مستوى الأثر', 'Impact'], w: 11 }, { h: ['وزن الأثر', 'Weight'], w: 7 }, { h: ['نتيجة الكود', 'Code score'], w: 9, fmt: NUM }, { h: ['الفجوة المرجحة', 'Weighted gap'], w: 9, fmt: NUM }, { h: ['المتطلبات غير المستوفاة', 'Unmet requirements'], w: 60 }, { h: ['المشروع الرئيسي', 'Primary project'], w: 24 }, { h: ['المقيّم', 'Evaluator'], w: 18 }, { h: ['حالة الكود', 'State'], w: 12 }],
    facts.filter(f => f.score !== null && f.score < 100).sort((a, b) => (b.w - a.w) || (a.score! - b.score!)).map(f => [Number(f.c.pillar), nm(pillarById.get(f.c.pillar)!), f.c.id, desc(f.c), L(IMP_T, f.imp), f.w, Math.round(f.score! * 10) / 10, Math.round((100 - f.score!) * f.w * 10) / 10,
      f.c.requirements.filter(r => { const s0 = f.a?.items[String(r.n)]?.status; return s0 === 'no' || s0 === 'partial' }).map(r => `${r.n}. ${txt(r)} (${L(STATUS_T, f.a!.items[String(r.n)].status)})`).join('\n'), pname(f.primary), uname(f.e.userId), L(STATE_T, f.e.state)]))

  /* ---------- 10. Clarifications ---------- */
  table(['طلبات التوضيح', 'Clarifications'], 'Clarifications', [{ h: ['الكود', 'Code ID'], w: 9 }, { h: ['رقم المتطلب', 'Req #'], w: 6 }, { h: ['المتطلب', 'Requirement'], w: 50 }, { h: ['السؤال', 'Question'], w: 40 }, { h: ['المقيّم', 'Evaluator'], w: 18 }, { h: ['تاريخ الطلب', 'Raised at'], w: 17, fmt: DATE }, { h: ['الرد', 'Reply'], w: 40 }, { h: ['رد بواسطة', 'Replied by'], w: 18 }, { h: ['تاريخ الرد', 'Replied at'], w: 17, fmt: DATE }, { h: ['الحالة', 'Status'], w: 10 }],
    facts.flatMap(f => f.c.requirements.flatMap(r => { const it = f.a?.items[String(r.n)]; if (!it?.clarify?.flag) return []; const cl = snap.reviews.clarifications?.[cycleId]?.[f.c.id]?.[String(r.n)]
      return [[f.c.id, r.n, txt(r), it.clarify.question, uname(f.e.userId), iso(it.clarify.raisedAt), cl?.answer || '', uname(cl?.answeredBy), iso(cl?.answeredAt), cl ? H('تم الرد', 'Replied') : H('مفتوح', 'Open')]] })))

  /* ---------- 11. Cycles & trend ---------- */
  const cyc = [...cfg.cycles].sort((a, b) => a.start.localeCompare(b.start))
  table(['الدورات', 'Cycles'], 'Cycles', [{ h: ['معرّف الدورة', 'Cycle ID'], w: 10 }, { h: ['الدورة', 'Cycle'], w: 30 }, { h: ['الحالة', 'Status'], w: 12 }, { h: ['البداية', 'Start'], w: 11 }, { h: ['النهاية', 'End'], w: 11 }, { h: ['الاستحقاق', 'Due'], w: 11 }, { h: ['مُرحّلة من', 'Prefilled from'], w: 10 }, ...aggCols],
    cyc.map(c => [c.id, cname(c), L(CYS_T, c.status), c.start, c.end, c.due, c.prefillFrom || '', ...agg(master.codes, c.id)]))
  table(['الاتجاه', 'Trend'], 'Trend', [{ h: ['المستوى', 'Level'], w: 10 }, { h: ['#', '#'], w: 7 }, { h: ['الاسم', 'Name'], w: 36 }, ...cyc.flatMap(c => [{ h: [`${c.id} ${'جاهزية'}`, `${c.id} readiness`] as [string, string], w: 12, fmt: PCT }, { h: [`${c.id} ${'امتثال'}`, `${c.id} compliance`] as [string, string], w: 12, fmt: PCT }])],
    [[H('الإجمالي', 'Total'), '', H('كل الأكواد', 'All codes'), ...cyc.flatMap(c => { const r = rollup(snap, c.id, master.codes, true); return [r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100] })],
      ...master.pillars.map(pl => [H('محور', 'Pillar'), Number(pl.id), nm(pl), ...cyc.flatMap(c => { const r = rollup(snap, c.id, master.codes.filter(x => x.pillar === pl.id), true); return [r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100] })]),
      ...master.subpillars.map(sb => [H('محور فرعي', 'Sub-pillar'), sb.id, nm(sb), ...cyc.flatMap(c => { const r = rollup(snap, c.id, master.codes.filter(x => x.sub === sb.id), true); return [r.total ? r.approved / r.total : 0, r.score === null ? null : r.score / 100] })])])

  /* ---------- 12. Mapping / 13. Users / 14. Audit ---------- */
  table(['ربط المشاريع', 'Project mapping'], 'Mapping', [{ h: ['الكود', 'Code ID'], w: 9 }, { h: ['المحور الفرعي', 'Sub-pillar'], w: 34 }, { h: ['المشروع', 'Project'], w: 36 }, { h: ['معرّف المشروع', 'Project ID'], w: 9 }, { h: ['مالك المشروع', 'Project owner'], w: 20 }, { h: ['المُسند إليه فعلياً', 'Effective assignee'], w: 20 }, { h: ['إسناد يدوي', 'Manual override'], w: 9 }],
    facts.flatMap(f => (f.links.length ? f.links : [null]).map(pid => [f.c.id, nm(subById.get(f.c.sub)!), pid ? pname(pid) : H('— الفريق الأساسي', '— core team'), pid || '', uname(pid ? cfg.projects.find(p => p.id === pid)?.ownerId : null), uname(f.assignee), cfg.overrides[cycleId]?.[f.c.id] ? H('نعم', 'Yes') : ''])))
  table(['السجل', 'Audit log'], 'Audit', [{ h: ['الوقت', 'Time'], w: 17, fmt: DATE }, { h: ['بواسطة', 'By'], w: 20 }, { h: ['الإجراء', 'Action'], w: 12 }, { h: ['الهدف', 'Target'], w: 30 }],
    [...snap.audit].reverse().map(a => [iso(a.at), uname(a.by) || a.by, a.action, a.target]))

  /* ---------- 15. Dictionary ---------- */
  const d = wb.addWorksheet(SN('دليل الأعمدة', 'Dictionary')); d.views = [{ rightToLeft: rtl }]; d.columns = [{ width: 24 }, { width: 30 }, { width: 90 }]
  d.addRows([[H('الورقة', 'Sheet'), H('العمود', 'Column'), H('المعنى', 'Meaning')],
    [H('الأكواد', 'Codes'), H('نتيجة الكود', 'Code score'), H('متوسط درجات المتطلبات المُجابة (نعم=100، جزئي=50، لا=0)، مع استبعاد "لا ينطبق". فارغ إذا لم يُجب عن أي متطلب.', 'Average of answered requirement scores (Yes=100, Partial=50, No=0), N/A excluded. Blank when nothing is answered.')],
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
    [H('عام', 'General'), H('التواريخ', 'Dates'), H('قيم تاريخ/وقت حقيقية في Excel بتنسيق yyyy-mm-dd hh:mm.', 'Real Excel date/time values formatted yyyy-mm-dd hh:mm.')],
    [H('عام', 'General'), H('النسب', 'Percentages'), H('قيم رقمية بين 0 و1 منسقة كنسبة مئوية، صالحة للجداول المحورية.', 'Numeric 0–1 values formatted as percentages, pivot-ready.')],
  ]); d.getRow(1).font = { bold: true }; d.getColumn(1).font = { bold: true }

  /* Excel decides paragraph direction per cell; force it so Arabic lines that start with "1." read right-to-left. */
  const ro = rtl ? 'rtl' as const : 'ltr' as const
  wb.eachSheet(ws => { ws.columns.forEach(col => { if (col.alignment) col.alignment = { ...col.alignment, readingOrder: ro } })
    ws.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: true }, cell => { cell.alignment = { ...(cell.alignment || {}), readingOrder: ro } })) })
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `UAE-Code-Championship_${cycleId}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
