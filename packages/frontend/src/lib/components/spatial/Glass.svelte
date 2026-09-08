<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    class: cls = '',
    style = '',
  }: {
    children: Snippet;
    class?: string;
    style?: string;
  } = $props();
</script>

<div class="glass {cls}" {style}>
  {@render children()}
</div>
