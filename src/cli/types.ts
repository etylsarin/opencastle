import type { ChildProcess } from 'node:child_process';

// ── Stack selection types ──────────────────────────────────────

export type IdeChoice = 'vscode' | 'cursor' | 'claude-code' | 'opencode';
export type TechTool = 'sanity' | 'contentful' | 'strapi' | 'supabase' | 'convex' | 'vercel' | 'nx' | 'chrome-devtools' | 'nextjs' | 'astro' | 'netlify' | 'turborepo' | 'prisma' | 'cypress' | 'playwright' | 'vitest' | 'figma' | 'resend';
export type TeamTool = 'linear' | 'jira' | 'slack' | 'teams';

export interface StackConfig {
  ides: IdeChoice[];
  techTools: TechTool[];
  teamTools: TeamTool[];
}

/** Check if a stack config uses the legacy v1 format (individual choices with 'none'). */
export function isLegacyStack(stack: unknown): stack is { cms: string; db: string; pm?: string; notifications?: string } {
  return typeof stack === 'object' && stack !== null && 'cms' in stack;
}

/** Migrate a legacy v1 stack config to the v2 array format. */
export function migrateStackConfig(
  legacy: { cms: string; db: string; pm?: string; notifications?: string },
  ide?: string
): StackConfig {
  const techTools: TechTool[] = [];
  const teamTools: TeamTool[] = [];

  if (legacy.cms && legacy.cms !== 'none') techTools.push(legacy.cms as TechTool);
  if (legacy.db && legacy.db !== 'none') techTools.push(legacy.db as TechTool);
  if (legacy.pm && legacy.pm !== 'none') teamTools.push(legacy.pm as TeamTool);
  if (legacy.notifications && legacy.notifications !== 'none') teamTools.push(legacy.notifications as TeamTool);

  const ides: IdeChoice[] = ide ? [ide as IdeChoice] : [];
  return { ides, techTools, teamTools };
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

/** Combined repository tooling info — auto-detected + user-declared. */
export interface RepoInfo {
  packageManager?: string;
  monorepo?: string;
  language?: string;
  frameworks?: string[];
  databases?: string[];
  cms?: string[];
  deployment?: string[];
  testing?: string[];
  cicd?: string[];
  styling?: string[];
  auth?: string[];
  pm?: string[];
  notifications?: string[];
  mcpConfig?: boolean;
  configFiles?: string[];
}

/** OpenCastle project manifest (.opencastle.json). */
export interface Manifest {
  version: string;
  ide: string;
  ides?: string[];
  installedAt: string;
  updatedAt: string;
  managedPaths?: ManagedPaths;
  stack?: StackConfig;
  repoInfo?: RepoInfo;
}

/** Framework vs customizable file paths. */
export interface ManagedPaths {
  framework: string[];
  customizable: string[];
}

/** Structure check for the doctor command — describes expected files/dirs per IDE. */
export interface DoctorCheck {
  /** Human-friendly label for the check */
  label: string;
  /** Relative path to a file or directory (ending with /) to check exists */
  path: string;
  /** 'file' or 'dir' */
  type: 'file' | 'dir';
  /** If true, counts the contents and reports count */
  countContents?: boolean;
  /** File extension filter when counting (e.g. '.md', '.mdc', '.agent.md') */
  countFilter?: string;
}

/** IDE adapter interface (init/update commands). */
export interface IdeAdapter {
  install(_pkgRoot: string, _projectRoot: string, _stack?: StackConfig, _repoInfo?: RepoInfo): Promise<CopyResults>;
  update(_pkgRoot: string, _projectRoot: string, _stack?: StackConfig): Promise<CopyResults>;
  getManagedPaths(): ManagedPaths;
  getDoctorChecks(): DoctorCheck[];
}

/** Select prompt option. */
export interface SelectOption {
  label: string;
  hint?: string;
  value: string;
  /** Whether this option starts selected (preselected). */
  selected?: boolean;
}

/** Scaffold result from MCP config. */
export interface ScaffoldResult {
  path: string;
  action: 'created' | 'skipped';
}

/** IDE display labels. */
export const IDE_LABELS: Record<IdeChoice, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
};

// ── Run command types ──────────────────────────────────────────

/** Default values merged into each task for Convoy Engine (version: 1) specs. */
export interface TaskDefaults {
  timeout?: string;
  model?: string;
  max_retries?: number;
  agent?: string;
  adapter?: string;
}

/** Validated task spec from YAML. */
export interface TaskSpec {
  name: string;
  concurrency: number;
  on_failure: 'continue' | 'stop';
  adapter: string;
  tasks?: Task[];
  _verbose?: boolean;
  /** Spec schema version (1 for Convoy Engine format, 2 for pipeline chaining). */
  version?: number;
  /** Worker defaults merged into each task (Convoy Engine). */
  defaults?: TaskDefaults;
  /** Shell commands run after all tasks complete; each must exit 0. */
  gates?: string[];
  /** Git feature branch name. */
  branch?: string;
  /** Other convoy spec names to run before this one (version: 2 pipeline specs). */
  depends_on_convoy?: string[];
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
  /** Model override for this task. */
  model?: string;
  /** Max retry attempts (default: 1). */
  max_retries: number;
  /** Per-task adapter override. */
  adapter?: string;
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
  /** Working directory for the agent process (defaults to process.cwd()). */
  cwd?: string;
}

/** Token usage data from adapter execution. */
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** Result from an agent adapter execution. */
export interface ExecuteResult {
  success: boolean;
  output: string;
  exitCode: number;
  _timedOut?: boolean;
  taskId?: string;
  /** Token usage data if available from the adapter. */
  usage?: TokenUsage;
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
  resume: boolean;
  status: boolean;
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
