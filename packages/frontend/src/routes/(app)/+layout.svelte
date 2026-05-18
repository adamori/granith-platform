<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkSession, isAuthenticated, getUser, getKek, logout, unlock } from '$lib/stores/auth.svelte.js';
  import CryptoBackground from '$lib/components/CryptoBackground.svelte';

  let { children } = $props();
  let ready = $state(false);
  let needsUnlock = $state(false);
  let password = $state('');
  let unlocking = $state(false);
  let error = $state('');

  onMount(async () => {
    if (!isAuthenticated()) {
      const ok = await checkSession();
      if (!ok) {
        goto('/login');
        return;
      }
    }
    if (!getKek()) {
      needsUnlock = true;
    } else {
      ready = true;
    }
  });

  async function handleUnlock(e: Event) {
    e.preventDefault();
    error = '';
    unlocking = true;
    try {
      await unlock(password);
      needsUnlock = false;
      ready = true;
    } catch (e: any) {
      error = e.message || 'Unlock failed';
    } finally {
      unlocking = false;
    }
  }

  async function handleLogout() {
    await logout();
    goto('/login');
  }
</script>

{#if needsUnlock}
  <CryptoBackground />
  <div class="relative z-10 flex min-h-screen items-center justify-center p-4">
    <div class="fancy-card w-full max-w-sm space-y-6 bg-surface/70 p-6 backdrop-blur-md">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-text tracking-wide">granith</h1>
        <p class="text-text-muted text-sm mt-1">Session active — enter password to unlock vault</p>
      </div>
      <form onsubmit={handleUnlock} class="space-y-4">
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
          disabled={unlocking || !password}
          class="w-full rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {unlocking ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
      <button
        onclick={handleLogout}
        class="w-full text-center text-sm text-text-muted hover:text-danger transition-colors"
      >
        Log out instead
      </button>
    </div>
  </div>
{:else if !ready}
  <div class="flex h-screen items-center justify-center">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
  </div>
{:else}
  <div class="min-h-screen">
    <header class="border-b border-border px-6 py-3 flex items-center justify-between">
      <a href="/projects" class="text-lg font-bold text-text hover:text-primary-hover transition-colors">granith</a>
      <div class="flex items-center gap-4">
        <span class="text-sm text-text-muted">{getUser()?.handle}</span>
        <a href="/settings" class="text-sm text-text-muted hover:text-primary transition-colors">Settings</a>
        <button
          onclick={handleLogout}
          class="text-sm text-text-muted hover:text-danger transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
    <main class="p-6 max-w-5xl mx-auto">
      {@render children()}
    </main>
  </div>
{/if}
