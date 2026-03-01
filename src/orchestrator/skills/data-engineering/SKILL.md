---
name: data-engineering
description: "Data pipeline ETL workflows, web scraping with Puppeteer, NDJSON processing, and CMS data import. Use when building scrapers, processing data, running CLI tools, or importing to a CMS."
---

<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Data Engineering

Generic data pipeline patterns and scraping methodology. For project-specific pipeline architecture, sources, CLI commands, and data status, see [data-pipeline-config.md](../../customizations/stack/data-pipeline-config.md).

## Scraper Architecture

### Base Scraper Pattern

```typescript
interface ScraperConfig {
  source: string;
  query: string;
  maxPages: number;
  concurrency: number;
  delay: { min: number; max: number };
  outputPath: string;
  headless: boolean;
}

abstract class BaseScraper {
  abstract scrape(config: ScraperConfig): Promise<void>;
  abstract extractVenue(page: Page): Promise<RawVenue>;
  abstract getNextPage(page: Page): Promise<string | null>;
}
```

### Puppeteer Cluster Setup

```typescript
const cluster = await Cluster.launch({
  concurrency: Cluster.CONCURRENCY_CONTEXT,
  maxConcurrency: config.concurrency,
  puppeteerOptions: {
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  retryLimit: 3,
  retryDelay: 5000,
  timeout: 30000,
});
```

### Anti-Detection Measures

- Rotate user agents from a curated list
- Random delays between requests (2-5 seconds default)
- Randomize viewport sizes
- Block unnecessary resources (images, fonts, CSS) for speed
- Use stealth plugin for Puppeteer
- Request interception for resource optimization

### Error Recovery

- Retry failed pages with exponential backoff (3 retries default)
- Log failed URLs for manual review
- Save partial results on crash/interruption
- Checkpoint/resume for long-running scrapes

## NDJSON Output Format

Each scraper produces one record per line:

```json
{"name":"Example Venue","lat":50.0755,"lng":14.4378,"source":"google-maps","sourceId":"ChIJ...","category":"bar","address":"Street 30, City","rating":4.5,"reviewCount":120}
```

### Required Fields

| Field | Priority | Notes |
|-------|----------|-------|
| `name` | Required | Preserve original encoding |
| `lat`/`lng` | Required | GPS coordinates |
| `address` | Required | Full text address |
| `source` | Required | Source identifier (e.g., `google-maps`) |
| `sourceId` | Required | Source-specific unique ID |
| `category` | Required | Domain-specific category |

### Optional Fields

`rating`, `reviewCount`, `phone`, `website`, `openingHours`, `photos`, `priceLevel`

## Design Principles

- Pipelines as composable, single-responsibility stages
- Use streams for large file processing to minimize memory
- Idempotent imports with `createOrReplace` and deterministic `_id` generation
- Dry-run mode for all destructive operations
- Generate normalized names by stripping diacritics for search
- Structured addresses: `{ street, city, postalCode, country, countryCode }`
- Track data lineage — record source and transformation history
- Handle errors gracefully — skip bad records, don't halt pipeline
- Backup before bulk operations
- Respect `robots.txt` and rate limit all scraping requests
- Only scrape publicly available data with source attribution
