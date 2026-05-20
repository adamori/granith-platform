<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'primary' | 'ghost' | 'bordered' | 'danger' | 'link' | 'link-danger';

  type Props = {
    children: Snippet;
    variant?: Variant;
    block?: boolean;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    class?: string;
    style?: string;
    href?: string;
  };

  let {
    children,
    variant = 'primary',
    block = false,
    type = 'button',
    disabled = false,
    onclick,
    class: cls = '',
    style = '',
    href,
  }: Props = $props();

  const classes = $derived(`sp-btn sp-btn--${variant}${block ? ' sp-btn--block' : ''} ${cls}`);
</script>

{#if href}
  <a {href} class={classes} {style} role="button" tabindex={disabled ? -1 : 0} aria-disabled={disabled}>
    {@render children()}
  </a>
{:else}
  <button {type} class={classes} {style} {disabled} {onclick}>
    {@render children()}
  </button>
{/if}
