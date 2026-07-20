<script lang="ts">
  import { getConfirmRequest, settleConfirm } from '$lib/stores/ui.svelte.js';

  const req = $derived(getConfirmRequest());

  function onKeydown(e: KeyboardEvent) {
    if (!req) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      settleConfirm(false);
    }
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if req}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="sp-modal-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) settleConfirm(false);
    }}
  >
    <div class="sp-modal" role="alertdialog" aria-modal="true" aria-label={req.spec.title}>
      <h2 class="sp-modal__title">{req.spec.title}</h2>
      {#if req.spec.body}
        <p class="sp-modal__body">{req.spec.body}</p>
      {/if}
      {#if req.spec.consequences?.length}
        <ul class="sp-modal__list">
          {#each req.spec.consequences as c (c)}
            <li>{c}</li>
          {/each}
        </ul>
      {/if}
      <div class="sp-modal__actions">
        <button class="sp-btn sp-btn--link" type="button" onclick={() => settleConfirm(false)}>
          {req.spec.cancelLabel ?? 'cancel'}
        </button>
        <button
          class="sp-btn {req.spec.danger ? 'sp-btn--danger' : 'sp-btn--primary'}"
          type="button"
          use:focusOnMount
          onclick={() => settleConfirm(true)}
        >
          {req.spec.confirmLabel ?? 'confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}
