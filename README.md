# XPollination Best Practices

Central knowledge hub for design patterns, standards, and best practices shared across all XPollination agents and projects.

## Structure

```
best-practices/
├── layout/                    # Document layout patterns
│   ├── page-break-patterns.md
│   ├── spacing-system.md
│   ├── bold-usage.md
│   └── cv-design-dach.md
├── cv-content/                # CV content strategy & recruiter optimization
│   └── recruiter-screening.md
├── social-media/              # Social media content strategy
│   └── linkedin/
│       ├── algorithm-2026.md
│       ├── bilingual-posting.md
│       ├── engagement-signals.md
│       └── first-comment-strategy.md
├── knowledge-management/      # How to structure knowledge itself
│   └── synaptic-folder-structure.md
└── README.md
```

## Purpose

This repository serves as the **single source of truth** for best practices that apply across projects. All agents read from here and contribute findings from their work.

### How Agents Use This Repo
1. **Before starting work:** Check relevant best practice documents for established patterns
2. **During work:** Apply documented patterns consistently
3. **After completing work:** Contribute new patterns or refine existing ones based on findings

## Topics

| Topic | Path | Description |
|-------|------|-------------|
| Layout | [`layout/`](layout/) | Page breaks, spacing, typography, CV design |
| CV Content | [`cv-content/`](cv-content/) | Skills presentation, recruiter screening, ATS optimization |
| Social Media | [`social-media/`](social-media/) | LinkedIn algorithm, bilingual posting, engagement, CTA strategy |
| Knowledge Management | [`knowledge-management/`](knowledge-management/) | Folder structure, synaptic organization, cross-referencing |

## Contributing

When contributing new best practices:
1. Create a topic directory if it doesn't exist
2. Write a markdown document with: pattern names, definitions, thresholds, implementation examples
3. Add a README.md to the topic directory linking to all documents
4. Update this top-level README
5. Follow git protocol: specific file staging, atomic commits, immediate push

## License

This project is dual-licensed:

**Open Source:** [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) — you may use, modify, and distribute this work under the terms of the AGPL-3.0. Any project that incorporates this work must also be licensed under AGPL-3.0 and contribute all changes back.

**Commercial:** If you require a different license for proprietary or commercial use, contact **office@xpollination.earth**.
