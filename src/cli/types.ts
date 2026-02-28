import type { ChildProcess } from 'node:child_process';

// ── Stack selection types ──────────────────────────────────────

export type CmsChoice = 'sanity' | 'contentful' | 'strapi' | 'none';
export type DbChoice = 'supabase' | 'convex' | 'none';
export type PmChoice = 'linear' | 'jira' | 'none';
export type NotifChoice = 'slack' | 'teams' | 'none';

export interface StackConfig {
  cms: CmsChoice;
  db: DbChoice;
  pm: PmChoice;
  notifications: NotifChoice;
}

/** Context passed from bin/cli.mjs to every command handler. */
export interface CliContext {
  pkgRoot: string;
  args: string[];
}

/** Results from a copy/install/update operation. */
export interface CopyResults {
  copied: string[];
  skipped: string[];
  created: string[];
}

/** Options for the copyDir utility. */
export interface CopyDirOptions {
  overwrite?: boolean;
  filter?: (_name: string, _srcPath: string) => boolean;
  transform?: (
    _content: string,
    _srcPath: string
  ) => Promise<string | null> | string | null;
}

/** OpenCastle project manifest (.opencastle.json). */
export interface Manifest {
  version: string;
  ide: string;
  installedAt: string;
  updatedAt: string;
  managedPaths?: ManagedPaths;
  stack?: StackConfig;
}

/** Framework vs customizable file paths. */
export interface ManagedPaths {
  framework: string[];
  customizable: string[];
}

/** IDE adapter interface (init/update commands). */
export interface IdeAdapter {
  install(_pkgRoot: string, _projectRoot: string, _stack?: StackConfig): Promise<CopyResults>;
  update(_pkgRoot: string, _projectRoot: string, _stack?: StackConfig): Promise<CopyResults>;
  getManagedPaths(): ManagedPaths;
}

/** Select prompt option. */
export interface SelectOption {
  label: string;
  hint?: string;
  value: string;
}

/** Scaffold result from MCP config. */
export interface ScaffoldResult {
  path: string;
  action: 'created' | 'skipped';
}

// ── Run command types ──────────────────────────────────────────

/** Validated task spec from YAML. */
export interface TaskSpec {
  name: string;
  concurrency: number;
  on_failure: 'continue' | 'stop';
  adapter: string;
  tasks: Task[];
  _verbose?: boolean;
}

/** A single task in the spec. */
export interface Task {
  id: string;
  prompt: string;
  agent: string;
  timeout: string;
  depends_on: string[];
  files: string[];
  description: string;
  _process?: ChildProcess;
}

/** Task execution status. */
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'timed-out';

/** Result of a single task execution. */
export interface TaskResult {
  id: string;
  status: TaskStatus;
  duration: number;
  output: string;
  exitCode: number;
}

/** Final run report. */
export interface RunReport {
  name: string;
  startedAt: string;
  completedAt: string;
  duration: string;
  summary: RunSummary;
  tasks: TaskResult[];
}

/** Summary counts of task statuses. */
export interface RunSummary {
  total: number;
  done: number;
  failed: number;
  skipped: number;
  'timed-out': number;
}

/** Agent runtime adapter for the run command. */
export interface AgentAdapter {
  name: string;
  isAvailable(): Promise<boolean>;
  execute(_task: Task, _options?: ExecuteOptions): Promise<ExecuteResult>;
  kill?(_task: Task): void;
}

/** Options for agent execution. */
export interface ExecuteOptions {
  verbose?: boolean;
}

/** Result from an agent adapter execution. */
export interface ExecuteResult {
  success: boolean;
  output: string;
  exitCode: number;
  _timedOut?: boolean;
  taskId?: string;
}

/** Reporter interface for the run command. */
export interface Reporter {
  onTaskStart(_task: Task): void;
  onTaskDone(_task: Task, _result: TaskResult): void;
  onTaskSkipped(_task: Task, _reason: string): void;
  onPhaseStart(_phase: number, _tasks: Task[]): void;
  onComplete(_report: RunReport): Promise<void>;
}

/** Reporter options. */
export interface ReporterOptions {
  reportDir?: string;
  verbose?: boolean;
}

/** Parsed CLI args for the run command. */
export interface RunOptions {
  file: string;
  dryRun: boolean;
  concurrency: number | null;
  adapter: string | null;
  reportDir: string | null;
  verbose: boolean;
  help: boolean;
}

/** Parse result from YAML block parser. */
export interface ParseResult {
  value: unknown;
  nextIndex: number;
}

/** Validation result. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Timeout promise with cancel ability. */
export interface TimeoutHandle {
  promise: Promise<ExecuteResult>;
  clear: () => void;
}

/** Executor returned by createExecutor. */
export interface Executor {
  run(): Promise<RunReport>;
  getPhases(): Task[][];
}
