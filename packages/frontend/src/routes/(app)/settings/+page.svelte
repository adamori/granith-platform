<script lang="ts">
  import { onMount } from 'svelte';
  import { getUser, getKek } from '$lib/stores/auth.svelte.js';
  import { getProjects, loadProjects } from '$lib/stores/projects.svelte.js';
  import * as authApi from '$lib/api/auth.js';
  import * as opaqueClient from '$lib/crypto/opaque.js';
  import * as s from '$lib/crypto/sodium.js';
  import * as keys from '$lib/crypto/keys.js';
  import { Glass, PageHead, Label, Button, Field } from '$lib/components/spatial';

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let changing = $state(false);
  let error = $state('');
  let success = $state(false);

  onMount(async () => {
    await loadProjects();
  });

  async function handleChangePassword(e: Event) {
    e.preventDefault();
    error = '';
    success = false;

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

      success = true;
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

<div class="sp-wrap--narrow">
  <PageHead eyebrow="§04 · account" title="Settings">
    <p class="sp-mini" style="margin-top: 4px;">
      changing your password re-derives KEK and re-wraps every project key client-side.
    </p>
  </PageHead>

  <Glass depth={0.3} style="padding: clamp(20px, 3vw, 32px);">
    <form onsubmit={handleChangePassword} style="display: flex; flex-direction: column; gap: 14px;">
      <Field id="cur" label="Current password" type="password" bind:value={currentPassword} autocomplete="current-password" required />
      <Field id="nw" label="New password" type="password" bind:value={newPassword} autocomplete="new-password" required minlength={8} />
      <Field id="conf" label="Confirm new password" type="password" bind:value={confirmPassword} autocomplete="new-password" required />
      {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}
      {#if success}
        <p class="sp-mini" style="color: var(--sp-success);">▸ password updated. running tokens are unaffected.</p>
      {/if}
      <div style="display: flex; gap: 10px;">
        <Button type="submit" disabled={changing || !currentPassword || !newPassword || !confirmPassword}>
          {changing ? 're-wrapping keys…' : 'change password'}
        </Button>
      </div>
    </form>
  </Glass>

  <div style="margin-top: 28px;">
    <Glass depth={0.2} deep style="padding: 20px 24px;">
      <Label>§ what happens</Label>
      <ol class="sp-mono" style="margin: 14px 0 0; padding-left: 20px; line-height: 1.85;">
        <li>old password derives current KEK · all project keys decrypted in-memory</li>
        <li>new password derives new KEK · same project keys re-wrapped</li>
        <li>only the new wrapped blob is sent to the server. plaintext never leaves.</li>
      </ol>
    </Glass>
  </div>
</div>
