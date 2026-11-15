/** Parsing and indexing are framework-independent for reproducible tests. */

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
export const byName = (a, b) => collator.compare(a, b);

/** The legacy library separates entries by an empty line (two newline characters). */
export function parseMessages(source, path) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const chunks = normalized.split(/\n[ \t]*\n+/);
  const used = new Map();
  const messages = [];
  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;
    const lines = text.split('\n');
    let title = '';
    let tags = [];
    let body = text;
    if (/^\[[^\n]*\]$/.test(lines[0].trim())) {
      const inside = lines[0].trim().slice(1, -1).trim();
      const firstHash = inside.indexOf('#');
      title = (firstHash === -1 ? inside : inside.slice(0, firstHash)).trim();
      const seen = new Set();
      const matchText = firstHash === -1 ? '' : inside.slice(firstHash);
      for (const match of matchText.matchAll(/#\s*([^\s#]+)/g)) {
        const tag = match[1].toLocaleLowerCase('ru');
        if (!seen.has(tag)) { seen.add(tag); tags.push(tag); }
      }
      body = lines.slice(1).join('\n').trim();
    }
    if (!body) continue;
    const uniqueKey = `${path}\u0000${title}\u0000${body}`;
    const occurrence = used.get(uniqueKey) ?? 0;
    used.set(uniqueKey, occurrence + 1);
    messages.push({
      id: `m-${hash(`${uniqueKey}\u0000${occurrence}`)}`,
      path,
      title,
      tags,
      body,
      preview: (title || body.split('\n')[0]).replace(/\s+/g, ' ').trim(),
    });
  }
  return messages;
}

function hash(str) {
  // Two FNV-1a variants reduce accidental collisions in small local libraries.
  let a = 2166136261, b = 2166136261 ^ 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 16777619);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

// Transliteration is intentional, not translation: super -> супер, star -> стар.
const map = [
  ['shch','щ'],['sch','щ'],['yo','е'],['jo','е'],['yu','ю'],['ju','ю'],
  ['ya','я'],['ja','я'],['zh','ж'],['kh','х'],['ts','ц'],['ch','ч'],['sh','ш'],
  ['a','а'],['b','б'],['c','к'],['d','д'],['e','е'],['f','ф'],['g','г'],
  ['h','х'],['i','и'],['j','й'],['k','к'],['l','л'],['m','м'],['n','н'],
  ['o','о'],['p','п'],['q','к'],['r','р'],['s','с'],['t','т'],['u','у'],
  ['v','в'],['w','в'],['x','кс'],['y','й'],['z','з'],
];
const transliteration = new RegExp(map.map(([latin]) => latin).join('|'), 'g');
const translitMap = Object.fromEntries(map);
export function normalizeSearch(value) {
  return String(value).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е')
    .replace(/[a-z]+/g, (segment) => segment.replace(transliteration, (letter) => translitMap[letter]));
}
export function relevance(message, query) {
  const q = normalizeSearch(query.trim());
  if (!q) return 0;
  const title = normalizeSearch(message.title);
  const tags = normalizeSearch(message.tags.join(' '));
  const body = normalizeSearch(message.body);
  if (title === q || message.tags.some(tag => normalizeSearch(tag) === q.replace(/^#/,''))) return 7;
  if (title.startsWith(q)) return 6;
  if (tags.includes(q)) return 5;
  if (title.includes(q)) return 4;
  if (body.startsWith(q)) return 3;
  if (body.includes(q)) return 2;
  return 0;
}
export function parent(path) { return path.slice(0, Math.max(0,path.lastIndexOf('/'))); }
export function pathUnder(path, folder) { return !folder || path.startsWith(folder + '/'); }

/** webkitRelativePath does not expose an absolute directory path. */
export function buildLibrary(entries) {
  const sorted = [...entries].sort((a,b) => Number(a.path.includes('/')) - Number(b.path.includes('/')) || byName(a.path,b.path));
  const folders = new Set(['']);
  const files = [];
  for (const entry of sorted) {
    if (!entry.path || !entry.path.trim() || !entry.messages.length) continue;
    const pieces = entry.path.split('/');
    for (let i=1; i<pieces.length; i++) folders.add(pieces.slice(0,i).join('/'));
    files.push({path: entry.path, name: pieces.at(-1), messages: entry.messages});
  }
  const directories = [...folders].sort((a,b)=>byName(a,b));
  return {files, directories, total: files.reduce((sum,file)=>sum+file.messages.length,0)};
}

/** Read folder selection without File System Access API permissions. */
export async function readSelectedFiles(fileList) {
  const selected = [...fileList];
  const folderName = selected.find(f=>f.webkitRelativePath)?.webkitRelativePath.split('/')[0] || 'Библиотека';
  const entries = [];
  const skipped = [];
  for (const file of selected) {
    const parts = (file.webkitRelativePath || `${folderName}/${file.name}`).split('/');
    const rel = parts.slice(1).join('/');
    if (!rel || parts.some(part=>part.startsWith('.'))) continue;
    if (file.size > 4 * 1024 * 1024) { skipped.push(rel); continue; }
    try {
      const bytes = await file.arrayBuffer();
      const sample = new Uint8Array(bytes.slice(0,4096));
      const ctrl = [...sample].filter(x => x === 0 || (x < 9) || (x > 13 && x < 32)).length;
      if (ctrl > Math.max(1,sample.length * 0.02)) { skipped.push(rel); continue; }
      let content;
      try { content = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
      catch { content = new TextDecoder('windows-1251').decode(bytes); }
      const messages = parseMessages(content,rel);
      if (messages.length) entries.push({path:rel,messages});
    } catch { skipped.push(rel); }
  }
  return {folderName, ...buildLibrary(entries), skipped};
}