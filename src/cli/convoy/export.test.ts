// export.test.ts — exportConvoyToNdjson and exportPipelineToNdjson have been
// removed from export.ts (see that file for rationale). No tests needed.

import { describe, it } from 'vitest'

describe('export', () => {
  it('export functions removed — data access goes through SQLite store', () => {
    // The monolithic NDJSON export functions were removed to prevent unbounded
    // file growth. All convoy/pipeline data is in convoy.db (SQLite).
  })
})
