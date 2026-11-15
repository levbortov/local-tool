import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessages, normalizeSearch, relevance, buildLibrary, pathUnder, readSelectedFiles } from '../src/lib/library.mjs';

test('legacy format: titles, #tags, # spaced tags, raw message', () => {
  const cards = parseMessages('[Заголовок #тег # тег2 #тег]\r\nСодержимое первой отписки\r\n\r\n[ #Тег ]\r\nВторая\r\n\r\nТретья без заголовка', 'main.txt');
  assert.equal(cards.length,3);
  assert.equal(cards[0].title,'Заголовок');
  assert.deepEqual(cards[0].tags,['тег','тег2']);
  assert.equal(cards[0].body,'Содержимое первой отписки');
  assert.equal(cards[1].title,'');
  assert.deepEqual(cards[1].tags,['тег']);
  assert.equal(cards[2].body,'Третья без заголовка');
});
test('BOM, whitespace separators, empty metadata are handled',()=>{
  const cards = parseMessages('\uFEFF[Пусто #тег]\n\nПросто текст\n \nДругая строка', 'file.txt');
  assert.equal(cards.length,2);
  assert.equal(cards[0].body,'Просто текст');
});
test('transliteration and partial substring',()=>{
  assert.equal(normalizeSearch('SUPER'),'супер');
  assert.equal(normalizeSearch('star'),'стар');
  assert.equal(normalizeSearch('платЁж'),'платеж');
  const m = parseMessages('[Суперстар #Выплата]\nЗаявка на проверку', 'one.txt')[0];
  assert.ok(relevance(m,'super')>0);
  assert.ok(relevance(m,'star')>0);
  assert.ok(relevance(m,'ПЛАТ')>0);
  assert.equal(relevance(m,'жираф'),0);
});
test('favorites identities survive insertion of unrelated message',()=>{
  const a = parseMessages('Первый\n\nВторой','one.txt');
  const b = parseMessages('Нулевой\n\nПервый\n\nВторой','one.txt');
  assert.equal(a[0].id,b[1].id);
  assert.equal(a[1].id,b[2].id);
  assert.notEqual(a[0].id,parseMessages('Первый','two.txt')[0].id);
});
test('folder grouping, nested filtering',()=>{
  const a = parseMessages('ответ','a.txt');
  const b = parseMessages('ответ','A/B/b.txt');
  const lib = buildLibrary([{path:'A/B/b.txt',messages:b},{path:'a.txt',messages:a}]);
  assert.deepEqual(lib.directories,['','A','A/B']);
  assert.equal(lib.total,2);
  assert.ok(pathUnder('A/B/b.txt','A'));
  assert.equal(pathUnder('A/B/b.txt','C'),false);
});
test('directory input reconstructs nested files without File System Access API', async () => {
  const root = new File(['[Привет #тест]\nТекст'], 'a.txt', { type: 'text/plain' });
  Object.defineProperty(root, 'webkitRelativePath', { value: 'Библиотека/a.txt' });
  const nested = new File(['Заявка обработана'], 'b.txt', { type: 'text/plain' });
  Object.defineProperty(nested, 'webkitRelativePath', { value: 'Библиотека/Платежи/b.txt' });
  const result = await readSelectedFiles([nested, root]);
  assert.equal(result.folderName, 'Библиотека');
  assert.deepEqual(result.files.map(file=>file.path), ['a.txt','Платежи/b.txt']);
  assert.equal(result.total,2);
  assert.deepEqual(result.skipped,[]);
});
