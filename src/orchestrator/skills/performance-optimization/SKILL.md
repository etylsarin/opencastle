---
name: performance-optimization
description: "Frontend and backend performance optimization patterns including rendering, asset optimization, JavaScript performance, caching, profiling, and code review checklist. Use when optimizing components, reviewing code for performance, or analyzing bundle size and Core Web Vitals."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Performance Optimization

## General Principles

- **Measure first, optimize second** — profile before optimizing. Use Chrome DevTools, Lighthouse, Datadog.
- **Optimize for the common case** — focus on frequently executed code paths.
- **Avoid premature optimization** — write clear code first, optimize when necessary.
- **Minimize resource usage** — CPU, memory, network, disk.
- **Prefer simplicity** — simple algorithms are often faster and easier to optimize.
- **Document performance assumptions** — comment performance-critical code.
- **Automate performance testing** — integrate into CI/CD.
- **Set performance budgets** — define limits for load time, memory, API latency.

## Rendering and DOM

- **Memoization**: Use `React.memo`, `useMemo`, `useCallback` judiciously — only when profiling shows unnecessary re-renders. Don't pre-optimize.
- Stable `key` props in lists (avoid array indices unless static).
- Avoid inline styles (can trigger layout thrashing). Prefer CSS classes.
- CSS transitions/animations over JavaScript for GPU-accelerated effects.
- `requestIdleCallback` for deferring non-critical rendering.

## Asset Optimization

- Modern image formats (WebP, AVIF). Tools: ImageOptim, Squoosh.
- SVGs for icons.
- Bundle and minify JS/CSS (Webpack, Rollup, esbuild). Tree-shaking.
- Long-lived cache headers for static assets. Cache busting for updates.
- `loading="lazy"` for images. Dynamic imports for JS.
- Font subsetting. `font-display: swap`.

## JavaScript Performance

- Offload heavy computation to Web Workers.
- Debounce/throttle scroll, resize, input events.
- Clean up event listeners, intervals, DOM references (prevent memory leaks).
- Maps/Sets for lookups. TypedArrays for numeric data.
- Avoid global variables.
- Avoid deep object cloning unless necessary.

## Node.js

- Async APIs only — never `fs.readFileSync` in production.
- Clustering or worker threads for CPU-bound tasks.
- Streams for large file/network processing.
- Profile with `clinic.js`, `node --inspect`.

## Code Review Checklist

- [ ] No obvious algorithmic inefficiencies (O(n²) or worse)?
- [ ] Appropriate data structures?
- [ ] No unnecessary computations or repeated work?
- [ ] Caching used where appropriate with correct invalidation?
- [ ] Database queries optimized, indexed, no N+1?
- [ ] Large payloads paginated, streamed, or chunked?
- [ ] No memory leaks or unbounded resource usage?
- [ ] Network requests minimized, batched, retried on failure?
- [ ] Assets optimized, compressed, served efficiently?
- [ ] No blocking operations in hot paths?
- [ ] Logging in hot paths minimized and structured?
- [ ] Performance-critical paths documented and tested?
- [ ] Automated benchmarks for performance-sensitive code?
- [ ] Alerts for performance regressions?
- [ ] No anti-patterns (SELECT *, blocking I/O, globals)?
- [ ] Memoization used judiciously — only where profiling shows benefit?

## Practical Examples

### Debouncing User Input

```javascript
// BAD: API call on every keystroke
input.addEventListener('input', (e) => fetch(`/search?q=${e.target.value}`));

// GOOD: Debounced
let timeout;
input.addEventListener('input', (e) => {
  clearTimeout(timeout);
  timeout = setTimeout(() => fetch(`/search?q=${e.target.value}`), 300);
});
```

### Lazy Loading Images

```html
<!-- BAD -->
<img src="large-image.jpg" />

<!-- GOOD -->
<img src="large-image.jpg" loading="lazy" />
```

## References

- [Google Web Fundamentals: Performance](https://web.dev/performance/)
- [MDN: Performance](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
