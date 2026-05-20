<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    accent?: boolean;
    class?: string;
    style?: string;
  };

  let { children, accent = false, class: cls = '', style = '' }: Props = $props();
</script>

<div class={`sp-label ${cls}`} {style}>
  {#if accent}<span class="sp-label__dot"></span>{/if}
  {@render children()}
</div>
