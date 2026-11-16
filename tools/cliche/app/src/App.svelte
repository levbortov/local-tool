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
  let sidebarWidth = $state(272);
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
    const savedWidth = Number(readStored('sidebarWidth', 272));
    sidebarWidth = Number.isFinite(savedWidth) ? Math.min(480, Math.max(190, savedWidth)) : 272;
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
  function revealSidebar() { sidebarCollapsed = false; sidebarOpen = true; }
  function hideSidebar() { sidebarOpen = false; sidebarCollapsed = true; }
  function resizeSidebar(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const originalX = event.clientX;
    const originalWidth = sidebarWidth;
    document.documentElement.classList.add('resizing-sidebar');
    const move = (e: PointerEvent) => { sidebarWidth = Math.min(480, Math.max(190, originalWidth + e.clientX - originalX)); };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.documentElement.classList.remove('resizing-sidebar');
      store('sidebarWidth', sidebarWidth);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }
  function resizeSidebarWithKeyboard(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    sidebarWidth = Math.min(480, Math.max(190, sidebarWidth + (event.key === 'ArrowRight' ? 12 : -12)));
    store('sidebarWidth', sidebarWidth);
  }
  function navigateTag(tag: string) { search = '#' + tag; scope = 'all'; showFavorites = false; sidebarOpen = false; }
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
      if (incoming.skipped.length) notify(`Пропущено файлов: ${incoming.skipped.length}`);
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
<div class="app-shell" class:sidebar-collapsed={sidebarCollapsed} style={`--sidebar-width:${sidebarWidth}px`}>
  {#if !library}
    <main class="welcome-panel">
      <div class="welcome-icon"><Icon name="spark" size={25}/></div>
      <h1>Клише</h1>
      <button class="primary-button" type="button" disabled={loading} onclick={pickFolder}><Icon name="folder-open" size={18}/>{loading ? 'Загрузка…' : 'Выбрать папку'}</button>
    </main>
  {:else}
    <div class="workspace">
      {#if sidebarOpen}<button class="mobile-scrim" type="button" aria-label="Закрыть панель каталогов" onclick={() => sidebarOpen = false}></button>{/if}
      <aside class="sidebar" class:sidebar-open={sidebarOpen} aria-label="Каталоги библиотеки">
        <div class="sidebar-tools">
          <button class="icon-button" type="button" aria-label="Скрыть панель каталогов" onclick={hideSidebar}><Icon name="panel" size={18}/></button>
          <div class="tools-spacer"></div>
          <button class="icon-button" class:active={showFavorites} type="button" aria-label="Избранное" aria-pressed={showFavorites} onclick={() => {showFavorites = !showFavorites; sidebarOpen = false;}}><Icon name="star" size={18} filled={showFavorites}/></button>
          <button class="icon-button" type="button" aria-label="Сменить тему" onclick={toggleTheme}><Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'settings'} size={18}/></button>
          <button class="icon-button" type="button" aria-label="Сменить вид карточек" onclick={toggleLayout}><Icon name={layout === 'grid' ? 'list' : 'grid'} size={18}/></button>
        </div>
        <nav class="directory-tree" aria-label="Каталоги">
          {#each visibleFolders as folder (folder)}
            <div class="folder-row" class:selected={selectedFolder === folder && !showFavorites} class:root-row={!folder} style={`padding-left: ${8 + folder.split('/').filter(Boolean).length * 14}px`}>
              {#if hasChildren(folder)}
                <button class="folder-expand" type="button" aria-label={expandedFolders.has(folder) ? 'Свернуть каталог' : 'Развернуть каталог'} aria-expanded={expandedFolders.has(folder)} onclick={() => toggleFolder(folder)}><Icon name={expandedFolders.has(folder) ? 'chevron-down' : 'chevron-right'} size={15}/></button>
              {:else}<span class="folder-spacer"></span>{/if}
              <button class="folder-label" type="button" onclick={() => chooseFolder(folder)} aria-current={selectedFolder === folder && !showFavorites ? 'page' : undefined}><span>{folder ? folder.split('/').at(-1) : library.folderName}</span></button>
              {#if !folder}
                <button class="folder-action" type="button" disabled={loading} aria-label="Обновить папку: выбрать её повторно" onclick={pickFolder}><Icon name="refresh" size={15}/></button>
                <button class="folder-action" type="button" disabled={loading} aria-label="Выбрать другую рабочую папку" onclick={pickFolder}><Icon name="folder-open" size={15}/></button>
              {/if}
            </div>
          {/each}
        </nav>
      </aside>
      <div class="sidebar-resizer" role="separator" aria-label="Ширина панели каталогов" aria-orientation="vertical" aria-valuemin="190" aria-valuemax="480" aria-valuenow={sidebarWidth} tabindex="0" onpointerdown={resizeSidebar} onkeydown={resizeSidebarWithKeyboard}></div>
      <section class="main-panel" aria-label="Сообщения">
        <Tabs.Root bind:value={selectedFile} class="tab-root">
          <div class="tabs-shell">
            <button class="icon-button sidebar-reveal" type="button" aria-label="Показать панель каталогов" onclick={revealSidebar}><Icon name="panel" size={18}/></button>
            <Tabs.List class="topic-tabs" aria-label="Тематики">
              {#if showFavorites}
                <div class="topic-tab is-current"><Icon name="star" size={15} filled={true}/><span>Избранное</span></div>
              {:else}
                {#each directFiles as topic (topic.path)}
                  <Tabs.Trigger value={topic.path} class="topic-tab"><span>{topic.name.replace(/\.[^.]+$/, '')}</span></Tabs.Trigger>
                {/each}
              {/if}
            </Tabs.List>
          </div>
          <div class="content-toolbar">
            <div class="search-wrap"><Icon name="search" size={17}/><input bind:this={searchInput} type="search" bind:value={search} placeholder="Поиск" aria-label="Поиск по сообщениям"/></div>
            <select class="scope-select" bind:value={scope} aria-label="Область поиска">
              <option value="all">Везде</option>
              <option value="folder">Каталог</option>
              <option value="file">Файл</option>
            </select>
          </div>
          <div class="cards-scroll">
            {#if filtered.length}
              <div class="reply-grid" class:list-layout={layout === 'list'}>
                {#each filtered as item (item.id)}
                  <ReplyCard {item} expanded={expandedCards.has(item.id)} starred={favorites.has(item.id)} copied={copiedId === item.id} showLocation={showingLocation} onCopy={copy} onExpand={toggleCard} onStar={toggleFavorite} onTag={navigateTag}/>
                {/each}
              </div>
            {:else}
              <div class="empty-results">{isSearching ? 'Нет совпадений' : showFavorites ? 'Нет избранных' : 'Нет сообщений'}</div>
            {/if}
          </div>
          <footer class="main-meta"><span>{filtered.length} / {library.total}</span><span>{library.files.length} файлов</span></footer>
        </Tabs.Root>
      </section>
    </div>
  {/if}
  {#if toast}<div class="toast" role="status" aria-live="polite">{toast}</div>{/if}
</div>
<svelte:window onkeydown={(event) => {
  const target = event.target as HTMLElement;
  if (library && event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)) {
    event.preventDefault(); searchInput?.focus();
  }
  if (event.key === 'Escape') sidebarOpen = false;
}}/>