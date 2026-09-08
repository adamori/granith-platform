<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let { title, hint, children }: { title: string; hint?: string; children?: Snippet } = $props();
</script>

<div class="sp-empty">
  <span class="sp-empty__icon"><Icon name="projects" size={25} /></span>
  <div>{title}</div>
  {#if hint}<div class="sp-empty__hint">{hint}</div>{/if}
  {#if children}<div class="sp-empty__action">{@render children()}</div>{/if}
</div>
