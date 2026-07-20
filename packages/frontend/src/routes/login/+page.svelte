<script lang="ts">
  import { goto } from '$app/navigation';
  import { login } from '$lib/stores/auth.svelte.js';
  import { deriveKeys } from '$lib/crypto/sodium.js';
  import { AuthShell, Field, Button } from '$lib/components/spatial';

  let handle = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
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

<AuthShell
  eyebrow="§01 · sign in"
  title="Unlock the vault."
  subtitle="Your password derives the key that unwraps your project keys. The server never sees it."
>
  {#snippet footer()}
    need an account? <a href="/register" style="color: var(--sp-accent);">register →</a>
  {/snippet}

  <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 14px;">
    <Field id="handle" label="Handle" bind:value={handle} autocomplete="username" required />
    <Field id="password" label="Password" type="password" bind:value={password} autocomplete="current-password" required />
    {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}
    <Button type="submit" variant="primary" block disabled={loading || !handle || !password}>
      {loading ? 'Authenticating…' : 'log in  →'}
    </Button>
  </form>
</AuthShell>
