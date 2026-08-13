const { spawn } = require('child_process');
const sessions = require('./sessions');

function run(session, label, command, args, opts = {}) {
  return new Promise((resolve) => {
    sessions.emit(session, 'log', { level: 'info', text: `[${label}] $ ${command} ${args.join(' ')}` });
    const child = spawn(command, args, { ...opts, env: { ...process.env, ...opts.env } });
    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      chunk
        .toString()
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => sessions.emit(session, 'log', { level: 'info', text: `[${label}] ${l}` }));
    });
    child.stderr.on('data', (chunk) => {
      chunk
        .toString()
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l) => sessions.emit(session, 'log', { level: 'warn', text: `[${label}] ${l}` }));
    });
    child.on('error', (err) => {
      sessions.emit(session, 'log', { level: 'error', text: `[${label}] failed to start: ${err.message}` });
      resolve({ code: -1, stdout });
    });
    child.on('close', (code) => resolve({ code, stdout }));
  });
}

module.exports = { run };
