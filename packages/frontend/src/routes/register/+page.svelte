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

<svelte:head><title>Create account · Granith</title></svelte:head>

<AuthShell
  eyebrow="A fresh start"
  title="Your secrets belong here."
  subtitle="Choose a handle and a strong password to create your own private workspace."
>
  {#snippet footer()}
    Already have an account? <a href="/login" style="color: var(--sp-accent);">Sign in →</a>
  {/snippet}

  <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 14px;">
    <Field id="handle" label="Handle" bind:value={handle} autocomplete="username" required />
    <Field
      id="password"
      label="Password"
      type="password"
      bind:value={password}
      autocomplete="new-password"
      required
    />
    <Field
      id="confirm"
      label="Confirm password"
      type="password"
      bind:value={confirmPassword}
      autocomplete="new-password"
      required
    />
    {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}
    <Button type="submit" variant="primary" block disabled={loading || !handle || !password}>
      {loading ? 'Creating account…' : 'Create account →'}
    </Button>
  </form>
</AuthShell>
