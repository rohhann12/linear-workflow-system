const { spawn } = require('child_process');
const sessions = require('./sessions');

const NO_GIT_INSTRUCTION = [
  'Do not run any git commands (no git add, commit, push, or branch operations).',
  'The orchestrator handles all git staging, committing, and pushing after you finish.',
  'Just write/edit the files needed and run any install or build commands required.',
].join(' ');

function truncate(str, n) {
  if (!str) return str;
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function summarizeToolUse(block) {
  const input = block.input || {};
  let detail = '';
  if (input.file_path) detail = input.file_path;
  else if (input.command) detail = truncate(input.command, 100);
  else if (input.pattern) detail = input.pattern;
  else detail = truncate(JSON.stringify(input), 100);
  return `→ ${block.name} ${detail}`.trim();
}

// Runs one Claude Code sub-agent headlessly in `cwd`, streaming a log line per
// step onto the session's event stream. Resolves { success, summary }.
function runClaudeAgent({ session, label, cwd, prompt }) {
  return new Promise((resolve) => {
    sessions.emit(session, 'log', { level: 'info', text: `[${label}] starting…` });

    const child = spawn(
      'claude',
      [
        '-p',
        prompt,
        '--permission-mode',
        'bypassPermissions',
        '--output-format',
        'stream-json',
        '--verbose',
        '--append-system-prompt',
        NO_GIT_INSTRUCTION,
      ],
      { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let buffer = '';
    let lastResult = { success: false, summary: 'no result' };

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        handleEvent(event);
      }
    });

    child.stderr.on('data', (chunk) => {
      sessions.emit(session, 'log', {
        level: 'error',
        text: `[${label}] ${truncate(chunk.toString().trim(), 300)}`,
      });
    });

    child.on('error', (err) => {
      sessions.emit(session, 'log', { level: 'error', text: `[${label}] failed to start: ${err.message}` });
      resolve({ success: false, summary: err.message });
    });

    child.on('close', (code) => {
      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer));
        } catch {
          // ignore trailing partial line
        }
      }
      const success = code === 0 && lastResult.success !== false;
      sessions.emit(session, 'log', {
        level: success ? 'info' : 'error',
        text: `[${label}] ${success ? 'done' : 'failed'} — ${lastResult.summary}`,
      });
      resolve({ success, summary: lastResult.summary });
    });

    function handleEvent(event) {
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text?.trim()) {
            sessions.emit(session, 'log', {
              level: 'info',
              text: `[${label}] ${truncate(block.text.trim(), 240)}`,
            });
          } else if (block.type === 'tool_use') {
            sessions.emit(session, 'log', {
              level: 'info',
              text: `[${label}] ${summarizeToolUse(block)}`,
            });
          }
        }
      } else if (event.type === 'result') {
        lastResult = {
          success: event.subtype === 'success',
          summary: truncate(event.result || event.subtype || 'finished', 200),
        };
      }
    }
  });
}

module.exports = { runClaudeAgent };
