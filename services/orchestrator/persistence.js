const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'sessions');
fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(id) {
  return path.join(DATA_DIR, `${encodeURIComponent(id)}.json`);
}

// Persists everything except the EventEmitter (which only makes sense at
// runtime) so a restart can rehydrate sessions instead of losing them.
function save(session) {
  const { emitter, ...plain } = session;
  try {
    fs.writeFileSync(filePath(session.id), JSON.stringify(plain));
  } catch (err) {
    console.error(`[persistence] failed to save session ${session.id}: ${err.message}`);
  }
}

function loadAll() {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      } catch (err) {
        console.error(`[persistence] failed to load ${f}: ${err.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { save, loadAll };
