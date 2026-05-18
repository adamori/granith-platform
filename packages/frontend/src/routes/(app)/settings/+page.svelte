<script lang="ts">
  import { goto } from '$app/navigation';
  import { getUser, getKek } from '$lib/stores/auth.svelte.js';
  import { getProjects, loadProjects } from '$lib/stores/projects.svelte.js';
  import * as authApi from '$lib/api/auth.js';
  import * as opaqueClient from '$lib/crypto/opaque.js';
  import * as s from '$lib/crypto/sodium.js';
  import * as keys from '$lib/crypto/keys.js';
  import { onMount } from 'svelte';

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let changing = $state(false);
  let error = $state('');
  let success = $state('');

  onMount(async () => {
    await loadProjects();
  });

  async function handleChangePassword(e: Event) {
    e.preventDefault();
    error = '';
    success = '';

    if (newPassword !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    if (newPassword.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    const user = getUser();
    const oldKek = getKek();
    if (!user || !oldKek) {
      error = 'Not authenticated';
      return;
    }

    changing = true;
    try {
      const salt = new TextEncoder().encode(user.handle.padEnd(16, '\0')).slice(0, 16);
      const { kek: newKek } = s.deriveKeys(newPassword, salt);

      const { clientRegistrationState, registrationRequest } = opaqueClient.startRegistration(newPassword);
      const { registrationResponse } = await authApi.changePasswordStart(registrationRequest);
      const { registrationRecord } = opaqueClient.finishRegistration({
        clientRegistrationState,
        registrationResponse,
        password: newPassword,
      });

      const projects = getProjects();
      const rewrapped_pdks = projects.map((p) => {
        const { wrapped, nonce } = keys.wrapPDKForUser(p.pdk, newKek);
        return {
          project_id: p.id,
          wrapped_pdk_for_user: s.toBase64Standard(wrapped),
          wrap_nonce_for_user: s.toBase64Standard(nonce),
        };
      });

      await authApi.changePasswordFinish({
        registrationRecord,
        kdf_params: {
          algorithm: 'argon2id',
          time_cost: 3,
          memory_cost: 65536,
          parallelism: 1,
          salt_length: 16,
        },
        rewrapped_pdks,
      });

      success = 'Password changed. You will need to re-login on other devices.';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (e: any) {
      error = e.message || 'Password change failed';
    } finally {
      changing = false;
    }
  }
</script>

<div class="space-y-8 max-w-md">
  <h1 class="text-xl font-bold">Settings</h1>

  <section class="space-y-4">
    <h2 class="text-lg font-semibold">Change Password</h2>
    <p class="text-sm text-text-muted">This re-derives your KEK and re-wraps all project keys. Existing tokens are unaffected.</p>

    <form onsubmit={handleChangePassword} class="space-y-3">
      <div>
        <label for="current-pw" class="block text-sm text-text-muted mb-1">Current Password</label>
        <input
          id="current-pw"
          type="password"
          bind:value={currentPassword}
          required
          autocomplete="current-password"
          class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text focus:border-border-focus focus:outline-none"
        />
      </div>
      <div>
        <label for="new-pw" class="block text-sm text-text-muted mb-1">New Password</label>
        <input
          id="new-pw"
          type="password"
          bind:value={newPassword}
          required
          minlength="8"
          autocomplete="new-password"
          class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text focus:border-border-focus focus:outline-none"
        />
      </div>
      <div>
        <label for="confirm-pw" class="block text-sm text-text-muted mb-1">Confirm New Password</label>
        <input
          id="confirm-pw"
          type="password"
          bind:value={confirmPassword}
          required
          autocomplete="new-password"
          class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text focus:border-border-focus focus:outline-none"
        />
      </div>

      {#if error}
        <p class="text-danger text-sm">{error}</p>
      {/if}
      {#if success}
        <p class="text-success text-sm">{success}</p>
      {/if}

      <button
        type="submit"
        disabled={changing || !currentPassword || !newPassword || !confirmPassword}
        class="rounded-md bg-primary px-4 py-2 text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
      >
        {changing ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  </section>
</div>
