---
name: cypress-testing
description: "Cypress E2E and component testing patterns, commands, selectors, and CI configuration. Use when writing E2E tests, component tests, or configuring Cypress in CI pipelines."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the .github/customizations/ directory instead. -->

# Cypress Testing

Cypress-specific E2E and component testing patterns. For project-specific test configuration and breakpoints, see [testing-config.md](../../customizations/stack/testing-config.md).

## Commands

```bash
npx cypress open                   # Open interactive test runner
npx cypress run                    # Run tests headlessly (CI)
npx cypress run --spec "cypress/e2e/auth/**"  # Run specific specs
npx cypress run --browser chrome   # Specify browser
npx cypress run --headed           # Run with visible browser
npx cypress run --component        # Run component tests only
npx cypress run --record           # Record to Cypress Cloud
```

## Test Structure

```
cypress/
├── e2e/                     # E2E test specs
│   ├── auth/
│   │   ├── login.cy.ts
│   │   └── signup.cy.ts
│   └── dashboard/
│       └── overview.cy.ts
├── fixtures/                # Test data (JSON)
│   └── users.json
├── support/
│   ├── commands.ts          # Custom commands
│   ├── e2e.ts               # E2E support file
│   └── component.ts         # Component test support
└── downloads/               # Downloaded files during tests
```

## Writing Tests

### E2E Test Pattern

```typescript
// cypress/e2e/auth/login.cy.ts
describe('Login', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should log in with valid credentials', () => {
    cy.get('[data-testid="email-input"]').type('user@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-testid="email-input"]').type('wrong@example.com');
    cy.get('[data-testid="password-input"]').type('wrong');
    cy.get('[data-testid="login-button"]').click();

    cy.get('[data-testid="error-message"]').should('contain', 'Invalid credentials');
  });
});
```

### Custom Commands

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

## Selector Strategy

Priority order for selecting elements:

1. `data-testid` attributes — most resilient to UI changes
2. `aria-label` or `role` — accessible and meaningful
3. Dedicated CSS classes — avoid styling classes
4. **Never** use tag names, auto-generated classes, or fragile CSS paths

## Best Practices

- Use `cy.intercept()` to stub/spy on API calls — don't depend on backend state
- Use `cy.session()` for authentication — avoid logging in before every test
- Avoid `cy.wait(ms)` — use `cy.intercept()` with aliases instead
- Assert on visible elements — Cypress auto-retries, so assertions are resilient
- Keep tests independent — each test should set up its own state
- Use fixtures for test data — avoid hardcoding values in tests
- Add `data-testid` attributes to components during development, not retroactively

## CI Configuration

```yaml
# GitHub Actions example
cypress:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: cypress-io/github-action@v6
      with:
        build: npm run build
        start: npm run start
        wait-on: 'http://localhost:3000'
        browser: chrome
```

## Configuration (cypress.config.ts)

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    retries: { runMode: 2, openMode: 0 },
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
});
```
