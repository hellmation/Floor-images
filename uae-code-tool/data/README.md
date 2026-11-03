# UAE Code master dataset

Source: كود الإمارات للخدمات الحكومية وتصفير البيروقراطية (Ministry of Cabinet Affairs, Prime Minister's Office), 77-page PDF.
Extracted 2026-11-03 with `source-extraction/extract_code.py` (pdfplumber), assembled with `build_master.py`, English added with `merge_master.py`.

## Files
- `master.json` — bilingual master: 8 pillars, 60 sub-pillars, 371 codes, 787 requirements, 778 monitoring criteria.
- `projects.json` — service development team projects and owners (39 projects, 6 owners), used to seed the project-to-code mapping.
- `source-extraction/` — the scripts and translation glossary, kept so the extraction can be re-run if a new PDF edition is issued.

## Shape of `master.json`
```
pillars[]      id, name_ar, name_en, desc_ar, desc_en
subpillars[]   id, pillar, name_ar, name_en
codes[]        id, pdf_id, sub, pillar, impact (high|medium|low|null), desc_ar, desc_en,
               requirements[] {n, text_ar, text_en}, criteria[] {n, text_ar, text_en},
               pdf_page, flags[]
```
Assessment answers are captured per requirement. Criteria are the monitoring guidance for the code; where the counts match they pair with requirements by index.

## Known issues in the PDF itself (kept as flags, not silently fixed)
- `2.1.11b` and `2.3.4b`: the PDF prints 2.1.11 and 2.3.4 twice for two different cards. The second card carries a `b` suffix until the team decides a final number.
- `5.4.7`: no impact level is highlighted in the PDF. Stored as `null`; scoring treats it as medium until an admin sets it.
- The English text is an unofficial working translation for the interface; the Arabic text is the authoritative reference.
