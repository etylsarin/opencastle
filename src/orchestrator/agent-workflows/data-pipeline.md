<!-- ⚠️ This file is managed by OpenCastle. Edits will be overwritten on update. Customize in the customizations/ directory instead. -->

# Workflow: Data Pipeline

Standard execution plan for scraping, processing, and importing data.

> **Project config:** For project-specific paths, data schema, CLI commands, and processing rules, see `data-pipeline-config.md`. For data model docs, see `docs-structure.md`.

## Phases

```
Phase 1: Source Analysis    (sub-agent, inline)
Phase 2: Scraping           (background agent)
Phase 3: Processing         (sub-agent, sequential)
Phase 4: Validation         (sub-agent, inline)
Phase 5: Import             (sub-agent, inline)
Phase 6: Compound           (direct, Team Lead)
```

---

## Branch & Delivery Strategy

Follow the **Delivery Outcome** in `general.instructions.md` and the **Branch Ownership** rules in `team-lead.agent.md`. Branch naming: `feat/<ticket-id>-<short-description>`. Only code changes are committed — NDJSON data files in `tmp/` are NOT committed to Git.

---

## Phase 1: Source Analysis

**Agent:** Data Expert (via sub-agent)
**Type:** Sub-agent (inline)

### Steps

1. Analyze the target data source (website, API, file)
2. Identify data fields available and their mapping to the place schema
3. Check the data model documentation (see `docs-structure.md`) for required fields
4. Estimate record count
5. Check for existing scraper patterns (see **data-engineering** skill)
6. Create Linear issue with data source details

### Exit Criteria

- [ ] Source structure documented
- [ ] Field mapping defined (source field → target field)
- [ ] Estimated record count
- [ ] Linear issue created
- [ ] Scraper approach decided (Puppeteer, fetch, API)

---

## Phase 2: Scraping

**Agent:** Data Expert
**Type:** Background agent (may be long-running)

### Steps

1. Implement scraper following existing patterns (see `data-pipeline-config.md`)
2. Output raw data as NDJSON
3. Handle pagination, rate limiting, and error recovery
4. Log scraping statistics (pages visited, records extracted, errors)

### Exit Criteria

- [ ] Raw NDJSON file produced
- [ ] Scraping statistics logged
- [ ] No duplicate records
- [ ] Output contract returned

---

## Phase 3: Processing

**Agent:** Data Expert (via sub-agent)
**Type:** Sub-agent (sequential — depends on Phase 2 output)

### Steps

1. Convert raw data to the target schema format
2. Enrich with geocoding, slug generation, image optimization
3. Normalize text fields (see data-pipeline-config.md for rules)
4. Validate against place schema
5. Output processed NDJSON

### Exit Criteria

- [ ] Processed NDJSON matches place schema
- [ ] All required fields present
- [ ] Slugs are unique
- [ ] Geocoding complete
- [ ] Pipeline tests pass: `yarn nx run data-pipeline:test`
- [ ] Output contract returned with quality metrics

---

## Phase 4: Validation

**Agent:** Team Lead (self)
**Type:** Sub-agent (inline)

### Steps

1. Spot-check 10-20 records manually
2. Run validation script against full dataset
3. Check for duplicates against existing data
4. Verify image URLs are accessible
5. Confirm field mapping accuracy

### Exit Criteria

- [ ] Spot check passed
- [ ] Validation script reports <1% error rate
- [ ] No duplicates with existing data
- [ ] Images accessible

---

## Phase 5: Import

**Agent:** Data Expert (via sub-agent)
**Type:** Sub-agent (inline — need immediate feedback)

### Steps

1. Import small test batch (5-10 records) first
2. Verify in CMS
3. Import full dataset
4. Log import statistics (created, updated, skipped, failed)
5. Update Linear issue and roadmap

### Exit Criteria

- [ ] Test batch verified in CMS
- [ ] Full import complete
- [ ] Import statistics logged
- [ ] <0.1% failure rate
- [ ] Output contract returned
- [ ] Delivery Outcome completed (see `general.instructions.md`) — branch pushed, PR opened (not merged), Linear linked

---

### Phase 6: Delivery (Compound)

> **See [shared-delivery-phase.md](shared-delivery-phase.md) for the standard delivery steps.**
>
> Commit → Push → PR → Linear linkage. Team Lead owns delivery.
