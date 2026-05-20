<script lang="ts">
  import '../app.css';
  import { initCrypto } from '$lib/crypto/init.js';
  import { onMount } from 'svelte';
  import { Stage } from '$lib/components/spatial';

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

<Stage>
  {#if error}
    <div style="min-height: 100vh; display: grid; place-items: center;">
      <p class="sp-alert sp-alert--danger">{error}</p>
    </div>
  {:else if !cryptoReady}
    <div style="min-height: 100vh; display: grid; place-items: center;">
      <p class="sp-mini">Preparing crypto engine…</p>
    </div>
  {:else}
    {@render children()}
  {/if}
</Stage>
