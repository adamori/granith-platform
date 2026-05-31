<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    open?: boolean;
    children: Snippet;
  };

  let { title, open = $bindable(false), children }: Props = $props();
</script>

<div class="sp-collapsible">
  <button type="button" class="sp-collapsible__head" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="sp-collapsible__chev">{open ? '▾' : '▸'}</span>
    <span>{title}</span>
  </button>
  {#if open}
    <div class="sp-collapsible__body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .sp-collapsible {
    border: 1px solid var(--sp-glass-border);
    border-radius: 12px;
    background: var(--sp-glass);
  }
  .sp-collapsible__head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font: 500 12px var(--sp-font);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--sp-text-muted);
  }
  .sp-collapsible__head:hover {
    color: var(--sp-text);
  }
  .sp-collapsible__chev {
    color: var(--sp-accent-dim);
    font-size: 10px;
  }
  .sp-collapsible__body {
    padding: 0 16px 16px;
  }
</style>
