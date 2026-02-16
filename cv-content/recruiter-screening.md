# Recruiter Screening — What Gets Through in 2026

How HR recruiters and ATS systems evaluate CVs for senior consulting, transformation, and leadership roles in the DACH region.

---

## ATS Keyword Matching

97%+ of companies use Applicant Tracking Systems to filter candidates before a human recruiter sees the CV.

**Key statistics (Jobscan 2025 State of Job Search):**
- 50.6% of recruiters filter by **certifications**
- 55.3% filter by **job titles**
- 59.7% filter by **education**
- Candidates with the job title on their resume are **10.6x more likely** to get interviews

**Matching rules:**
- ATS don't recognize synonyms — use **exact wording** from job descriptions
- Abbreviations may not match full forms (e.g. "PM" vs "Project Management")
- List credentials exactly as titled
- Spell out acronyms AND include the abbreviation: "Scaled Agile Framework (SAFe)"

---

## Training Categories Recruiters Value

For senior consulting/transformation/leadership roles in DACH. Ordered by recruiter signal strength.

### Tier 1 — High Impact (directly screened for)

| Category | Why it matters | Keywords to use |
|---|---|---|
| **Change Management** | Dedicated certifications exist (CCMP, Prosci). Recruiters search for it. | change management, Kotter, ADKAR, Prosci, organizational change |
| **Project Management Certifications** | PMP, IPMA, PRINCE2 are worldwide standards. 50.6% filter by certs. | PMP, IPMA Level C/B, PRINCE2, SAFe, Scrum Master |
| **Moderation & Facilitation** | Consulting roles require workshop delivery. Directly listed in postings. | moderation, facilitation, workshop design, meeting facilitation |
| **Negotiation** | Leadership essential. Harvard method is the recognized standard. | negotiation, Harvard method, contract negotiation, stakeholder alignment |

### Tier 2 — Strong Signal (differentiators)

| Category | Why it matters | Keywords to use |
|---|---|---|
| **Executive/Leadership Coaching** | ICF is the gold standard. Separates leaders from managers. | coaching, ICF, executive coaching, agile coaching, team coaching |
| **Conflict Management** | Emotional intelligence proxy. Critical for cross-functional leadership. | conflict management, de-escalation, mediation, conflict resolution |
| **AI/Data Literacy** | Growing 66% YoY in demand. Fastest-growing skill category. | AI, data strategy, data governance, data-driven decision making |
| **Design Thinking** | Innovation/transformation signal. University programs (HPI, Stanford) add credibility. | design thinking, system design thinking, innovation, human-centered design |

### Tier 3 — Supporting (context-dependent)

| Category | Why it matters | Keywords to use |
|---|---|---|
| **Digital Transformation** | DACH: 43-65% salary premium for certified leaders (Haufe Akademie 2025). | digital transformation, digitalization, digital leadership |
| **Stakeholder Management** | Essential for project delivery. All 3 target postings mention it. | stakeholder management, stakeholder alignment, executive communication |
| **Process Improvement** | Quality management signal. Relevant for operational roles. | Six Sigma, Lean, process optimization, quality management |
| **Intercultural/Virtual Leadership** | Global team management. Increasingly relevant post-COVID. | intercultural leadership, virtual teams, remote leadership, global teams |
| **Compliance/Governance** | Regulatory roles (TÜV Austria, public sector). | compliance, governance, regulatory, EU AI Act, risk management |
| **Presentation/Communication** | "Kommunikationsstärke" appears in every posting. | presentation, communication, rhetorics, storytelling, public speaking |
| **Strategic Planning** | C-level positioning. Portfolio/program level. | OKR, balanced scorecard, portfolio management, strategic roadmap |

---

## DACH-Specific Findings

**Haufe Akademie Future Skills 2026 study (1000+ respondents, DACH):**
- Top future skills: **problem-solving**, **critical thinking**, **digital competencies**
- High demand for leaders combining digital process management with business understanding
- AI literacy no longer optional — demand growing fastest of any sector

**Salary impact:**
- Fachkräfte with current certifications earn on average **43% more** in DACH
- For Führungspositionen, the premium is **65%**

---

## How to Present Training on a CV

### Do
- List training keywords in Skills section (ATS matching)
- Prove skills through experience bullets: "Moderated quarterly PI Planning workshops for 8 teams"
- Use exact terminology from target job descriptions
- Group logically (frameworks, leadership, tools)

### Don't
- List company names for internal trainings — say "training in X" instead
- List every training ever — curate for relevance to target roles
- Use generic soft skill labels without context ("good communicator")
- Assume ATS understands synonyms — be explicit

### Template Rule
Training items belong in the **Skills & Certifications** section as a bullet under the relevant skill group. Format: `Training in X · Y · Z` — no company names, keyword-rich.

---

## Spacing Constraint for Training Bullets

Training bullets tend to be long (keyword lists). When they wrap to multiple lines, the template must ensure:

```
between-bullet spacing (sp-xs) > within-bullet line spacing (leading)
```

**Implementation:** sp-xs is derived from bullet-size and leading-ratio:
```typst
#let sp-xs = bullet-size * leading-ratio + 1pt
```

This is self-enforcing — see `layout/spacing-system.md` for the full spacing hierarchy.

---

## Sources

- [Jobscan — Top 500 ATS Resume Keywords 2025](https://www.jobscan.co/blog/top-resume-keywords-boost-resume/)
- [ATS Resume Keywords Guide 2026](https://uppl.ai/ats-resume-keywords/)
- [Haufe Akademie — Future Skills Studie 2026](https://www.haufe-akademie.de/future-jobs-classes/studie-future-skills)
- [MentorCruise — Top 10 Consulting Certifications 2026](https://mentorcruise.com/certifications/consulting/)
- [AIHR — Best HR Certifications 2026](https://www.aihr.com/blog/best-hr-certifications/)
- [Klett — Weiterbildungstrends 2026](https://www.klett-corporate-education.de/weiterbildungstrends-2025-betriebliche-foerderung.html)
- [The Interview Guys — Top 50 Management Resume Keywords 2025](https://blog.theinterviewguys.com/keywords-for-a-management-resume/)
- [Extern — 50+ Skills to Put on Resume 2026](https://www.extern.com/post/skills-to-put-on-resume-2026)
