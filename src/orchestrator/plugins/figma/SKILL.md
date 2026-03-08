---
name: figma-design
description: "Figma design-to-code workflows, design token extraction, component inspection, and asset export. Use when translating Figma designs into code, extracting design tokens, or referencing component specs."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .opencastle/ directory instead. -->

# Figma Design

Figma-specific design-to-code patterns and MCP tool usage. For project-specific design system details, see the **frontend-design** skill.

## MCP Tools

The Figma MCP server enables AI agents to inspect designs directly:

| Tool | Purpose | Primary Agents |
|------|---------|----------------|
| `figma/get_file` | Retrieve full Figma file structure | UI/UX Expert |
| `figma/get_file_nodes` | Get specific nodes/frames | UI/UX Expert, Developer |
| `figma/get_images` | Export nodes as images | UI/UX Expert |
| `figma/get_comments` | Read design review comments | UI/UX Expert |
| `figma/get_styles` | Extract color/text/effect styles | Developer |
| `figma/get_components` | List reusable components | Developer |

## Design-to-Code Workflow

1. **Identify the frame** — get the Figma file URL or node ID from the task
2. **Inspect the design** — use `get_file_nodes` to retrieve layout, spacing, colors, typography
3. **Extract tokens** — map Figma styles to CSS custom properties or design tokens
4. **Build components** — translate Figma components to React/framework components
5. **Verify** — compare the implementation against the original design visually

## Design Token Extraction

### From Figma Styles to CSS

```css
/* Map Figma color styles to CSS custom properties */
:root {
  /* Primary */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-900: #1e3a8a;

  /* Typography (from Figma text styles) */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-size-sm: 0.875rem;    /* 14px */
  --font-size-base: 1rem;       /* 16px */
  --font-size-lg: 1.125rem;     /* 18px */
  --font-size-xl: 1.25rem;      /* 20px */

  /* Spacing (from Figma auto-layout) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
}
```

### Translation Rules

| Figma Concept | Code Equivalent |
|---------------|----------------|
| Auto Layout → horizontal | `display: flex; flex-direction: row` |
| Auto Layout → vertical | `display: flex; flex-direction: column` |
| Auto Layout gap | `gap: Npx` |
| Auto Layout padding | `padding: top right bottom left` |
| Fill → Hug contents | `width: auto` or `width: fit-content` |
| Fill → Fixed | `width: Npx` |
| Fill → Fill container | `flex: 1` or `width: 100%` |
| Corner radius | `border-radius: Npx` |
| Drop shadow | `box-shadow: x y blur spread color` |
| Opacity | `opacity: N` |

## Best Practices

- Always extract design tokens systematically — don't hardcode values from visual inspection
- Use Figma's auto-layout values directly for flex/grid properties
- Match Figma's responsive breakpoints to the project's breakpoint system
- Export SVG assets directly from Figma via `get_images` — don't recreate manually
- Cross-reference Figma component names with the codebase component library
- When in doubt about values, inspect the Figma node — don't approximate
- Keep a mapping document between Figma styles and CSS custom properties
