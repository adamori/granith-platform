<script lang="ts">
  import { getToasts, dismissToast } from '$lib/stores/ui.svelte.js';
</script>

{#if getToasts().length > 0}
  <div class="sp-toasts" aria-live="polite">
    {#each getToasts() as t (t.id)}
      <div class="sp-toast sp-toast--{t.tone}" role="status">
        <span>{t.message}</span>
        <button class="sp-toast__close" type="button" aria-label="Dismiss" onclick={() => dismissToast(t.id)}>
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}
