# Synaptic Folder Structure

## The Metaphor

Biological synapses are junctions between neurons where signals pass. A single neuron connects to thousands of others — but the *structure* of these connections determines what the brain can do. Knowledge doesn't live in individual neurons. It lives in the patterns of connections between them.

A knowledge base works the same way:

- **Folders = neural pathways** — they provide context and direction, not content
- **Files = knowledge units** — small, focused, consumable pieces
- **Cross-references between files = synaptic connections** — where real understanding emerges

## Design Principles

### 1. Folders are questions, not categories

A folder should answer: "What context do I need before reading the files inside?"

```
Bad:  documents/linkedin/
Good: social-media/linkedin/    → "I'm in social media, specifically LinkedIn"
```

The path from root to file tells a story: big picture → fine granular. Each level narrows the context.

### 2. Small files over large files

A synapse fires between two neurons — it doesn't dump an entire brain region. Similarly:

- One concept per file
- If a file covers two distinct ideas, split it
- If a file requires scrolling more than 3 screens, it's too long
- Title = the one thing this file teaches

### 3. Files must be independently useful

Every file should make sense when read alone. It can reference other files, but it should not *require* them to be understood. This mirrors how synapses work — each connection carries a complete signal.

### 4. Directories zoom from general to specific

```
best-practices/
├── social-media/           # Domain: social media
│   └── linkedin/           # Platform: LinkedIn
│       ├── algorithm.md    # How the algorithm works
│       ├── bilingual.md    # Language strategy
│       └── engagement.md   # What drives distribution
├── layout/                 # Domain: document layout
│   ├── spacing-system.md   # How spacing works
│   └── page-break-patterns.md  # When to break pages
```

Reading the path gives you the context. The file gives you the knowledge.

### 5. Cross-reference, don't duplicate

When two knowledge areas connect, link — don't copy. Duplication creates drift. Links create synapses.

```markdown
See also: [engagement signals](../social-media/linkedin/engagement.md)
```

## Anti-patterns

- **One giant file** — forces the reader to find the relevant section. No synapse fires.
- **Deep nesting** (>4 levels) — the path becomes noise, not context.
- **Category folders with one file** — the folder adds no context. Flatten.
- **Files named by date** — dates are metadata, not knowledge. Name by concept.

## Sources

- Kandel, E. (2006). *In Search of Memory*. Neural connectivity and knowledge formation.
- Nonaka & Takeuchi (1995). *The Knowledge-Creating Company*. Tacit to explicit knowledge conversion — the same challenge applies to folder structure: making implicit organization explicit.
