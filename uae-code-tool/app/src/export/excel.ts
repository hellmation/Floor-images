import ExcelJS from 'exceljs'
import type { Lang, Snapshot } from '../types'
import { master, effective, codeScore, effectiveImpact, assigneeOf, rollup, sortIds, subById, pillarById } from '../store/scoring'

let LANG: Lang = 'ar'
const H = (ar: string, en: string) => LANG === 'ar' ? ar : en
const SN = (ar: string, en: string) => H(ar, en).slice(0, 31)
const STATUS_T: Record<string, [string, string]> = { yes: ['نعم', 'Yes'], partial: ['جزئي', 'Partial'], no: ['لا', 'No'], na: ['لا ينطبق', 'N/A'] }
const STATE_T: Record<string, [string, string]> = { none: ['لم يبدأ', 'Not started'], draft: ['مسودة', 'Draft'], submitted: ['مُرسل', 'Submitted'], returned: ['مُعاد', 'Returned'], approved: ['معتمد', 'Approved'] }
const IMP_T: Record<string, [string, string]> = { high: ['عالي', 'High'], medium: ['متوسط', 'Medium'], low: ['منخفض', 'Low'], none: ['غير محدد', 'Not specified'] }
const STATUS = new Proxy({} as Record<string, string>, { get: (_, k: string) => H(...STATUS_T[k]) })
const STATE = new Proxy({} as Record<string, string>, { get: (_, k: string) => H(...STATE_T[k]) })
const IMP = new Proxy({} as Record<string, string>, { get: (_, k: string) => H(...IMP_T[k]) })

export async function exportWorkbook(snap: Snapshot, cycleId: string, lang: Lang) {
  LANG = lang
  const cfg = snap.config; const cycle = cfg.cycles.find(c => c.id === cycleId)
  const wb = new ExcelJS.Workbook(); wb.creator = 'UAE Code Self-Assessment Tool'; wb.created = new Date()
  const rtl = lang === 'ar'
  const name = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : '' }
  const proj = (id?: string | null) => { const p = cfg.projects.find(x => x.id === id); return p ? (lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)) : '' }
  const style = (ws: ExcelJS.Worksheet, widths: number[]) => {
    ws.views = [{ rightToLeft: rtl, state: 'frozen', ySplit: 1 }]
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA7812D' } }
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true }
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; ws.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' } })
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: widths.length } }
  }

  // Summary
  const all = rollup(snap, cycleId, master.codes, true), allW = rollup(snap, cycleId, master.codes, false)
  const s = wb.addWorksheet(SN('الملخص', 'Summary')); s.views = [{ rightToLeft: rtl }]
  s.columns = [{ width: 42 }, { width: 22 }, { width: 22 }]
  s.addRows([
    [H('الجهة', 'Entity'), lang === 'ar' ? cfg.entity.name_ar : cfg.entity.name_en],
    [H('الدورة', 'Cycle'), cycle ? (lang === 'ar' ? cycle.name : (cycle.name_en || cycle.name)) : cycleId, cycle ? H({ planning: 'تخطيط', open: 'مفتوحة', review: 'قيد المراجعة', closed: 'مغلقة' }[cycle.status], cycle.status) : ''],
    [H('تاريخ التصدير', 'Exported'), new Date().toISOString().slice(0, 16).replace('T', ' ')],
    [],
    ['', H('المعتمد فقط', 'Approved only'), H('كل ما أُجيب عنه', 'All answered')],
    [H('إجمالي الأكواد', 'Total codes'), all.total, allW.total],
    [H('أكواد مُجابة', 'Codes answered'), all.answered, allW.answered],
    [H('أكواد مُرسلة', 'Codes submitted'), all.submitted, allW.submitted],
    [H('أكواد معتمدة', 'Codes approved'), all.approved, allW.approved],
    [H('الجاهزية (معتمد/الإجمالي)', 'Readiness (approved/total)'), all.total ? Math.round(all.approved / all.total * 100) + '%' : '', ''],
    [H('الامتثال المرجح', 'Weighted compliance'), all.score === null ? '' : Math.round(all.score) + '%', allW.score === null ? '' : Math.round(allW.score) + '%'],
    [H('الفجوات', 'Gaps'), all.gaps, allW.gaps],
    [H('طلبات التوضيح المفتوحة', 'Open clarification requests'), allW.clarifications, ''],
    [],
    [H('قاعدة الاحتساب', 'Scoring rule'), `${H('نعم', 'Yes')}=${cfg.settings.scores.yes}, ${H('جزئي', 'Partial')}=${cfg.settings.scores.partial}, ${H('لا', 'No')}=${cfg.settings.scores.no}`, `${H('الأوزان', 'Weights')}: ${H('عالي', 'High')}=${cfg.settings.weights.high}, ${H('متوسط', 'Medium')}=${cfg.settings.weights.medium}, ${H('منخفض', 'Low')}=${cfg.settings.weights.low}`],
  ])
  s.getColumn(1).font = { bold: true }

  // Pillars
  const p = wb.addWorksheet(SN('المحاور', 'Pillars'))
  p.addRow(['#', H('المحور', 'Pillar'), H('أكواد', 'Codes'), H('مُجاب', 'Answered'), H('معتمد', 'Approved'), H('الجاهزية', 'Readiness'), H('الامتثال (معتمد)', 'Compliance (approved)'), H('الامتثال (الكل)', 'Compliance (all)'), H('فجوات', 'Gaps')])
  for (const pl of master.pillars) { const r = rollup(snap, cycleId, master.codes.filter(c => c.pillar === pl.id), true), rw = rollup(snap, cycleId, master.codes.filter(c => c.pillar === pl.id), false)
    p.addRow([pl.id, lang === 'ar' ? pl.name_ar : pl.name_en, r.total, rw.answered, r.approved, r.total ? Math.round(r.approved / r.total * 100) / 100 : 0, r.score === null ? '' : Math.round(r.score) / 100, rw.score === null ? '' : Math.round(rw.score) / 100, rw.gaps]) }
  style(p, [6, 50, 10, 10, 10, 12, 16, 16, 10]); ['F', 'G', 'H'].forEach(c => { p.getColumn(c).numFmt = '0%' })

  // Sub-pillars
  const sp = wb.addWorksheet(SN('المحاور الفرعية', 'Sub-pillars'))
  sp.addRow(['#', H('المحور', 'Pillar'), H('المحور الفرعي', 'Sub-pillar'), H('أكواد', 'Codes'), H('مُجاب', 'Answered'), H('معتمد', 'Approved'), H('الامتثال (معتمد)', 'Compliance (approved)'), H('الامتثال (الكل)', 'Compliance (all)'), H('فجوات', 'Gaps')])
  for (const sb of master.subpillars) { const r = rollup(snap, cycleId, master.codes.filter(c => c.sub === sb.id), true), rw = rollup(snap, cycleId, master.codes.filter(c => c.sub === sb.id), false)
    sp.addRow([sb.id, lang === 'ar' ? pillarById.get(sb.pillar)!.name_ar : pillarById.get(sb.pillar)!.name_en, lang === 'ar' ? sb.name_ar : sb.name_en, r.total, rw.answered, r.approved, r.score === null ? '' : Math.round(r.score) / 100, rw.score === null ? '' : Math.round(rw.score) / 100, rw.gaps]) }
  style(sp, [7, 28, 50, 10, 10, 10, 16, 16, 10]); ['G', 'H'].forEach(c => { sp.getColumn(c).numFmt = '0%' })

  // Codes (one row per requirement) — the spine of the original draft template, extended
  const ws = wb.addWorksheet(SN('الأكواد', 'Codes'))
  ws.addRow(['#', H('المحور', 'Pillar'), '#', H('المحور الفرعي', 'Sub-pillar'), '#', H('المعيار', 'Code'), H('مستوى الأثر', 'Impact'), '#', H('المتطلب', 'Requirement'), H('معيار الرصد', 'Monitoring criterion'),
    H('التقييم', 'Evaluation'), H('الدرجة', 'Score'), H('نتيجة الكود', 'Code score'), H('مبرر عدم الانطباق', 'N/A justification'), H('الأدلة', 'Evidence'), H('ملاحظة', 'Note'), H('المشروع', 'Project'), H('الخدمة', 'Service'),
    H('المقيّم', 'Evaluator'), H('حالة الكود', 'Code state'), H('تعليق المراجع', 'Reviewer comment'), H('يحتاج توضيح', 'Needs clarification'), H('رد المراجع', 'Clarification reply'), H('آخر تحديث', 'Updated'), H('صفحة PDF', 'PDF page'), H('الدورة', 'Cycle')])
  for (const c of [...master.codes].sort((a, b) => sortIds(a.id, b.id))) {
    const e = effective(snap, cycleId, c.id); const sb = subById.get(c.sub)!; const pl = pillarById.get(c.pillar)!; const cs = codeScore(e.answer, c, cfg)
    const assignee = assigneeOf(c.id, cycleId, cfg); const paired = c.criteria.length === c.requirements.length
    c.requirements.forEach((r, i) => {
      const it = e.answer?.items[String(r.n)]; const cl = snap.reviews.clarifications?.[cycleId]?.[c.id]?.[String(r.n)]
      const crit = paired ? c.criteria[i] : null
      ws.addRow([pl.id, lang === 'ar' ? pl.name_ar : pl.name_en, sb.id, lang === 'ar' ? sb.name_ar : sb.name_en, c.id, lang === 'ar' ? c.desc_ar : c.desc_en, IMP[effectiveImpact(c, cfg)], r.n, lang === 'ar' ? r.text_ar : r.text_en,
        crit ? (lang === 'ar' ? crit.text_ar : crit.text_en) : (i === 0 ? c.criteria.map(x => '• ' + (lang === 'ar' ? x.text_ar : x.text_en)).join('\n') : ''),
        it?.status ? STATUS[it.status] : '', it?.status && it.status !== 'na' ? cfg.settings.scores[it.status] : '', i === 0 && cs !== null ? Math.round(cs) : '',
        it?.justification || '', (it?.evidence || []).map(ev => ev.title ? `${ev.title}: ${ev.url}` : ev.url).join('\n'), it?.note || '', proj(it?.projectId), it?.service || '',
        name(e.userId || assignee), STATE[e.state], e.review?.comment || '', it?.clarify?.flag ? it.clarify.question || '✓' : '', cl?.answer || '', e.answer?.updatedAt?.slice(0, 16).replace('T', ' ') || '', c.pdf_page, cycleId])
    })
  }
  style(ws, [4, 22, 5, 24, 8, 60, 14, 4, 50, 45, 14, 7, 8, 30, 40, 30, 28, 18, 24, 16, 30, 24, 30, 16, 6, 10])

  // Gaps
  const g = wb.addWorksheet(SN('الفجوات', 'Gaps'))
  g.addRow(['#', H('المحور', 'Pillar'), H('الكود', 'Code'), H('مستوى الأثر', 'Impact'), H('نتيجة الكود', 'Code score'), H('المتطلبات غير المستوفاة', 'Unmet requirements'), H('المقيّم', 'Evaluator'), H('الحالة', 'State')])
  const gaps = master.codes.map(c => ({ c, e: effective(snap, cycleId, c.id) })).map(x => ({ ...x, s: codeScore(x.e.answer, x.c, cfg) })).filter(x => x.s !== null && x.s < 100)
    .sort((a, b) => cfg.settings.weights[effectiveImpact(b.c, cfg)] - cfg.settings.weights[effectiveImpact(a.c, cfg)] || a.s! - b.s!)
  for (const { c, e, s: sc } of gaps) g.addRow([c.pillar, lang === 'ar' ? pillarById.get(c.pillar)!.name_ar : pillarById.get(c.pillar)!.name_en, c.id + ' — ' + (lang === 'ar' ? c.desc_ar : c.desc_en), IMP[effectiveImpact(c, cfg)], Math.round(sc!),
    c.requirements.filter(r => { const st = e.answer?.items[String(r.n)]?.status; return st === 'no' || st === 'partial' }).map(r => `${r.n}. ${lang === 'ar' ? r.text_ar : r.text_en} (${STATUS[e.answer!.items[String(r.n)].status!]})`).join('\n'), name(e.userId), STATE[e.state]])
  style(g, [4, 22, 70, 14, 10, 70, 24, 16])

  // Clarifications
  const cq = wb.addWorksheet(SN('طلبات التوضيح', 'Clarifications'))
  cq.addRow([H('الكود', 'Code'), '#', H('المتطلب', 'Requirement'), H('السؤال', 'Question'), H('المقيّم', 'Evaluator'), H('تاريخ الطلب', 'Raised'), H('الرد', 'Reply'), H('تاريخ الرد', 'Replied')])
  for (const c of master.codes) { const e = effective(snap, cycleId, c.id); for (const r of c.requirements) { const it = e.answer?.items[String(r.n)]; if (it?.clarify?.flag) { const cl = snap.reviews.clarifications?.[cycleId]?.[c.id]?.[String(r.n)]
    cq.addRow([c.id, r.n, lang === 'ar' ? r.text_ar : r.text_en, it.clarify.question, name(e.userId), it.clarify.raisedAt?.slice(0, 10) || '', cl?.answer || '', cl?.answeredAt?.slice(0, 10) || '']) } } }
  style(cq, [8, 4, 50, 40, 24, 12, 40, 12])

  // Mapping
  const m = wb.addWorksheet(SN('ربط المشاريع', 'Project mapping'))
  m.addRow([H('الكود', 'Code'), H('المحور الفرعي', 'Sub-pillar'), H('المشاريع المرتبطة', 'Linked projects'), H('المُسند إليه', 'Assignee'), H('إسناد يدوي', 'Manual override')])
  for (const c of [...master.codes].sort((a, b) => sortIds(a.id, b.id))) m.addRow([c.id, lang === 'ar' ? subById.get(c.sub)!.name_ar : subById.get(c.sub)!.name_en, (cfg.mapping[c.id] || []).map(proj).join('\n'), name(assigneeOf(c.id, cycleId, cfg)), cfg.overrides[cycleId]?.[c.id] ? '✓' : ''])
  style(m, [8, 34, 50, 24, 10])

  // Users
  const u = wb.addWorksheet(SN('المستخدمون', 'Users'))
  u.addRow([H('الاسم', 'Name'), H('الدور', 'Role'), H('المشاريع', 'Projects'), H('أكواد مُسندة', 'Assigned codes')])
  for (const us of cfg.users.filter(x => x.active)) u.addRow([lang === 'ar' ? us.name_ar : us.name_en, H({ admin: 'مدير', evaluator: 'مقيّم', viewer: 'مطّلع' }[us.role], us.role), cfg.projects.filter(pr => pr.ownerId === us.id).map(pr => proj(pr.id)).join('\n'), master.codes.filter(c => assigneeOf(c.id, cycleId, cfg) === us.id).length])
  style(u, [28, 12, 50, 12])

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `UAE-Code-SelfAssessment_${cycleId}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
