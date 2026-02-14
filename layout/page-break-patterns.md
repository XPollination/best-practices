# Page Break & Content Flow Patterns

> Best practices for page breaks in professional documents (CVs, reports, presentations).
> Source: Typography standards, CSS Fragmentation spec, InDesign best practices, CV layout research.
> Version: 1.0.0 | Last updated: 2026-02-14

---

## Pattern Catalog

### Line-Level Patterns

#### ORPHAN_CONTROL
**Never leave fewer than 2 lines at the bottom of a page before a break.**

- Threshold: Minimum **2 lines** (3 for print publishing)
- An orphan is the first line of a paragraph stranded alone at the page bottom
- Action: Push the entire paragraph (or at least 2 lines) to the next page
- Sources: W3C CSS Fragmentation Level 3, Chicago Manual of Style, Butterick's Practical Typography

#### WIDOW_CONTROL
**Never leave fewer than 2 lines at the top of a page after a break.**

- Threshold: Minimum **2 lines**
- A widow is the last line of a paragraph stranded alone at the page top
- Action: Pull an additional line from the previous page or reflow the paragraph
- Sources: W3C CSS Fragmentation Level 3, Butterick's Practical Typography

#### RUNT_ELIMINATION
**The last line of a paragraph should not be a single short word.**

- Threshold: Last line should not be fewer than 5-6 characters
- Action: Reword so the short word joins the preceding line
- Sources: CreativePro, Optim Careers

---

### Block-Level Patterns

#### ENTRY_KEEP_TOGETHER
**A content entry (e.g., job entry with title + company + bullets) should stay on a single page.**

- Never split the entry header (title/company/dates) from its body content
- If an entry must split: at least header + **2 bullet points** (~40-50mm) must remain on the current page
- A header alone at the bottom of a page with all content on the next page = orphaned heading
- When to allow splitting: Only if entry exceeds ~60% of page height
- **Typst:** `block(breakable: false)` on the entry container
- **CSS:** `break-inside: avoid` on the entry container

#### ENTRY_HEADER_INTEGRITY
**The entry header (title, company, location, dates) is a single atomic unit.**

- These 1-3 lines must never split across pages
- They are inside the same non-breakable block as the body content
- **Typst:** Part of the `block(breakable: false)` wrapper
- **CSS:** `break-inside: avoid` on the header container

#### HEADING_KEEP_WITH_NEXT
**A section heading must stay with at least N lines of the following content.**

- Primary section headings (e.g., "Work Experience"): keep with next **3 lines**
- Entry-level headings (e.g., job title/company): keep with next **2 lines**
- **Typst:** `block(breakable: false)` on heading. Combined with non-breakable first entry, Typst pushes both to next page if they don't fit.
- **CSS:** `break-after: avoid` on the heading element

#### NO_STACKED_HEADINGS
**Consecutive headings without body text between them = single unit for page break purposes.**

- A section title immediately followed by a subsection title (no body text in between) must never split across pages
- Treat the stack as one atomic block

---

### Section-Level Patterns

#### SECTION_MINIMUM_SPACE
**Don't start a new section at the page bottom unless sufficient space remains.**

- Minimum remaining space: section heading + first entry header + 2 bullets
- Threshold: approximately **60-80mm** (~170-225pt)
- If less space remains, push the entire section to the next page
- A section heading with only one line beneath it before a page break = orphaned section
- **Typst:** Large `v()` gap before sections + non-breakable blocks achieves this naturally
- **CSS:** Combine `break-after: avoid` on heading with `break-inside: avoid` on first entry

#### SECTION_START_ON_NEW_PAGE (optional)
**For long documents (3+ pages), major sections MAY start on a new page.**

- For standard 2-page CVs: do NOT apply (wastes too much space)
- For 3+ page CVs or reports: consider it for major sections
- **Typst:** `pagebreak()` before the section
- **CSS:** `break-before: page`

---

### Page-Level Patterns

#### FRONT_LOAD_CONTENT
**The most important content goes on page 1.**

- Some readers only read page 1 — the critical first impression must be complete there
- For CVs: most recent/relevant roles on page 1; earlier roles, education, skills on page 2
- Reverse chronological ordering naturally achieves this

#### PAGE_FILL_MINIMUM
**The last page should have sufficient content to justify its existence.**

- Minimum: **33%** of page height filled
- Ideal: **50-80%** of page height filled
- If the last page is less than 33% full: condense to fewer pages or redistribute content
- A last page with only 2-3 lines looks like an afterthought

#### VISUAL_BALANCE_TOLERANCE
**Pages don't need to be equally filled.**

- A ratio of 100%/60-80% between pages is acceptable and normal
- Both pages equally full is ideal but not required
- Avoid: last page with only 2-3 lines of content

---

## Numeric Thresholds Reference

| Pattern | Threshold | Unit |
|---------|-----------|------|
| Orphan control | 2 lines min | lines at page bottom |
| Widow control | 2 lines min | lines at page top |
| Runt elimination | 5-6 chars min | last line of paragraph |
| Heading keep-with-next (primary) | 3 lines | after section heading |
| Heading keep-with-next (entry) | 2 lines | after entry heading |
| Entry header integrity | all lines | atomic block |
| Min entry on page before split | header + 2 bullets | ~40-50mm |
| Section minimum space to start | heading + header + 2 bullets | ~60-80mm |
| Last page minimum fill | 33% | of page height |
| Last page ideal fill | 50-80% | of page height |

---

## Implementation by Technology

### Typst
```typst
// ENTRY_KEEP_TOGETHER: entire entry stays on one page
block(breakable: false, above: 14pt)[
  // entry content here
]

// HEADING_KEEP_WITH_NEXT: heading is non-breakable,
// combined with non-breakable first entry = stays together
block(breakable: false, below: 8pt)[
  // section heading + rule
]

// ORPHAN/WIDOW: Typst handles this by default (2 lines)
// No explicit configuration needed

// Forced page break (use sparingly)
pagebreak()
```

### CSS (Print)
```css
@media print {
  p, li { orphans: 2; widows: 2; }
  h2, h3 { break-after: avoid; break-inside: avoid; }
  .entry { break-inside: avoid; }
  .entry-header { break-inside: avoid; }
}
```

### LaTeX
```latex
% Prevent page break inside entry
\begin{samepage}
  % entry content
\end{samepage}

% Minimum space before section (7 baselines)
\needspace{7\baselineskip}

% Orphan/widow control
\clubpenalty=10000
\widowpenalty=10000
```

---

## Decision Flowchart

```
For each content block at page bottom:

1. Is it a SECTION HEADING?
   → Remaining space ≥ 60-80mm? → Place heading
   → Remaining space < 60-80mm? → Push to next page

2. Is it an ENTRY (job/education)?
   → Entry fits entirely? → Place entry (keep-together)
   → Entry doesn't fit, remaining ≥ header + 2 bullets? → Split (rare, avoid)
   → Entry doesn't fit, remaining < header + 2 bullets? → Push to next page

3. Is it a BULLET POINT within a split entry?
   → At least 2 bullets remain on current page? → Allow
   → Only 1 bullet would remain? → Push to next page

4. After all content placed:
   → Last page < 33% filled? → Consider condensing
   → Last page ≥ 33% filled? → Acceptable
```
