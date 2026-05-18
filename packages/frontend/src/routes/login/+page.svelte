<script lang="ts">
  import { goto } from '$app/navigation';
  import { login } from '$lib/stores/auth.svelte.js';
  import { deriveKeys, randomBytes } from '$lib/crypto/sodium.js';
  import CryptoBackground from '$lib/components/CryptoBackground.svelte';

  let handle = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      // For login, we derive KEK from password+handle (handle as salt stand-in until we fetch kdf_params)
      // In a full impl we'd fetch salt from server; for now hash handle as salt
      const salt = new TextEncoder().encode(handle.padEnd(16, '\0')).slice(0, 16);
      const { kek } = deriveKeys(password, salt);
      await login(handle, password, kek);
      goto('/projects');
    } catch (e: any) {
      error = e.message || 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<CryptoBackground />

<div class="relative z-10 flex min-h-screen items-center justify-center p-4">
  <div class="fancy-card w-full max-w-sm space-y-6 bg-surface/70 p-6 backdrop-blur-md">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-text tracking-wide">granith</h1>
      <p class="text-text-muted text-sm mt-1">Zero-knowledge secrets manager</p>
    </div>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="handle" class="block text-sm text-text-muted mb-1">Handle</label>
        <div class="chevrons chevrons--on-focus chevrons--sm">
          <input
            id="handle"
            type="text"
            bind:value={handle}
            required
            autocomplete="username"
            class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label for="password" class="block text-sm text-text-muted mb-1">Password</label>
        <div class="chevrons chevrons--on-focus chevrons--sm">
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            autocomplete="current-password"
            class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
          />
        </div>
      </div>

      {#if error}
        <p class="text-danger text-sm">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={loading || !handle || !password}
        class="w-full rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Authenticating…' : 'Log in'}
      </button>
    </form>

    <p class="text-center text-sm text-text-muted">
      Have an invite? <a href="/register" class="text-primary hover:text-primary-hover">Register</a>
    </p>
  </div>
</div>
