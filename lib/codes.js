// Membuat kode unik yang enak dibaca manusia:
// - Huruf kapital + angka
// - Tanpa karakter yang gampang tertukar: 0/O, 1/I/L
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SEGMENT_LEN = 4;

function randomSegment(len) {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function generateCode(prefix) {
  const p = (prefix || "RVW").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "RVW";
  return `${p}-${randomSegment(SEGMENT_LEN)}-${randomSegment(SEGMENT_LEN)}`;
}

function generateUniqueCodes(count, existingCodesSet, prefix) {
  const result = [];
  const seen = new Set(existingCodesSet);
  let attempts = 0;
  const maxAttempts = count * 50 + 1000;
  while (result.length < count && attempts < maxAttempts) {
    attempts++;
    const code = generateCode(prefix);
    if (!seen.has(code)) {
      seen.add(code);
      result.push(code);
    }
  }
  if (result.length < count) {
    throw new Error("Gagal membuat cukup kode unik, coba lagi dengan jumlah lebih kecil.");
  }
  return result;
}

module.exports = { generateCode, generateUniqueCodes };
