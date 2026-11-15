const prefix = 'cliche.v1.';
export function readStored(key, fallback) {
  try { const raw = localStorage.getItem(prefix + key); return raw === null ? fallback : JSON.parse(raw); }
  catch { return fallback; }
}
export function store(key, value) {
  try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function favoriteKey(folderName) {
  // Browsers do not reveal the absolute path for <input webkitdirectory>.
  return 'favorites.' + folderName.trim().toLocaleLowerCase('ru');
}