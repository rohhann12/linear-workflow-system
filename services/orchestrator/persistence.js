const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'sessions');
fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(id) {
  return path.join(DATA_DIR, `${encodeURIComponent(id)}.json`);
}

function save(session) {
  const { emitter, ...plain } = session;
  try {
    fs.writeFileSync(filePath(session.id), JSON.stringify(plain));
  } catch (err) {
    console.error(`[persistence] failed to save session ${session.id}: ${err.message}`);
  }
}

function remove(id) {
  try {
    fs.rmSync(filePath(id), { force: true });
  } catch (err) {
    console.error(`[persistence] failed to remove session ${id}: ${err.message}`);
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

module.exports = { save, loadAll, remove };
