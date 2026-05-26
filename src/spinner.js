import { C, G, W, D } from './ansi.js';

const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

export async function withSpinner(msg, fn) {
  // Skip spinner if not a TTY (e.g. --json mode, piped output)
  if (!process.stdout.isTTY) {
    return fn();
  }

  let frame = 0;
  let stopped = false;
  const interval = setInterval(() => {
    if (stopped) return;
    process.stdout.write(`\r  ${C}${FRAMES[frame++ % FRAMES.length]}${W} ${msg}`);
  }, 80);

  try {
    const result = await fn();
    stopped = true;
    clearInterval(interval);
    process.stdout.write(`\r  ${G}✓${W} ${msg}  ${D}done${W}   \n`);
    return result;
  } catch (e) {
    stopped = true;
    clearInterval(interval);
    process.stdout.write(`\r  ${R}✗${W} ${msg}  ${D}failed${W}   \n`);
    throw e;
  }
}
