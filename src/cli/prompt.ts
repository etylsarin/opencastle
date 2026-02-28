import { createInterface, type Interface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { SelectOption } from './types.js';

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
 */
export async function select(
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
