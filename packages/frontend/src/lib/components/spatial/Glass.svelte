<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    deep?: boolean;
    accent?: boolean;
    depth?: number;
    class?: string;
    style?: string;
  };

  let { children, deep = false, accent = false, depth = 0, class: cls = '', style = '' }: Props = $props();

  const classes = $derived(
    ['glass', deep && 'glass--deep', accent && 'glass--accent', depth ? 'sp-parallax' : '', cls]
      .filter(Boolean)
      .join(' ')
  );
  const inlineStyle = $derived(depth ? `--depth: ${depth}; ${style}` : style);
</script>

<div class={classes} style={inlineStyle}>
  {@render children()}
</div>
