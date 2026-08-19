// Penyimpanan sederhana berbasis file JSON.
// Cukup untuk ribuan kode; tidak butuh database terpisah.
// Semua penulisan file diantrekan (queue) supaya tidak saling tabrakan.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "codes.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ codes: {} }, null, 2));
  }
}

function readRaw() {
  ensureFile();
  const text = fs.readFileSync(DATA_FILE, "utf8");
  try {
    return JSON.parse(text);
  } catch (e) {
    // File korup/kosong -> mulai ulang dengan aman daripada crash.
    return { codes: {} };
  }
}

let writeQueue = Promise.resolve();
function writeRaw(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        const tmp = DATA_FILE + ".tmp";
        fs.writeFile(tmp, JSON.stringify(data, null, 2), (err) => {
          if (err) return reject(err);
          fs.rename(tmp, DATA_FILE, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      })
  );
  return writeQueue;
}

async function getAll() {
  return readRaw().codes;
}

async function get(code) {
  const data = readRaw();
  return data.codes[code] || null;
}

async function upsertMany(entries) {
  const data = readRaw();
  for (const entry of entries) {
    data.codes[entry.code] = entry;
  }
  await writeRaw(data);
}

async function update(code, patch) {
  const data = readRaw();
  if (!data.codes[code]) return null;
  data.codes[code] = { ...data.codes[code], ...patch };
  await writeRaw(data);
  return data.codes[code];
}

async function remove(code) {
  const data = readRaw();
  if (!data.codes[code]) return false;
  delete data.codes[code];
  await writeRaw(data);
  return true;
}

module.exports = { getAll, get, upsertMany, update, remove };
