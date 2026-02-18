# Spacing System for Professional Documents

> Best practices for vertical and horizontal spacing in CVs, reports, and professional documents.
> Source: Typography research, DACH CV standards, visual design principles.
> Version: 1.1.0 | Last updated: 2026-02-16

---

## Core Principle: Modular Spacing Scale

Use a consistent, named spacing system — like a musical scale for whitespace. Every spacing value in the document should come from the scale, never hardcoded magic numbers.

### 4-Tier System (Recommended)

| Tier | Name | Value | Purpose |
|------|------|-------|---------|
| XS | `sp-xs` | 5pt | Between bullet items |
| Tight | `sp-tight` | 6pt | Title to first bullet, within-entry gaps |
| Medium | `sp-medium` | 14pt | Between entries (the key visual separator) |
| Large | `sp-large` | 22pt | Between sections |
| (Aux) | `sp-section-below` | 8pt | Section heading to first entry |

### Why These Values?

- **5pt (xs):** Clear separation between bullet items. Professional standard is 5-6pt. Below 4pt, multi-line bullets blur into each other visually
- **6pt (tight):** Creates a subtle pause between the entry header and its bullet content
- **14pt (medium):** Research shows ~5mm (14pt) is where entries are perceived as distinct visual blocks. Below 12pt, entries feel cramped. Above 16pt, spacing feels wasteful on A4.
- **22pt (large):** Section transitions need to signal a major topic change. 22pt (~8mm) provides clear separation without a full blank line
- **8pt (section-below):** Prevents section headings from feeling cramped against the first entry below the rule

---

## Content-to-Whitespace Ratio

**Target: 55% content / 45% whitespace**

This ratio creates a clean, scannable document that doesn't feel crowded or sparse.

| Ratio | Effect |
|-------|--------|
| 70/30 | Too dense — wall of text, hard to scan |
| 60/40 | Acceptable — slightly compact but readable |
| **55/45** | **Optimal — clean, professional, scannable** |
| 50/50 | Slightly spacious — acceptable for short documents |
| 40/60 | Too sparse — wastes space, looks empty |

---

## Vertical Rhythm Principles

### Consistent Ratios
Each tier should be roughly **1.5-2x** the previous tier:
- 3pt → 6pt (2x)
- 6pt → 14pt (~2.3x)
- 14pt → 22pt (~1.6x)

This creates a visual hierarchy where the eye can distinguish levels of grouping.

### Visual Grouping Rule
**Items with less space between them are perceived as related. Items with more space are perceived as separate.**

- Bullets within an entry: tight spacing (3pt) = "these belong together"
- Entries within a section: medium spacing (14pt) = "these are siblings"
- Sections: large spacing (22pt) = "new topic"

---

## Line Height (Leading)

### Font-Specific: Inter

Inter has a **large x-height** designed for screen readability. In print, this makes lines appear denser than typical sans-serifs at the same point size. Inter's designer (Rasmus Andersson) recommends **1.4x line-height** as the baseline.

**In Typst:** `par(leading)` is the space between lines, not total line-height. Typst default is 0.65em. For Inter at 9-9.5pt, the optimal range is:

| Context | Recommended | Rationale |
|---------|-------------|-----------|
| Body text / bullets | 0.80em | Inter needs more leading than standard sans-serifs due to large x-height |
| Profile/summary | 0.85em | Extra breathing room for dense paragraphs |
| Headings | Typst default | Headings are typically single-line |

### General Rules (any font)
- Never go below 0.6em — text becomes hard to read
- Never go above 0.90em — text feels disconnected
- Large x-height fonts (Inter, Helvetica) need ~10-15% more leading than small x-height fonts (Garamond, Caslon)
- Profile/summary paragraphs benefit from +0.05em over body text
- At font sizes below 10pt, proportionally more leading is needed for readability

### Previous values (deprecated)
- 0.72em was used in template v2.2.0–v2.4.0 and found too tight for multi-line bullet text in Inter at 9pt

---

## Horizontal Spacing

### Margins (A4)
| Context | Recommended | Rationale |
|---------|-------------|-----------|
| Standard CV | 20mm all sides | 170mm content width = 81% of page width |
| Minimum viable | 12.7mm (0.5 inch) | Absolute minimum — feels cramped |
| Maximum useful | 25.4mm (1 inch) | Standard for formal documents |

**20mm uniform margins** are the sweet spot for A4 professional CVs:
- Creates a clean visual frame
- 170mm content width fits 55-70 characters per line (optimal reading length)
- Enough margin for binding/printing without wasting space

### Internal Spacing
| Element | Value | Purpose |
|---------|-------|---------|
| Bullet indent | 1em | Indents bullets from the left edge |
| Bullet marker to text | 5pt | Gap between en-dash and bullet text |
| Date/location separator | 5pt + bar + 5pt | Visual separator between period and location |

---

## A4 Page Metrics

| Metric | Value |
|--------|-------|
| A4 dimensions | 210 × 297mm |
| Content area (20mm margins) | 170 × 257mm |
| Content width utilization | 81% |
| Usable vertical space | 257mm per page |
| Optimal line length | 55-70 characters |
| Lines per page (9.5pt, 0.72em leading) | ~38-42 lines |

---

## Implementation Example (Typst)

```typst
// Named spacing variables — all spacing comes from here
#let sp-xs = 5pt
#let sp-tight = 6pt
#let sp-medium = 14pt
#let sp-large = 22pt
#let sp-section-below = 8pt

// Page setup
#set page(paper: "a4", margin: 20mm)
#set text(font: "Inter", size: 9.5pt)
#set par(leading: 0.80em)

// Section: sp-large above, sp-section-below before first entry
#let section(title, body) = {
  v(sp-large)
  block(breakable: false, below: sp-section-below)[
    text(size: 11pt, weight: "semibold")[#upper(title)]
    v(3pt)
    line(length: 100%, stroke: 0.5pt)
  ]
  body
}

// Entry: sp-medium between entries, sp-tight title-to-bullets
#let entry(title, subtitle, items) = {
  block(breakable: false, above: sp-medium)[
    text(size: 10pt, weight: "semibold")[#title]
    // ... entry content with sp-tight and sp-xs gaps
  ]
}
```
