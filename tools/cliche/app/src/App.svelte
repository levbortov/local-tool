<script lang="ts">
  import { onMount } from 'svelte';
  import { Tabs } from 'bits-ui';
  import Icon from './Icon.svelte';
  import ReplyCard from './ReplyCard.svelte';
  import type { Reply, Library } from './types';
  import { parent, pathUnder, relevance, byName, readSelectedFiles } from './lib/library.mjs';
  import { favoriteKey, readStored, store } from './lib/storage.mjs';

  type Scope = 'all' | 'folder' | 'file';
  type Theme = 'system' | 'dark' | 'light';
  type Layout = 'grid' | 'list';
  let folderInput: HTMLInputElement;
  let searchInput = $state<HTMLInputElement | undefined>(undefined);
  let library = $state<Library | null>(null);
  let selectedFolder = $state('');
  let selectedFile = $state('');
  let expandedFolders = $state<Set<string>>(new Set(['']));
  let expandedCards = $state<Set<string>>(new Set());
  let favorites = $state<Set<string>>(new Set());
  let search = $state('');
  let scope = $state<Scope>('all');
  let showFavorites = $state(false);
  let sidebarOpen = $state(false);
  let sidebarCollapsed = $state(false);
  let loading = $state(false);
  let toast = $state('');
  let copiedId = $state('');
  let theme = $state<Theme>('system');
  let layout = $state<Layout>('grid');
  let notificationTimeout: ReturnType<typeof setTimeout> | undefined;
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;

  const directFiles = $derived(library?.files.filter(file => parent(file.path) === selectedFolder) ?? []);
  const activeFile = $derived(library?.files.find(file => file.path === selectedFile) ?? null);
  const allMessages = $derived(library?.files.flatMap(file => file.messages) ?? []);
  const isSearching = $derived(search.trim().length > 0);
  const visibleFolders = $derived.by(() => {
    if (!library) return [];
    return library.directories.filter(folder => {
      if (!folder) return true;
      const parents = folder.split('/');
      return parents.slice(0, -1).every((_,i) => expandedFolders.has(parents.slice(0, i+1).join('/')))
        && expandedFolders.has('');
    });
  });
  const filtered = $derived.by(() => {
    if (!library) return [];
    let messages = showFavorites ? allMessages.filter(m => favorites.has(m.id)) :
      isSearching ? allMessages : activeFile?.messages ?? [];
    if (isSearching) {
      if (scope === 'folder') messages = messages.filter(m => pathUnder(m.path, selectedFolder));
      if (scope === 'file') messages = messages.filter(m => m.path === selectedFile);
      messages = messages.map(m => ({ message: m, rank: relevance(m, search) }))
        .filter(result => result.rank > 0)
        .sort((a,b) => b.rank - a.rank || byName(a.message.path,b.message.path))
        .map(result => result.message);
    }
    return messages;
  });
  const showingLocation = $derived(showFavorites || (isSearching && scope !== 'file'));

  onMount(() => {
    theme = readStored('theme', 'system');
    layout = readStored('layout', 'grid');
    const motion = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (motion.matches ? 'dark' : 'light') : theme; };
    motion.addEventListener('change', apply);
    apply();
    return () => { motion.removeEventListener('change',apply); clearTimeout(notificationTimeout); clearTimeout(copyTimeout); };
  });
  $effect(() => {
    const mode = theme;
    document.documentElement.dataset.theme = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  });

  function notify(message:string) {
    toast = message;
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => toast = '', 3400);
  }
  function toggleTheme() {
    theme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    if (!store('theme',theme)) notify('Не удалось сохранить настройки браузера');
  }
  function toggleLayout() {
    layout = layout === 'grid' ? 'list' : 'grid';
    if (!store('layout',layout)) notify('Не удалось сохранить настройки браузера');
  }
  function pickFolder() { folderInput?.click(); }
  async function loadFolder(event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const list = target.files;
    if (!list?.length) return;
    loading = true;
    try {
      const incoming: Library = await readSelectedFiles(list);
      if (!incoming.files.length) { notify('В этой папке не найдены сообщения в текстовых файлах'); return; }
      library = incoming;
      const rootFile = incoming.files.find(file => !parent(file.path));
      const first = rootFile ?? incoming.files[0];
      selectedFile = first.path;
      selectedFolder = parent(first.path);
      expandedFolders = new Set(['', ...selectedFolder.split('/').map((_,i)=>selectedFolder.split('/').slice(0,i+1).join('/'))]);
      expandedCards = new Set();
      search = '';
      scope = 'all';
      showFavorites = false;
      sidebarOpen = false;
      favorites = new Set(readStored(favoriteKey(incoming.folderName), []));
      notify(`${incoming.total} сообщений · ${incoming.files.length} тематик${incoming.skipped.length ? ` · пропущено файлов: ${incoming.skipped.length}` : ''}`);
    } catch(error) {
      notify('Не удалось прочитать папку: ' + (error instanceof Error ? error.message : String(error)));
    } finally { loading = false; target.value = ''; }
  }
  function chooseFolder(folder:string) {
    selectedFolder = folder;
    selectedFile = library?.files.find(file => parent(file.path) === folder)?.path ?? '';
    sidebarOpen = false;
    showFavorites = false;
    expandedFolders = new Set([...expandedFolders, folder]);
  }
  function toggleFolder(folder:string) {
    const next = new Set(expandedFolders);
    if (next.has(folder)) next.delete(folder); else next.add(folder);
    expandedFolders = next;
  }
  function hasChildren(folder:string) {
    return library?.directories.some(item => item !== folder && parent(item) === folder) ?? false;
  }
  function toggleCard(id:string) {
    const next = new Set(expandedCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    expandedCards = next;
  }
  function toggleFavorite(id:string) {
    if (!library) return;
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id); else next.add(id);
    favorites = next;
    if (!store(favoriteKey(library.folderName), [...next])) notify('Избранное не удалось сохранить в браузере');
  }
  function legacyCopy(text:string) {
    const field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    document.body.appendChild(field);
    field.focus(); field.select();
    let success = false;
    try { success = document.execCommand('copy'); } finally { field.remove(); }
    return success;
  }
  async function copy(item:Reply) {
    let ok = false;
    // On file:// the legacy call must run synchronously within the click gesture.
    if (location.protocol === 'file:') ok = legacyCopy(item.body);
    if (!ok && navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(item.body); ok = true; } catch { /* browser blocked Clipboard API */ }
    }
    if (!ok && location.protocol !== 'file:') ok = legacyCopy(item.body);
    if (!ok) { notify('Браузер не разрешил копирование. Выдели текст в развёрнутой карточке.'); return; }
    copiedId = item.id;
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => copiedId = '', 1500);
  }
</script>

<input class="hidden-file-input" aria-label="Выбрать рабочую директорию" type="file" webkitdirectory multiple bind:this={folderInput} onchange={loadFolder}/>
<div class="app-shell" class:sidebar-collapsed={sidebarCollapsed}>
  <header class="app-header">
    <div class="brand-group">
      {#if library}
        <button class="icon-button sidebar-menu" type="button" title="Показать каталоги" aria-label="Показать каталоги" onclick={() => { sidebarOpen = !sidebarOpen; sidebarCollapsed = false; }}><Icon name="panel" size={19}/></button>
      {/if}
      <div class="brand-mark"><Icon name="spark" size={20}/></div>
      <div class="brand-text"><span class="brand-name">Клише</span><span class="brand-divider">/</span><span class="brand-subtitle">библиотека ответов</span></div>
    </div>
    <div class="header-actions">
      {#if library}
        <button class="icon-button favorites-toggle" class:active={showFavorites} type="button" aria-label="Показать избранное" aria-pressed={showFavorites} title="Избранное" onclick={() => {showFavorites = !showFavorites;sidebarOpen = false;}}><Icon name="star" size={19} filled={showFavorites}/></button>
      {/if}
      <button class="icon-button" type="button" aria-label="Сменить оформление" title={`Тема: ${theme === 'system' ? 'системная' : theme === 'dark' ? 'тёмная' : 'светлая'}`} onclick={toggleTheme}><Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'settings'} size={19}/></button>
      <span class="header-separator"></span>
      <button class="header-folder-button" type="button" disabled={loading} onclick={pickFolder}><Icon name="folder-open" size={17}/><span>{library ? 'Сменить папку' : 'Открыть папку'}</span></button>
    </div>
  </header>

  {#if !library}
    <main class="welcome-panel">
      <div class="welcome-icon"><Icon name="folder-open" size={30}/></div>
      <span class="eyebrow">ЛОКАЛЬНАЯ БИБЛИОТЕКА</span>
      <h1>Нужный ответ.<br/><span>В один клик.</span></h1>
      <p>Выбери папку с готовыми сообщениями. «Клише» соберёт их в удобную библиотеку, поможет найти нужное и скопировать его без заголовков и тегов.</p>
      <button class="primary-button" type="button" disabled={loading} onclick={pickFolder}><Icon name="folder" size={18}/>{loading ? 'Читаем папку…' : 'Выбрать рабочую папку'}<span class="button-arrow">↗</span></button>
      <div class="welcome-points"><span><Icon name="check" size={14}/> Без сервера</span><span><Icon name="check" size={14}/> Без загрузки файлов в сеть</span><span><Icon name="check" size={14}/> Работает офлайн</span></div>
      <div class="welcome-example"><span class="example-label">ПРИМЕР ЗАПИСИ</span><code>[Проверка платежа #платёж #проверка]<br/>Ваш платёж сейчас находится в обработке.</code><span class="example-description">Пустая строка разделяет сообщения. Заголовки и теги необязательны.</span></div>
    </main>
  {:else}
    <div class="workspace">
      {#if sidebarOpen}<button class="mobile-scrim" type="button" aria-label="Закрыть проводник" onclick={() => sidebarOpen = false}></button>{/if}
      <aside class="sidebar" class:sidebar-open={sidebarOpen} aria-label="Каталоги библиотеки">
        <div class="sidebar-header">
          <span class="section-overline">РАБОЧАЯ ПАПКА</span>
          <div class="directory-title"><Icon name="folder-open" size={18}/><span title={library.folderName}>{library.folderName}</span></div>
        </div>
        <div class="tree-heading"><span>КАТАЛОГИ</span><span>{Math.max(0,library.directories.length - 1)}</span></div>
        <nav class="directory-tree" aria-label="Структура каталогов">
          {#each visibleFolders as folder (folder)}
            <div class="folder-row" class:selected={selectedFolder === folder && !showFavorites} style={`padding-left: ${12 + folder.split('/').filter(Boolean).length * 14}px`}>
              {#if hasChildren(folder)}
                <button class="folder-expand" type="button" aria-label={expandedFolders.has(folder) ? 'Свернуть каталог' : 'Развернуть каталог'} aria-expanded={expandedFolders.has(folder)} onclick={() => toggleFolder(folder)}><Icon name={expandedFolders.has(folder) ? 'chevron-down' : 'chevron-right'} size={15}/></button>
              {:else}<span class="folder-spacer"></span>{/if}
              <button class="folder-label" type="button" onclick={() => chooseFolder(folder)} title={folder || library.folderName} aria-current={selectedFolder === folder && !showFavorites ? 'page' : undefined}><Icon name={selectedFolder === folder ? 'folder-open' : 'folder'} size={17}/><span>{folder ? folder.split('/').at(-1) : 'Все файлы в корне'}</span></button>
            </div>
          {/each}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-stats"><span class="status-dot"></span>{library.total} ответов · {library.files.length} тематик</div>
          <span class="footer-note">Только чтение · локально</span>
        </div>
      </aside>
      <section class="main-panel" aria-label="Сообщения">
        <div class="topicbar">
          {#if !showFavorites}
            <div class="topicbar-title"><span>{selectedFolder ? selectedFolder.split('/').at(-1) : library.folderName}</span><span class="topicbar-breadcrumb">/ тематики</span></div>
          {:else}
            <div class="topicbar-title"><Icon name="star" size={17} filled={true}/><span>Избранное</span></div>
          {/if}
          <div class="topicbar-right"><span>{showFavorites ? favorites.size : directFiles.length} {showFavorites ? 'избранных' : 'файлов'}</span></div>
        </div>
        {#if !showFavorites}
          <Tabs.Root bind:value={selectedFile} class="tab-root">
            <Tabs.List class="topic-tabs" aria-label="Тематики">
              {#each directFiles as topic (topic.path)}
                <Tabs.Trigger value={topic.path} class="topic-tab" title={topic.name}><Icon name="file" size={15}/><span>{topic.name.replace(/\.[^.]+$/, '')}</span></Tabs.Trigger>
              {/each}
              {#if directFiles.length === 0}<span class="tabs-empty">В этом каталоге нет файлов. Выбери вложенный каталог или воспользуйся поиском.</span>{/if}
            </Tabs.List>
            <div class="content-toolbar">
              <div class="search-wrap"><Icon name="search" size={18}/><input bind:this={searchInput} type="search" bind:value={search} placeholder="Поиск по тексту, заголовкам и тегам…" aria-label="Поиск по сообщениям"/><kbd>/</kbd></div>
              <label class="scope-wrap"><span class="visually-hidden">Область поиска</span><select bind:value={scope} aria-label="Область поиска"><option value="all">Вся библиотека</option><option value="folder">Каталог</option><option value="file">Тематика</option></select></label>
              <button class="icon-button layout-button" type="button" aria-label={layout === 'grid' ? 'Показать списком' : 'Показать сеткой'} title={layout === 'grid' ? 'Список' : 'Сетка'} onclick={toggleLayout}><Icon name={layout === 'grid' ? 'list' : 'grid'} size={19}/></button>
            </div>
            <div class="cards-scroll">
              <div class="results-heading"><div><h2>{isSearching ? 'Результаты поиска' : activeFile?.name.replace(/\.[^.]+$/, '') || 'Нет тематики'}</h2><p>{isSearching ? `По запросу «${search.trim()}»` : activeFile ? 'Нажми на карточку, чтобы скопировать её текст' : 'Выбери тематику в каталоге'}</p></div><span class="results-count">{filtered.length} сообщений</span></div>
              {#if filtered.length}
                <div class="reply-grid" class:list-layout={layout === 'list'}>
                  {#each filtered as item (item.id)}
                    <ReplyCard {item} expanded={expandedCards.has(item.id)} starred={favorites.has(item.id)} copied={copiedId === item.id} showLocation={showingLocation} onCopy={copy} onExpand={toggleCard} onStar={toggleFavorite}/>
                  {/each}
                </div>
              {:else}
                <div class="empty-results"><div class="empty-mark"><Icon name={isSearching ? 'search' : 'file'} size={25}/></div><h3>{isSearching ? 'Ничего не найдено' : 'Здесь пока пусто'}</h3><p>{isSearching ? 'Попробуй другой запрос или измени область поиска.' : 'Выбери каталог с файлами или открой другую рабочую папку.'}</p></div>
              {/if}
            </div>
          </Tabs.Root>
        {:else}
          <div class="content-toolbar">
            <div class="search-wrap"><Icon name="search" size={18}/><input bind:this={searchInput} type="search" bind:value={search} placeholder="Поиск по избранному…" aria-label="Поиск по избранному"/><kbd>/</kbd></div>
            <label class="scope-wrap"><span class="visually-hidden">Область поиска</span><select bind:value={scope}><option value="all">Вся библиотека</option><option value="folder">Каталог</option><option value="file">Тематика</option></select></label>
            <button class="icon-button layout-button" type="button" aria-label="Переключить раскладку" onclick={toggleLayout}><Icon name={layout === 'grid' ? 'list' : 'grid'} size={19}/></button>
          </div>
          <div class="cards-scroll"><div class="results-heading"><div><h2>Избранные ответы</h2><p>Отписки, которые ты отметил звездой</p></div><span class="results-count">{filtered.length} сообщений</span></div>
            {#if filtered.length}<div class="reply-grid" class:list-layout={layout === 'list'}>{#each filtered as item (item.id)}<ReplyCard {item} expanded={expandedCards.has(item.id)} starred={favorites.has(item.id)} copied={copiedId === item.id} showLocation={true} onCopy={copy} onExpand={toggleCard} onStar={toggleFavorite}/>{/each}</div>
            {:else}<div class="empty-results"><div class="empty-mark"><Icon name="star" size={25}/></div><h3>Здесь пока пусто</h3><p>Нажми на звезду рядом с нужной отпиской, чтобы она появилась здесь.</p></div>{/if}
          </div>
        {/if}
      </section>
    </div>
  {/if}
  {#if toast}<div class="toast" role="status" aria-live="polite"><Icon name="info" size={17}/>{toast}</div>{/if}
</div>
<svelte:window onkeydown={(event) => {
  const target = event.target as HTMLElement;
  if (library && event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)) {
    event.preventDefault(); searchInput?.focus();
  }
  if (event.key === 'Escape') sidebarOpen = false;
}}/>