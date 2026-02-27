---
name: deployment-infrastructure
description: "Deployment architecture, environment variables, cron jobs, security headers, and caching patterns. Use when configuring deployments, managing environment variables, setting up cron jobs, or troubleshooting build/deployment issues."
---

# Deployment Infrastructure

All deployment configuration is project-specific. See [deployment-config.md](../../customizations/stack/deployment-config.md) for the full architecture, environment variables, cron jobs, caching headers, and key files.

## Generic Deployment Principles

- Use platform-native Git integration for CI/CD (push to main = production, push to branch = preview)
- Store all secrets as environment variables — never in code, commits, or logs
- Use `Bearer` token auth for cron job endpoints
- Apply security headers via framework config (HSTS, CSP, X-Frame-Options, Permissions-Policy)
- Set immutable cache headers for static assets (`max-age=31536000, immutable`)
- Use short cache durations for frequently changing assets (e.g., favicon: `max-age=86400`)
- Load the **security-hardening** skill for full header inventory and CSP configuration

## Release Process

### 1. Pre-Release Audit
- Run `yarn nx affected -t lint,test,build` to verify all affected projects
- Review all changed files since last release (`git diff` against last tag/release)
- Check for uncommitted work or unmerged branches
- Verify no draft PRs are accidentally included

### 2. Regression Check
- Identify features adjacent to changes and spot-check them
- Run full test suites for all affected projects (not just changed files)
- Check deployment preview builds for visual regressions
- Verify critical user flows still work (homepage, search, venue detail)

### 3. Changelog & Release Notes
- Generate changelog from commit messages and PR titles since last release
- Categorize changes: Features, Bug Fixes, Performance, Breaking Changes, Internal
- Write human-readable release notes summarizing impact
- Include migration notes for any breaking changes

### 4. Version Management
- Follow semver: MAJOR (breaking), MINOR (features), PATCH (fixes)
- Tag releases in git with the version number
- Update version references in relevant files

### 5. Release Verification
- Confirm deployment succeeded on production
- Smoke-test production URLs for critical pages
- Monitor error rates and performance metrics post-release
- Document rollback steps if issues arise
