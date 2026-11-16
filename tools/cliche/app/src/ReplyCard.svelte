<script lang="ts">
  import Icon from './Icon.svelte';
  import type { Reply } from './types';

  let {
    item, expanded, starred, copied, showLocation = false,
    onCopy, onExpand, onStar, onTag
  }: {
    item: Reply; expanded: boolean; starred: boolean; copied: boolean;
    showLocation?: boolean;
    onCopy: (item: Reply) => void;
    onExpand: (id: string) => void;
    onStar: (id: string) => void;
    onTag: (tag: string) => void;
  } = $props();

  function keyboardCopy(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCopy(item);
    }
  }
</script>
<article class="reply-card" class:expanded class:copied role="button" tabindex="0"
  aria-label={item.preview + '. Копировать сообщение'}
  onclick={() => onCopy(item)} onkeydown={keyboardCopy}>
  <div class="reply-row">
    <span class="card-symbol"><Icon name={copied ? 'check' : 'copy'} size={15}/></span>
    <span class="reply-preview">{item.preview}</span>
    {#if item.tags.length}
      <div class="tag-strip">
        {#each item.tags as tag (tag)}
          <button class="tag" type="button" aria-label={`Найти по тегу ${tag}`}
            onclick={(event) => { event.stopPropagation(); onTag(tag); }}>#{tag}</button>
        {/each}
      </div>
    {/if}
    <div class="reply-actions">
      <button type="button" class="mini-button star-action" class:starred aria-label={starred ? 'Удалить из избранного' : 'Добавить в избранное'} aria-pressed={starred}
        onclick={(event) => { event.stopPropagation(); onStar(item.id); }}><Icon name="star" size={16} filled={starred}/></button>
      <button type="button" class="mini-button expand-action" aria-label={expanded ? 'Свернуть карточку' : 'Развернуть карточку'} aria-expanded={expanded}
        onclick={(event) => { event.stopPropagation(); onExpand(item.id); }}><Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={16}/></button>
    </div>
  </div>
  {#if expanded}
    <div class="reply-body">{item.body}</div>
    {#if showLocation}<div class="card-location">{item.path}</div>{/if}
  {/if}
</article>