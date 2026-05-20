<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkSession, isAuthenticated, getUser, getKek, logout, unlock } from '$lib/stores/auth.svelte.js';
  import { AppShell, AuthShell, Field, Button } from '$lib/components/spatial';

  let { children } = $props();
  let ready = $state(false);
  let needsUnlock = $state(false);
  let password = $state('');
  let unlocking = $state(false);
  let error = $state('');

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-authed', ready ? '1' : '0');
    }
  });

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
  <AuthShell
    eyebrow="§01 · session active"
    title="Unlock vault."
    subtitle="Session is alive — enter your password to re-derive the KEK and unwrap project keys in memory."
  >
    <form onsubmit={handleUnlock} style="display: flex; flex-direction: column; gap: 14px;">
      <Field id="unlock-pw" label="Password" type="password" bind:value={password} autocomplete="current-password" required />
      {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}
      <Button type="submit" variant="primary" block disabled={unlocking || !password}>
        {unlocking ? 'Unlocking…' : 'unlock  →'}
      </Button>
      <button type="button" class="sp-btn sp-btn--link-danger" style="margin-top: 4px;" onclick={handleLogout}>
        log out instead
      </button>
    </form>
  </AuthShell>
{:else if !ready}
  <div style="min-height: 100vh; display: grid; place-items: center;">
    <p class="sp-mini">Loading…</p>
  </div>
{:else}
  <AppShell handle={getUser()?.handle ?? ''} onLogout={handleLogout}>
    {@render children()}
  </AppShell>
{/if}
