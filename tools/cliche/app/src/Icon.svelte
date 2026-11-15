<script lang="ts">
  let {name, size = 18, filled = false}: {name:string;size?:number;filled?:boolean} = $props();
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon">
  {#if name === 'folder'}<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10H3z"/>
  {:else if name === 'folder-open'}<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3"/><path d="M3 11h17l-3 9H6z"/>
  {:else if name === 'chevron-right'}<path d="m9 18 6-6-6-6"/>
  {:else if name === 'chevron-down'}<path d="m6 9 6 6 6-6"/>
  {:else if name === 'star'}<path d="m12 2.5 3.1 6.35 7 .96-5.05 4.9 1.22 6.97L12 18.35l-6.27 3.33 1.22-6.97-5.05-4.9 7-.96z"/>
  {:else if name === 'search'}<circle cx="10.8" cy="10.8" r="7"/><path d="m16 16 5 5"/>
  {:else if name === 'panel'}<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>
  {:else if name === 'list'}<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>
  {:else if name === 'grid'}<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
  {:else if name === 'moon'}<path d="M20 16a8 8 0 0 1-12-12 8 8 0 1 0 12 12"/>
  {:else if name === 'sun'}<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
  {:else if name === 'upload'}<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>
  {:else if name === 'copy'}<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
  {:else if name === 'check'}<path d="m4.5 12 5 5 10-11"/>
  {:else if name === 'x'}<path d="M5 5 19 19M19 5 5 19"/>
  {:else if name === 'file'}<path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V11z"/><path d="M13 3v8h8M7 15h10M7 18h7"/>
  {:else if name === 'spark'}<path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6z"/><path d="m19 18 .6 1.4L21 20l-1.4.6L19 22l-.6-1.4L17 20l1.4-.6z"/>
  {:else if name === 'info'}<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>
  {:else if name === 'settings'}<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M2 12h2m16 0h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>
  {/if}
</svg>