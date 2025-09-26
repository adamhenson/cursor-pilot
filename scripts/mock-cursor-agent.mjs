#!/usr/bin/env node
import readline from 'node:readline';

function parseArgs(argv) {
  const args = argv.slice(2);
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const sub = args[0];
  if (sub === '--help' || !sub) {
    console.log('Usage: mock-cursor-agent [command]');
    console.log('Commands:');
    console.log('  agent --print "<text>"');
    process.exit(0);
  }
  if (sub === 'agent') {
    // find --print
    const idx = args.indexOf('--print');
    if (idx >= 0 && args[idx + 1]) {
      const text = args[idx + 1];
      console.log(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }));
      console.log(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ACK: ' + text }] } }));
    }
    console.log('Proceed? [y/n]');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => {
      const val = String(line || '').trim().toLowerCase();
      if (val === 'y' || val === 'n') {
        if (val === 'y') {
          console.log('✅ Done');
          rl.close();
          process.exit(0);
        } else {
          console.error('Operation cancelled');
          rl.close();
          process.exit(1);
        }
      }
    });
    return;
  }
  console.error('Unknown command');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
