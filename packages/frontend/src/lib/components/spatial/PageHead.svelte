<script lang="ts">
  import type { Snippet } from 'svelte';
  import Label from './Label.svelte';

  type Props = {
    title: string;
    eyebrow?: string;
    back?: string;
    backHref?: string;
    onBack?: () => void;
    actions?: Snippet;
    children?: Snippet;
  };

  let { title, eyebrow, back, backHref, onBack, actions, children }: Props = $props();
</script>

<div class="sp-pagehead">
  <div class="sp-pagehead__title">
    {#if back}
      {#if backHref}
        <a class="sp-pagehead__back" href={backHref}>← {back}</a>
      {:else}
        <button class="sp-pagehead__back" type="button" onclick={onBack}>← {back}</button>
      {/if}
    {:else if eyebrow}
      <Label accent>{eyebrow}</Label>
    {/if}
    <h1 class="sp-h1" style="font-size: clamp(28px, 3.6vw, 44px);">{title}</h1>
    {#if children}{@render children()}{/if}
  </div>
  {#if actions}
    <div class="sp-pagehead__actions">{@render actions()}</div>
  {/if}
</div>
