// CLI argument parser
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { command: 'scan', mode: 'personal', format: 'terminal', flags: new Set() };

  // Parse commands
  const commands = ['scan', 'report', 'card', 'team', 'compare', 'leaderboard'];
  const idx = argv.findIndex(a => commands.includes(a));
  if (idx >= 0) {
    args.command = argv[idx];
    argv = [...argv.slice(0, idx), ...argv.slice(idx + 1)];
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    // Modes
    if (a === '--mode' && argv[i + 1]) { args.mode = argv[++i]; continue; }
    if (a === '--focus' && argv[i + 1]) { args.focus = argv[++i]; continue; }

    // Formats
    if (a === '--json')      { args.format = 'json'; continue; }
    if (a === '--html')      { args.format = 'html'; continue; }
    if (a === '--markdown')  { args.format = 'markdown'; continue; }
    if (a === '--terminal')  { args.format = 'terminal'; continue; }

    // Flags
    if (a === '--accept' || a === '-y')  { args.flags.add('accept'); continue; }
    if (a === '--save' || a === '-s')    { args.flags.add('save'); continue; }
    if (a === '--open')                  { args.flags.add('open'); continue; }
    if (a === '--redact')                { args.flags.add('redact'); continue; }
    if (a === '--explain-paths')         { args.flags.add('explainPaths'); return { ...args, command: 'explainPaths' }; }
    if (a === '--version' || a === '-v') { return { ...args, command: 'version' }; }
    if (a === '--help' || a === '-h')    { return { ...args, command: 'help' }; }

    // Input files for team/compare
    if (a === '--input' && argv[i + 1]) { args.input = argv[++i]; continue; }

    // Positional args for compare
    if (!args.file1) { args.file1 = a; }
    else if (!args.file2) { args.file2 = a; }
  }

  // Default command shortcuts
  if (args.command === 'card') args.format = 'card';
  if (args.command === 'report' && args.format === 'terminal') args.format = 'html';

  return args;
}

export function showHelp() {
  return `
DevAura — Your dev machine tells the truth.

Usage:
  devaura                           Scan and show terminal report
  devaura scan --mode personal      Personal profile scan
  devaura scan --mode recruiter     Recruiter-safe report (redacted)
  devaura scan --mode security      Security hygiene check
  devaura scan --mode team          Team collection mode (JSON output)
  devaura report --html --open      Generate HTML report
  devaura card                      Generate share card (SVG)
  devaura scan --json               JSON output
  devaura scan --markdown           Markdown output
  devaura compare before.json after.json

Options:
  --mode <mode>      personal | recruiter | team | security
  --focus <focus>    ai | env | verification
  --json             JSON output
  --html             HTML report
  --markdown         Markdown output
  --save             Save report to ~/devaura-report.*
  --open             Open HTML report in browser
  --redact           Redact sensitive info
  --accept           Skip consent prompt
  --explain-paths    Show what paths will be scanned
  --version          Show version
  --help             Show this help

Examples:
  npx devaura
  npx devaura scan --html --open
  npx devaura scan --mode recruiter --redact --html
  npx devaura card
`.trim();
}
