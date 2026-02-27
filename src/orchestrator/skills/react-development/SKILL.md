---
name: react-development
description: "React development standards for functional components, hooks, TypeScript integration, state management, styling with CSS Modules/Sass, and testing patterns. Use when creating or modifying React components, custom hooks, or component tests."
---

# React Development Standards

Modern React patterns following the official React documentation at https://react.dev.

## Architecture

- Functional components with hooks as primary pattern.
- Component composition over inheritance.
- Organize by feature/domain, not by type.
- Separate presentational and container components.
- Custom hooks for reusable stateful logic.

## TypeScript Integration

- Interfaces for props, state, and component definitions.
- Proper types for API responses, event handlers, and refs.
- Generic components where appropriate.
- Strict mode in `tsconfig.json`.
- Leverage built-in types (`React.FC`, `React.ComponentProps`, etc.).
- Union types for component variants and states.
- Shared types in `interfaces/` folder of appropriate project.

## Component Design

- Single responsibility principle.
- Descriptive, consistent PascalCase naming.
- Props validation via TypeScript.
- Small, focused, testable, reusable.
- Use `<>...</>` or `React.Fragment` to avoid extra DOM nodes.
- Never mutate props or state directly.
- Destructure props in function signature.

## State Management

- `useState` for local state.
- `useReducer` for complex state logic.
- `useContext` for cross-tree state sharing.
- React Query for server state.

## Hooks and Effects

- `useEffect` with proper dependency arrays.
- Cleanup functions in effects to prevent memory leaks.
- `useMemo`/`useCallback` for performance optimization when needed.
- Custom hooks for reusable logic.
- Rules of hooks: only call at top level.
- `useRef` for DOM access and mutable values.

## Styling

- **CSS Modules** with `.module.scss` files.
- **Sass** for advanced features.
- Scoped styles to avoid global conflicts.
- Responsive design with mobile-first approach.
- CSS custom properties for theming.
- Consistent spacing, typography, color systems.
- Sass variables and mixins from shared libraries.
- Co-locate styles with components.

## Performance

- Stable `key` props in lists.
- `React.memo` when appropriate.
- Code splitting with `React.lazy` and `Suspense`.
- Tree shaking and dynamic imports.
- Virtual scrolling for large lists.
- Profile with React DevTools.
- Avoid anonymous functions in render.
- `ErrorBoundary` for graceful error handling.

## Data Fetching

- Libraries: React Query, SWR, Apollo Client.
- Loading, error, and success states.
- Handle race conditions and request cancellation.
- Optimistic updates.
- Caching strategies.
- Offline/network error handling.

## Error Handling

- Error Boundaries for component-level errors.
- Proper error states in data fetching.
- Fallback UI for error scenarios.
- Meaningful error messages to users.

## Forms

- Controlled components.
- React Hook Form + Zod for validation.
- Form submission and error states.
- Accessibility: labels, ARIA attributes.
- Debounced validation.

## Testing

- React Testing Library: test behavior, not implementation.
- Jest as test runner.
- Mock external dependencies and API calls.
- Test accessibility and keyboard navigation.
- Co-locate tests in `__tests__` subdirectory.
- **CRITICAL**: Never mix static imports and `require()` for lazy-loaded libraries in tests.
- Use `jest.requireMock()` instead of `require()` in test functions.
- Use `jest.requireActual()` in mock setup.

## Security

- Sanitize user inputs (XSS prevention).
- Validate/escape data before rendering.
- HTTPS for external APIs.
- Avoid storing sensitive data in localStorage/sessionStorage.
- CSP headers.
