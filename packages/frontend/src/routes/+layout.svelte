<script lang="ts">
  import '../app.css';
  import { initCrypto, isReady } from '$lib/crypto/init.js';
  import { onMount } from 'svelte';

  let { children } = $props();
  let cryptoReady = $state(false);
  let error = $state('');

  onMount(async () => {
    try {
      await initCrypto();
      cryptoReady = true;
    } catch (e) {
      error = 'Failed to initialize cryptography engine.';
    }
  });
</script>

{#if error}
  <div class="flex h-screen items-center justify-center">
    <p class="text-danger text-lg">{error}</p>
  </div>
{:else if !cryptoReady}
  <div class="flex h-screen items-center justify-center flex-col gap-3">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
    <p class="text-text-muted text-sm">Preparing crypto engine…</p>
  </div>
{:else}
  {@render children()}
{/if}
