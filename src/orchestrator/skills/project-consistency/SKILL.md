---
name: project-consistency
description: "Enforce cross-agent consistency in multi-page/multi-component projects. Covers visual design, code patterns, content style, and structural conventions. Essential for convoy parallel execution where multiple agents build different parts of the same app."
---

# Project Consistency

When multiple agents build different pages or sections in parallel, each makes independent decisions about colors, fonts, component APIs, content tone, and page structure. Without coordination, the result looks like it was built by five different teams — because it was.

**The fix is architectural, not aspirational.** Consistency cannot be "hoped for" after parallel work is done. It must be engineered as shared inputs before parallel work begins.

## The Foundation-First Principle

```
❌ Wrong:  [agent A] ─┐                         → inconsistent output
           [agent B] ─┤→ build pages in parallel → inconsistent output
           [agent C] ─┘                         → inconsistent output

✅ Right:  [foundation task] → shared artifacts → [agent A] ─┐
                                                  [agent B] ─┤→ consistent output
                                                  [agent C] ─┘
```

**Phase 1 (sequential):** One task creates all shared artifacts — design tokens, layout component, UI library, style guide.  
**Phase 2 (parallel):** Every page task imports from Phase 1 output. No new values, no recreated components.

### The 4 Consistency Dimensions

| Dimension | What drifts without a contract | Artifact that enforces it |
|-----------|-------------------------------|--------------------------|
| **Visual** | Color palettes, font choices, spacing units | Design tokens file |
| **Code** | Component APIs, naming conventions, import paths | UI component library |
| **Content** | Tone, terminology, heading hierarchy | Style guide brief |
| **Structural** | Page layout, navigation, responsive breakpoints | Shared layout component |

---

## Foundation Phase Artifacts

A foundation task must produce four things. All subsequent tasks depend on its completion.

### a. Design Tokens File

A single CSS custom properties file — the system's single source of truth. No agent may introduce a color, size, or timing value outside this file.

**Path:** `src/styles/tokens.css` (or equivalent for your framework)

```css
/* Palette — name for intent, not appearance */
:root {
  --color-ink:        #1a1614;          /* primary text */
  --color-paper:      #f5f0e8;          /* page background */
  --color-accent:     #c8e630;          /* the memorable one — use sparingly */
  --color-muted:      #9b9083;          /* secondary text, labels */
  --color-surface:    #eae3d8;          /* card backgrounds, elevated surfaces */
  --color-border:     rgba(26,22,20,.08);

  /* Typography scale — fluid with clamp(), modular ratio 1.25 */
  --text-xs:   clamp(0.75rem,  0.72rem + 0.15vw, 0.875rem);
  --text-sm:   clamp(0.875rem, 0.83rem  + 0.22vw, 1rem);
  --text-base: clamp(1rem,     0.95rem  + 0.25vw, 1.125rem);
  --text-lg:   clamp(1.25rem,  1.1rem   + 0.75vw, 1.563rem);
  --text-xl:   clamp(1.563rem, 1.35rem  + 1.06vw, 2rem);
  --text-2xl:  clamp(1.953rem, 1.6rem   + 1.77vw, 2.75rem);
  --text-hero: clamp(2.441rem, 1.8rem   + 3.2vw,  4.5rem);

  /* Font families */
  --font-display: 'Playfair Display', 'Georgia', serif;
  --font-body:    'Source Serif 4', 'Georgia', serif;
  --font-mono:    'JetBrains Mono', 'Courier New', monospace;

  /* Spacing — 4px base, geometric progression */
  --space-1:  0.25rem;   --space-2:  0.5rem;
  --space-3:  0.75rem;   --space-4:  1rem;
  --space-6:  1.5rem;    --space-8:  2rem;
  --space-12: 3rem;      --space-16: 4rem;
  --space-24: 6rem;      --space-32: 8rem;

  /* Borders & radius */
  --radius-sm: 4px;  --radius-md: 8px;  --radius-lg: 16px;  --radius-full: 9999px;
  --border-width: 1px;  --border-width-thick: 2px;

  /* Elevation */
  --shadow-sm: 0 1px 4px rgba(26,22,20,.06);
  --shadow-md: 0 4px 16px rgba(26,22,20,.08);
  --shadow-lg: 0 12px 48px rgba(26,22,20,.12);

  /* Motion — intentional easing, not browser defaults */
  --ease-out-expo:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-back: cubic-bezier(0.68, -0.6, 0.32, 1.6);
  --duration-fast:    150ms;
  --duration-normal:  300ms;
  --duration-slow:    600ms;

  /* Layout */
  --container-sm:  640px;
  --container-md:  768px;
  --container-lg:  1024px;
  --container-xl:  1280px;
  --container-pad: var(--space-6);
}
```

> **Rule:** If a value isn't a token, it doesn't belong in a component stylesheet. Period.

### b. Shared Layout Component

Wraps every page. Provides the header, navigation, footer, and responsive container. Every page agent imports this — never creates its own.

**Path:** `src/components/Layout.tsx` (React) or `src/layouts/Layout.astro` (Astro)

```tsx
// Layout.tsx — simplified contract; foundation task provides the full implementation
interface LayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Layout({ title, description, children }: LayoutProps) {
  return (
    <>
      <Head title={title} description={description} />
      <div className="site">
        <SiteHeader />           {/* navigation — from tokens and style guide */}
        <main className="site__main">{children}</main>
        <SiteFooter />
      </div>
    </>
  );
}
```

The layout must handle:
- Responsive container (`max-width: var(--container-xl)`, centered, padded)
- Site header with navigation (labels defined in style guide brief)
- Site footer
- Consistent page padding using spacing tokens
- Document head (meta tags, fonts, canonical URL)

### c. UI Component Library

Shared primitives that every page agent imports. Each component uses only design tokens — zero hardcoded values.

**Path:** `src/components/ui/`

Minimum required components:

| Component | Purpose | Key variants |
|-----------|---------|--------------|
| `Button` | Primary CTA and actions | `primary`, `secondary`, `ghost` |
| `Card` | Content containers | `default`, `bordered`, `elevated` |
| `Heading` | h1–h6 with token-based sizing | via `level` prop |
| `Text` | Body copy with consistent sizing | `sm`, `base`, `lg` |
| `Link` | Anchor with consistent hover treatment | `default`, `subtle` |
| `Section` | Vertical spacing wrapper | `sm`, `md`, `lg`, `xl` |
| `Container` | Responsive width constraint | `sm`, `md`, `lg`, `xl` |
| `Grid` | Consistent column layout | via `cols` prop |

Component API rules (defined once, followed by all):
- Props use camelCase
- Variant selection via `variant` prop (string union)
- Size selection via `size` prop (string union)
- All components accept `className` for one-off overrides
- No inline `style` props in library components

### d. Style Guide Brief

Defined inline in the foundation task prompt (not a separate file). Page task prompts must quote it verbatim.

Required fields:
- **Aesthetic direction:** 2–3 words (`warm editorial`, `cold brutalist`, `soft playful`)
- **Typography pairing:** display font + body font + mono (if used)
- **Content tone:** formal/casual, active/passive, sentence length preference
- **Navigation labels:** exact labels for every nav link (prevents terminology drift)
- **Page structure pattern:** the default sequence (e.g., `hero → intro → features → CTA → footer`)
- **Terminology glossary:** any project-specific terms that could be said multiple ways (pick one)

---

## Consistency Rules for Page Agents

Every agent building a page in a multi-agent convoy MUST follow these rules. Non-negotiable.

### Visual
- Import tokens from the tokens file. **Never introduce a new color value, font size, or spacing value.**
- If a value you need doesn't exist as a token, stop and flag it — don't invent an inline value and move on.
- Use CSS custom properties exclusively. No raw hex, no raw `px` values in stylesheets.

### Code
- Import `Layout` from the shared layout path. Do not create a page-local layout wrapper.
- Import `Button`, `Card`, `Heading`, etc. from the UI library path. Do not recreate them.
- Follow the naming conventions: PascalCase components, camelCase props, kebab-case CSS classes.
- Co-locate component files (component, styles, tests) — do not scatter across `pages/`, `styles/`, and `components/`.

### Content
- Match the tone from the style guide brief exactly. If the brief says "conversational and direct," don't write formal passive-voice copy.
- Use the terminology glossary. If the brief says "projects" (not "work" or "portfolio"), use "projects" everywhere.
- Follow the heading hierarchy pattern. If H1 is the page title and H2 introduces sections, don't invent new patterns.

### Structural
- Every page uses the shared Layout component — no exceptions.
- Follow the page structure pattern from the style guide brief (`hero → content → CTA`, etc.).
- Navigation labels must match the style guide brief exactly — no paraphrasing.
- Responsive breakpoints come from the tokens file (`--container-sm/md/lg/xl`). Define no new breakpoints.

---

## Convoy Integration Pattern

```
Phase 1: foundation-setup  (1 task, blocks Phase 2)
├── Agent:  UI-UX Expert or Developer
├── Creates: tokens.css, Layout component, UI component library
├── Defines: style guide brief (aesthetic, tone, nav labels, terminology)
└── Output:  all paths documented for Phase 2 task prompts

Phase 2: page-building  (N tasks, all parallel)
├── home-page
├── about-page
├── projects-page
├── contact-page
└── [every task prompt contains the 5 mandatory references below]
```

### 5 Mandatory References in Every Page Task Prompt

```
1. Design tokens:    `[path to tokens.css]` — use ONLY these tokens. No new values.
2. Layout:           `[path to Layout]` — wrap all page content in this component.
3. UI components:    `[path to src/components/ui/]` — import; do not recreate.
4. Aesthetic:        [2-3 word direction from foundation]
5. Content tone:     [tone description from foundation]
```

These are **inputs** to the task, not suggestions.

---

## Prompt Template: Foundation Task

Copy and fill in. This prompt goes to a single agent before parallel work begins.

````markdown
## Foundation Setup

Create the design system foundation for [project description].

### Aesthetic Direction
[2-3 word aesthetic] — [one sentence: what this feels like and who it's for]

### Design Tokens
Create `[path]/tokens.css` with CSS custom properties for:
- Colors: name for intent (ink, paper, accent, muted, surface, border)
- Typography: [display font] + [body font], fluid clamp() scale (xs → hero)
- Spacing: 4px base, geometric progression (space-1 through space-32)
- Motion: custom easing curves + duration tokens (fast/normal/slow)
- Shadows (sm/md/lg), border radius (sm/md/lg/full), breakpoints (sm/md/lg/xl)

### Shared Layout
Create `[path]/Layout.[tsx|astro|vue]` with:
- Responsive container (max-width centered, padded with --container-pad)
- Site header with navigation: [list nav labels exactly]
- Site footer with [footer content]
- Document head (title, description, fonts)

### UI Component Library
Create these components in `[path]/ui/`:
Button (primary/secondary/ghost), Card (default/bordered/elevated),
Heading (h1–h6 via level prop), Text (sm/base/lg), Link,
Section (vertical spacer), Container (width constraint), Grid

Rules: all components use only token variables — zero hardcoded values.
Consistent prop API: variant, size, className on every component.

### Style Guide Brief
- Tone: [formal/casual, active/passive, sentence length]
- Terminology: [key terms — e.g., "projects" not "work", "clients" not "customers"]
- Page structure: [hero → intro → features → CTA]

### Acceptance Criteria
- [ ] All design values use CSS custom properties — zero hardcoded hex/px in components
- [ ] Layout renders correctly at 320px (mobile), 768px (tablet), 1280px (desktop)
- [ ] All UI components import tokens from the tokens file — no new values
- [ ] Typography uses clamp() for fluid sizing throughout
- [ ] Fonts are loaded efficiently (subset, display=swap)
- [ ] At least one distinctive design detail beyond generic defaults
````

---

## Prompt Template: Page Task

Copy and fill in for each parallel page task.

````markdown
## Build [Page Name] Page

[One paragraph: page purpose, target audience, primary user action]

### Foundation References (MANDATORY — do not deviate)
- **Design tokens:** `[path]/tokens.css` — use ONLY these variables. No new color/font/spacing values.
- **Layout component:** `[path]/Layout.[tsx|astro|vue]` — wrap all page content in this.
- **UI components:** `[path]/ui/` — use Button, Card, Heading, Section, Container. Do not recreate them.
- **Aesthetic:** [2-3 word direction]
- **Tone:** [tone from style guide brief]
- **Terminology:** [key terms from style guide brief]

### Page Content
[Specific sections, copy direction, media requirements]

### Page Structure
Follow the established pattern: [hero → intro → features → CTA] (from foundation brief)

### Acceptance Criteria
- [ ] Page uses the shared Layout component
- [ ] All styling uses design tokens — zero hardcoded values
- [ ] Shared UI components imported and used (not recreated)
- [ ] Content tone and terminology match the style guide brief
- [ ] Responsive at 320px, 768px, 1280px
- [ ] [page-specific criteria]
````

---

## Anti-Patterns

These will produce an inconsistent result regardless of individual page quality.

| Anti-pattern | Consequence | Fix |
|-------------|-------------|-----|
| Each agent picks fonts/colors | Every page feels like a different site | Foundation task creates tokens first |
| Page-local `styles/global.css` files | Conflicting resets and overrides | One shared tokens file, imported once |
| Copy-pasting `Button` between pages | API drift, visual divergence | Import from shared library |
| Inline `style={{ color: '#3b4f' }}` | Bypasses the token contract entirely | CSS class with token variable |
| Skipping foundation "for a simple site" | Still inconsistent — just smaller | Foundation takes 1 task, saves N fixes |
| Different terminology per page | Confuses users ("projects" vs "portfolio") | Terminology glossary in style guide brief |
| Foundation and page tasks run in parallel | Page tasks start before artifacts exist | Foundation phase must fully complete first |

---

## When to Load This Skill

Load this skill when:
- A convoy plan includes 2+ pages or UI sections built by different agents
- The `generate-convoy` prompt describes a multi-page application
- A decomposition produces parallel page-building tasks
- A Developer or UI-UX Expert agent is working on a page within a multi-agent build

The **decomposition** skill should reference this skill in multi-page task plans. The **generate-convoy** prompt template should embed the foundation-first pattern.
