---
name: code-commenting
description: "Guidelines for writing self-explanatory code with minimal comments. Covers when to comment (WHY not WHAT), anti-patterns to avoid, annotation tags, and public API documentation. Use when writing or reviewing code comments."
---

# Self-explanatory Code Commenting

## Core Principle

**Write code that speaks for itself. Comment only when necessary to explain WHY, not WHAT.**
We do not need comments most of the time.

## Decision Framework

Before writing a comment, ask:

1. **Is the code self-explanatory?** → No comment needed
2. **Would a better variable/function name eliminate the need?** → Refactor instead
3. **Does this explain WHY, not WHAT?** → Good comment
4. **Will this help future maintainers?** → Good comment

## Comments to AVOID

**Obvious Comments**

```javascript
let counter = 0; // Initialize counter to zero
counter++; // Increment counter by one
```

**Redundant Comments**

```javascript
function getUserName() {
  return user.name; // Return the user's name
}
```

**Outdated Comments**

```javascript
// Calculate tax at 5% rate
const tax = price * 0.08; // Actually 8%
```

## Comments to WRITE

**Complex Business Logic**

```javascript
// Apply progressive tax brackets: 10% up to 10k, 20% above
const tax = calculateProgressiveTax(income, [0.1, 0.2], [10000]);
```

**Non-obvious Algorithms**

```javascript
// Using Floyd-Warshall for all-pairs shortest paths
// because we need distances between all nodes
for (let k = 0; k < vertices; k++) { /* ... */ }
```

**Regex Patterns**

```javascript
// Match email format: username@domain.extension
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
```

**API Constraints or Gotchas**

```javascript
// GitHub API rate limit: 5000 requests/hour for authenticated users
await rateLimiter.wait();
```

## Public APIs

```javascript
/**
 * Calculate compound interest using the standard formula.
 *
 * @param {number} principal - Initial amount invested
 * @param {number} rate - Annual interest rate (as decimal, e.g., 0.05 for 5%)
 * @param {number} time - Time period in years
 * @param {number} compoundFrequency - How many times per year interest compounds (default: 1)
 * @returns {number} Final amount after compound interest
 */
function calculateCompoundInterest(principal, rate, time, compoundFrequency = 1) {
  // ... implementation
}
```

## Configuration and Constants

```javascript
const MAX_RETRIES = 3; // Based on network reliability studies
const API_TIMEOUT = 5000; // AWS Lambda timeout is 15s, leaving buffer
```

## Annotation Tags

```javascript
// TODO: Replace with proper user authentication after security review
// FIXME: Memory leak in production - investigate connection pooling
// HACK: Workaround for bug in library v2.1.0 - remove after upgrade
// NOTE: This implementation assumes UTC timezone for all calculations
// WARNING: This function modifies the original array instead of creating a copy
// PERF: Consider caching this result if called frequently in hot path
// SECURITY: Validate input to prevent SQL injection before using in query
// BUG: Edge case failure when array is empty - needs investigation
// REFACTOR: Extract this logic into separate utility function for reusability
// DEPRECATED: Use newApiFunction() instead - this will be removed in v3.0
```

## Anti-Patterns

- **Dead code comments** — Don't comment out code; delete it (git has history)
- **Changelog comments** — Don't maintain change history in comments; use git
- **Divider comments** — Don't use decorative separators; use proper file structure

## Quality Checklist

Before committing, ensure your comments:

- [ ] Explain WHY, not WHAT
- [ ] Are grammatically correct and clear
- [ ] Will remain accurate as code evolves
- [ ] Add genuine value to code understanding
- [ ] Are placed appropriately (above the code they describe)
- [ ] Use proper spelling and professional language

**The best comment is the one you don't need to write because the code is self-documenting.**
