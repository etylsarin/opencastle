---
name: accessibility-standards
description: "WCAG 2.2 Level AA accessibility patterns for React/HTML/CSS. Use when creating or modifying UI components, forms, navigation, tables, images, or any user-facing elements. Covers keyboard navigation, screen reader semantics, low vision contrast, voice access, and inclusive language."
---

# Accessibility Standards

Code must conform to [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/). Go beyond minimal conformance wherever possible.

## Workflow

1. Before generating code, plan how to implement it accessibly.
2. After generating code, review against WCAG 2.2 and these patterns. Iterate until compliant.
3. Inform the user the code was built with accessibility in mind but may still have issues. Suggest [Accessibility Insights](https://accessibilityinsights.io/) for testing.

## Inclusive Language

- Use people-first language ("person using a screen reader," not "blind user").
- Avoid stereotypes or assumptions about ability.
- Flag uncertain implementations — include reasoning or references to standards.

## Cognitive

- Prefer plain language.
- Use consistent page structure (landmarks) across the application.
- Keep navigation items in the same order across pages.
- Keep the interface clean — reduce unnecessary distractions.

## Keyboard

- All interactive elements must be keyboard navigable with predictable focus order (reading order).
- Focus must be clearly visible at all times.
- All interactive elements must be operable (buttons, links, dropdowns, etc.).
- Static (non-interactive) elements should NOT have `tabindex`. Exception: elements receiving programmatic focus (e.g., headings) get `tabindex="-1"`.
- Hidden elements must not be keyboard focusable.

### Composite Components (grids, listboxes, menus, tabs, toolbars)

- Tab stop on the container with appropriate interactive role.
- Arrow keys navigate children (roving tabindex or `aria-activedescendant`).
- On focus: show selected child, or previously focused child, or first interactive child.

### Bypass Blocks

Provide "Skip to main" link as first focusable element:

```html
<header>
  <a href="#maincontent" class="sr-only">Skip to main</a>
</header>
<main id="maincontent"></main>
```

```css
.sr-only:not(:focus):not(:active) {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
```

### Common Keys

| Key | Action |
|-----|--------|
| `Tab` | Next interactive element |
| `Arrow` | Navigate within composite component |
| `Enter` | Activate focused control |
| `Escape` | Close open surfaces (dialogs, menus) |

### Roving Tabindex Pattern

1. Initial: `tabindex="0"` on first focusable child, `tabindex="-1"` on rest.
2. On arrow key: set previous to `-1`, new target to `0`, call `element.focus()`.

### `aria-activedescendant` Pattern

- Container has `tabindex="0"` and `aria-activedescendant="IDREF"`.
- CSS draws focus outline on referenced element.
- Arrow keys update `aria-activedescendant`.

## Low Vision

- Dark text on light backgrounds (or vice versa).
- Text contrast ≥4.5:1 (≥3:1 for large text: 18.5px bold or 24px).
- Graphics/controls contrast ≥3:1 with adjacent colors.
- Control state indicators (pressed, focus, checked) ≥3:1 contrast.
- Color must NOT be the only way to convey information — use text/shapes in addition.

## Screen Reader

- All elements must convey correct semantics (name, role, value, states/properties). Prefer native HTML; use ARIA when necessary.
- Use landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`.
- Use headings (`<h1>`–`<h6>`) to introduce sections. One `<h1>` per page. Avoid skipping levels.

## Voice Access

- Accessible name of interactive elements must contain the visual label (so voice users can say "Click [label]").
- `aria-label` must contain the visual label text.

## Forms

- Labels must accurately describe control purpose.
- Required fields: asterisk in label + `aria-required="true"`.
- Errors: `aria-invalid="true"` on invalid fields. Error messages via `aria-describedby`.
- Inline errors next to fields (common) or form-level errors at top identifying specific fields.
- Submit buttons should NOT be disabled — trigger error messages instead.
- On submit with invalid input, focus the first invalid field.

## Graphics and Images

- All graphics must have correct role (`<img>` implicit, `<svg>` needs `role="img"`, icon fonts/emojis need `role="img"` on `<span>`).
- **Informative**: `alt` text conveying meaning/purpose (concise, meaningful). Avoid `title` attribute.
- **Decorative**: `alt=""` for `<img>`, `aria-hidden="true"` for `role="img"`.

## Input Labels

- All interactive elements need visual labels.
- `<label for="id">` for form inputs.
- Multiple controls with same label (e.g., "Remove"): use `aria-label` for disambiguation.
- Help text: associate via `aria-describedby`.

## Navigation

```html
<nav>
  <ul>
    <li>
      <button aria-expanded="false" tabindex="0">Section 1</button>
      <ul hidden>
        <li><a href="..." tabindex="-1">Link 1</a></li>
      </ul>
    </li>
    <li>
      <button aria-expanded="false" tabindex="-1">Section 2</button>
      <ul hidden>
        <li><a href="..." tabindex="-1">Link 1</a></li>
      </ul>
    </li>
  </ul>
</nav>
```

- Navigation menus use `<nav>` with `<ul>`, NOT `menu`/`menubar` roles.
- Toggle `aria-expanded` on expand/collapse.
- Roving tabindex for main items (arrow across), arrow down into sub-menus.
- `Escape` closes expanded menus.

## Page Title

- Defined in `<title>` in `<head>`.
- Describes page purpose, unique per page.
- Front-load unique information: `"[Page] - [Section] - [Site]"`.

## Tables and Grids

- Column headers via `<th>` in first `<tr>`. Row headers via `<th>` in each row.
- `role="gridcell"` must be nested within `role="row"`.
- Prefer simple tables (one set of headers, no spanning cells).
- Use `<table>` for static data, `role="grid"` for interactive data (date pickers, calendars).
