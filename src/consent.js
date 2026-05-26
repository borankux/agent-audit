import { createInterface } from 'readline';
import { openSync, closeSync, createReadStream } from 'fs';
import { B, W, C, G, R, D } from './ansi.js';

export async function showConsent(agents) {
  const agentLines = agents
    .filter(a => a.detected)
    .map(a => {
      const displayPaths = a.dataPaths.map(p =>
        p.replace(process.env.HOME, '~')
      ).join(', ');
      return `    ${G}✓${W} ${B}${a.name.padEnd(14)}${W} ${D}${displayPaths}${W}`;
    })
    .join('\n');

  console.log(`
  ${B}╭───────────────────────────────────────────────────────╮${W}
  ${B}│${W}${B}     Coding Agent Proficiency Analyzer             ${W}    ${B}│${W}
  ${B}│${W}${D}     Assess your AI-assisted coding skills          ${W}    ${B}│${W}
  ${B}╰───────────────────────────────────────────────────────╯${W}

  ${C}Detected agents:${W}
${agentLines}

  ${C}What will be scanned:${W}
    ${G}✓${W} Configuration files (MCP servers, plugins, hooks)
    ${G}✓${W} Session statistics (tool usage, frequency, tokens)
    ${G}✓${W} Custom skills & agents (${D}names only, not contents${W})

  ${R}What will NOT be collected:${W}
    ${R}✗${W} Code, file contents, or conversation text
    ${R}✗${W} Project names or directory structures
    ${R}✗${W} Nothing is uploaded — everything stays on this machine

  ${D}The report is safe to share with employers/recruiters.${W}
`);

  const answer = await askYesNo("Run the scan?");
  if (!answer) {
    console.log(`\n  ${D}Declined. No data was scanned. Goodbye!${W}\n`);
    return false;
  }
  console.log();
  return true;
}

function askYesNo(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(`  ${B}▶ ${prompt}${W} [${G}Y${W}/n] `);

    let fd;
    try {
      const ttyPath = process.platform === 'win32' ? 'CONIN$' : '/dev/tty';
      fd = openSync(ttyPath, 'r');
    } catch {
      resolve(true);
      return;
    }

    const rl = createInterface({ input: createReadStream('', { fd }) });
    rl.on('line', (line) => {
      rl.close();
      try { closeSync(fd); } catch {}
      const ans = line.trim().toLowerCase();
      resolve(ans !== 'n' && ans !== 'no');
    });
  });
}
