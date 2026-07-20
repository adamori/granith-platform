<script lang="ts">
  import { goto } from '$app/navigation';
  import { register } from '$lib/stores/auth.svelte.js';
  import { deriveKeys } from '$lib/crypto/sodium.js';
  import { AuthShell, Field, Button } from '$lib/components/spatial';

  let handle = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    loading = true;
    try {
      const salt = new TextEncoder().encode(handle.padEnd(16, '\0')).slice(0, 16);
      const { kek } = deriveKeys(password, salt);
      await register(handle, password, kek);
      goto('/projects');
    } catch (e: any) {
      error = e.message || 'Registration failed';
    } finally {
      loading = false;
    }
  }
</script>

<AuthShell
  eyebrow="§01 · create account"
  title="Create an account"
  subtitle="Pick a handle and a strong passphrase. Both live in your head — never on our server."
>
  {#snippet footer()}
    already registered? <a href="/login" style="color: var(--sp-accent);">log in →</a>
  {/snippet}

  <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 14px;">
    <Field id="handle" label="Handle" bind:value={handle} autocomplete="username" required />
    <Field id="password" label="Password" type="password" bind:value={password} autocomplete="new-password" required />
    <Field id="confirm" label="Confirm password" type="password" bind:value={confirmPassword} autocomplete="new-password" required />
    {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}
    <Button type="submit" variant="primary" block disabled={loading || !handle || !password}>
      {loading ? 'Creating account…' : 'register  →'}
    </Button>
  </form>
</AuthShell>
