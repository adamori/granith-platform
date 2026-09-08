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

<svelte:head><title>Sign in · Granith</title></svelte:head>

<AuthShell
  eyebrow="Welcome back"
  title="Make yourself at home."
  subtitle="Sign in to your private workspace. Your projects and secrets are right where you left them."
>
  {#snippet footer()}
    New to Granith? <a href="/register" style="color: var(--sp-accent);">Create an account →</a>
  {/snippet}

  <form onsubmit={handleSubmit} style="display: flex; flex-direction: column; gap: 14px;">
    <Field id="handle" label="Handle" bind:value={handle} autocomplete="username" required />
    <Field
      id="password"
      label="Password"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      required
    />
    {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}
    <Button type="submit" variant="primary" block disabled={loading || !handle || !password}>
      {loading ? 'Authenticating…' : 'Sign in →'}
    </Button>
  </form>
</AuthShell>
