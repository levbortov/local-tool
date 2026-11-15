<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Reply } from './types';

  let {
    item, expanded, starred, copied, showLocation = false,
    onCopy, onExpand, onStar
  }: {
    item: Reply; expanded: boolean; starred: boolean; copied: boolean;
    showLocation?: boolean;
    onCopy: (item: Reply) => void;
    onExpand: (id: string) => void;
    onStar: (id: string) => void;
  } = $props();
</script>
<article class:expanded class:copied class="reply-card">
  <div class="reply-row">
    <button type="button" class="reply-copy-target" onclick={() => onCopy(item)} title="Скопировать текст сообщения">
      <span class="card-symbol"><Icon name={copied ? 'check' : 'copy'} size={16}/></span>
      <span class="reply-preview">{item.preview}</span>
      {#if copied}<span class="copy-label">Скопировано</span>{/if}
    </button>
    <div class="reply-actions">
      <button type="button" class:starred class="mini-button star-action" aria-label={starred ? 'Удалить из избранного' : 'Добавить в избранное'} aria-pressed={starred} title={starred ? 'Убрать из избранного' : 'В избранное'} onclick={() => onStar(item.id)}>
        <Icon name="star" size={17} filled={starred}/>
      </button>
      <button type="button" class="mini-button expand-action" aria-label={expanded ? 'Свернуть карточку' : 'Развернуть карточку'} aria-expanded={expanded} title={expanded ? 'Свернуть' : 'Развернуть'} onclick={() => onExpand(item.id)}>
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={17}/>
      </button>
    </div>
  </div>
  {#if expanded}
    <button type="button" class="reply-body" title="Скопировать сообщение целиком" onclick={() => onCopy(item)}>{item.body}</button>
    {#if item.tags.length || showLocation}
      <div class="reply-footer">
        {#each item.tags as tag (tag)}<span class="tag">#{tag}</span>{/each}
        {#if showLocation}<span class="card-location">{item.path}</span>{/if}
      </div>
    {/if}
  {:else if showLocation}
    <div class="collapsed-location">{item.path}</div>
  {/if}
</article>