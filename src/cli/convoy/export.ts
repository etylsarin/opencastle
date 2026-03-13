// Convoy data exports are handled by the dashboard ETL (src/dashboard/scripts/etl.ts)
// which reads directly from the SQLite convoy store.
//
// Per-convoy event logs are in .opencastle/logs/convoys/{convoy-id}.ndjson
// (written by the event emitter in events.ts, one file per convoy run).
//
// export functions removed to prevent unbounded NDJSON growth.
// All convoy and pipeline data is queryable from the SQLite store at .opencastle/convoy.db.

export {}
