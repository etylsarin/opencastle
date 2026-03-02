import { createInterface, type Interface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { SelectOption } from './types.js';

// ── ANSI helpers ──────────────────────────────────────────────────

const ESC = '\x1B';
const CSI = `${ESC}[`;
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const ERASE_LINE = `${CSI}2K`;

function moveUp(n: number): string {
  return n > 0 ? `${CSI}${n}A` : '';
}

// ── Line-buffered readline ────────────────────────────────────────
// readline.question() drops lines that arrived between calls because
// it only listens for the NEXT 'line' event.  When piped input
// delivers multiple lines in one chunk (e.g. `printf 'y\n3\n' | …`),
// the second line fires before the second question() is registered.
//
// We solve this with a permanent 'line' listener that pushes into a
// queue.  nextLine() either pops from the queue or awaits the next
// event — no data is ever lost.

let _rl: Interface | null = null;
const _lineBuffer: string[] = [];
let _lineResolver: ((_line: string) => void) | null = null;

function ensureRL(): void {
  if (_rl) return;
  _rl = createInterface({ input: stdin, output: stdout });
  _rl.on('line', (line: string) => {
    if (_lineResolver) {
      const resolve = _lineResolver;
      _lineResolver = null;
      resolve(line);
    } else {
      _lineBuffer.push(line);
    }
  });
  _rl.on('close', () => {
    _rl = null;
    // Resolve any pending prompt with empty string → triggers defaults
    if (_lineResolver) {
      const resolve = _lineResolver;
      _lineResolver = null;
      resolve('');
    }
  });
}

/**
 * Read the next line from stdin, displaying a prompt first.
 * Consumes from the internal buffer when piped input delivered
 * multiple lines in a single chunk.
 */
async function nextLine(prompt: string): Promise<string> {
  ensureRL();
  stdout.write(prompt);
  if (_lineBuffer.length > 0) {
    const line = _lineBuffer.shift()!;
    // Echo the buffered answer for non-TTY so logs read naturally
    if (!stdin.isTTY) stdout.write(line + '\n');
    return line;
  }
  return new Promise<string>((resolve) => {
    _lineResolver = resolve;
  });
}

/** Close the shared readline interface. Call once at command end. */
export function closePrompts(): void {
  if (_rl) {
    _rl.close();
    _rl = null;
    _lineBuffer.length = 0;
    _lineResolver = null;
  }
}

/**
 * Interactive single-choice selection prompt.
 *
 * TTY mode:  arrow-key navigation (↑/↓) with Enter to confirm.
 * Piped mode: falls back to number-based selection for scripts.
 */
export async function select(
  message: string,
  options: SelectOption[]
): Promise<string> {
  if (stdin.isTTY) {
    return selectInteractive(message, options);
  }
  return selectNumbered(message, options);
}

// ── Arrow-key selection (TTY) ─────────────────────────────────────

function renderOptions(
  options: SelectOption[],
  cursor: number,
  initial: boolean
): void {
  // Move back up to overwrite previous render (skip on first draw)
  if (!initial) {
    stdout.write(moveUp(options.length));
  }

  for (let i = 0; i < options.length; i++) {
    const active = i === cursor;
    const marker = active ? '❯' : ' ';
    const hint = options[i].hint ? ` — ${options[i].hint}` : '';
    const label = active
      ? `\x1B[36m${options[i].label}\x1B[0m${hint}`
      : `${options[i].label}${hint}`;
    stdout.write(`${ERASE_LINE}\r    ${marker} ${label}\n`);
  }
}

function selectInteractive(
  message: string,
  options: SelectOption[]
): Promise<string> {
  return new Promise<string>((resolve) => {
    let cursor = 0;

    // Pause the readline interface so raw mode can take over
    if (_rl) _rl.pause();

    stdout.write(`\n  ${message}\n\n`);
    stdout.write(HIDE_CURSOR);
    renderOptions(options, cursor, true);

    stdin.setRawMode(true);
    stdin.resume();

    const onData = (data: Buffer): void => {
      const key = data.toString();

      // Arrow up or k
      if (key === `${ESC}[A` || key === 'k') {
        cursor = (cursor - 1 + options.length) % options.length;
        renderOptions(options, cursor, false);
        return;
      }

      // Arrow down or j
      if (key === `${ESC}[B` || key === 'j') {
        cursor = (cursor + 1) % options.length;
        renderOptions(options, cursor, false);
        return;
      }

      // Enter
      if (key === '\r' || key === '\n') {
        cleanup();
        // Re-render final state with the selected option highlighted
        stdout.write(moveUp(options.length));
        for (let i = 0; i < options.length; i++) {
          const active = i === cursor;
          const hint = options[i].hint ? ` — ${options[i].hint}` : '';
          const label = active
            ? `\x1B[36m${options[i].label}\x1B[0m${hint}`
            : `\x1B[2m${options[i].label}${hint}\x1B[0m`;
          const marker = active ? '✔' : ' ';
          stdout.write(`${ERASE_LINE}\r    ${marker} ${label}\n`);
        }
        stdout.write('\n');
        resolve(options[cursor].value);
        return;
      }

      // Ctrl+C
      if (key === '\x03') {
        cleanup();
        stdout.write('\n');
        process.exit(130);
      }
    };

    function cleanup(): void {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdout.write(SHOW_CURSOR);
      // Resume readline for subsequent confirm() calls
      if (_rl) _rl.resume();
    }

    stdin.on('data', onData);
  });
}

// ── Number-based selection (piped / non-TTY) ──────────────────────

async function selectNumbered(
  message: string,
  options: SelectOption[]
): Promise<string> {
  console.log(`\n  ${message}\n`);
  options.forEach((opt, i) => {
    const hint = opt.hint ? ` — ${opt.hint}` : '';
    console.log(`    ${i + 1}) ${opt.label}${hint}`);
  });

  let choice: SelectOption | undefined;
  while (!choice) {
    const answer = await nextLine(`\n  Select [1-${options.length}]: `);
    // Handle EOF — stdin closed without valid selection
    if (answer === '' && (!_rl || !stdin.isTTY)) {
      console.error('\n  ✗ No input received (stdin closed). Aborting.');
      process.exit(1);
    }
    const num = parseInt(answer, 10);
    if (num >= 1 && num <= options.length) {
      choice = options[num - 1];
    } else {
      console.log(`    Please enter a number between 1 and ${options.length}`);
    }
  }

  return choice.value;
}

/**
 * Yes/No confirmation prompt.
 */
export async function confirm(
  message: string,
  defaultYes = true
): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await nextLine(`  ${message} ${hint} `);

  if (!answer.trim()) return defaultYes;
  return answer.trim().toLowerCase().startsWith('y');
}
