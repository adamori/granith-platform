<script lang="ts">
  import { onMount } from 'svelte';
  import { getUser, getKek } from '$lib/stores/auth.svelte.js';
  import { getProjects, loadProjects } from '$lib/stores/projects.svelte.js';
  import * as authApi from '$lib/api/auth.js';
  import * as opaqueClient from '$lib/crypto/opaque.js';
  import * as s from '$lib/crypto/sodium.js';
  import * as keys from '$lib/crypto/keys.js';
  import { getUsage, type UsageResponse } from '$lib/api/usage.js';
  import { Glass, PageHead, Label, Button, Field } from '$lib/components/spatial';

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let changing = $state(false);
  let error = $state('');
  let success = $state(false);

  let usage = $state<UsageResponse | null>(null);
  let usageError = $state('');

  onMount(async () => {
    await loadProjects();
    try {
      usage = await getUsage();
    } catch (e: any) {
      usageError = e.message || 'Could not load usage';
    }
  });

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) {
      const kb = n / 1024;
      return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1).replace(/\.0$/, '')} KB`;
    }
    const mb = n / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 0 : 1).replace(/\.0$/, '')} MB`;
  }

  const usedPct = $derived(
    usage ? (usage.storage.used_bytes / usage.storage.limit_bytes) * 100 : 0,
  );
  const barPct = $derived(Math.min(100, usedPct));
  const level = $derived(usedPct >= 100 ? 'over' : usedPct >= 80 ? 'warn' : 'ok');
  const meterColor = $derived(
    level === 'over' ? 'var(--sp-danger)' : level === 'warn' ? 'var(--sp-warm)' : 'var(--sp-accent)',
  );

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
    <Label>§ usage</Label>
    {#if usageError}
      <p class="sp-alert sp-alert--danger" style="margin-top: 16px;">{usageError}</p>
    {:else if !usage}
      <p class="sp-mini" style="margin-top: 16px;">Loading usage…</p>
    {:else}
      <div class="usage-storage" style="margin-top: 18px;">
        <div class="usage-storage__head">
          <span class="usage-storage__figure">
            {formatBytes(usage.storage.used_bytes)} of {formatBytes(usage.storage.limit_bytes)}
          </span>
          <span
            class="usage-storage__pct"
            style="color: {level === 'ok' ? 'var(--sp-text-muted)' : meterColor};"
          >
            {Math.round(usedPct)}%
          </span>
        </div>
        <div class="usage-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPct)}>
          <div class="usage-meter__fill" style="width: {barPct}%; background: {meterColor};"></div>
        </div>
        {#if level === 'over'}
          <p class="sp-mini" style="margin-top: 10px; color: var(--sp-danger);">
            ▸ you're at the fair-use cap. new secrets, projects and tokens are blocked until you free space or request a raise.
          </p>
        {:else if level === 'warn'}
          <p class="sp-mini" style="margin-top: 10px; color: var(--sp-warm);">
            ▸ you're close to the fair-use cap. request a raise below whenever you need one.
          </p>
        {/if}
      </div>

      <div class="usage-stats">
        <div class="usage-stat">
          <span class="usage-stat__n">{usage.objects.projects}</span>
          <span class="usage-stat__l">projects</span>
        </div>
        <div class="usage-stat">
          <span class="usage-stat__n">{usage.objects.secrets}</span>
          <span class="usage-stat__l">secrets</span>
        </div>
        <div class="usage-stat">
          <span class="usage-stat__n">{usage.objects.tokens}</span>
          <span class="usage-stat__l">tokens</span>
        </div>
        <div class="usage-stat">
          <span class="usage-stat__n">{usage.objects.notification_services}</span>
          <span class="usage-stat__l">notif. services</span>
        </div>
      </div>

      {#if usage.override_active}
        <p class="sp-mini" style="margin-top: 18px; color: var(--sp-success);">
          ▸ this account has a custom limit — the fair-use cap above was raised for you.
        </p>
      {/if}

      <p class="sp-mono" style="margin-top: 18px; font-size: 12px;">
        Granith is free. The fair-use cap only keeps the server from being used as file storage.
        Need more? Raises are free — tell us what you're building.
      </p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px;">
        <a
          class="sp-btn sp-btn--ghost"
          href={`mailto:${usage.contact.email}?subject=${encodeURIComponent('Granith storage raise')}`}
        >
          email a raise request
        </a>
        <a class="sp-btn sp-btn--bordered" href={usage.contact.telegram} target="_blank" rel="noopener noreferrer">
          telegram  →
        </a>
      </div>
    {/if}
  </Glass>

  <Glass depth={0.3} style="padding: clamp(20px, 3vw, 32px); margin-top: 28px;">
    <Label>§ password</Label>
    <form onsubmit={handleChangePassword} style="display: flex; flex-direction: column; gap: 14px; margin-top: 18px;">
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

<style>
  .usage-storage__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .usage-storage__figure {
    font: 500 14px var(--sp-font);
    color: var(--sp-text);
    letter-spacing: -0.01em;
  }
  .usage-storage__pct {
    font: 500 12px var(--sp-font);
  }
  .usage-meter {
    height: 8px;
    border-radius: 999px;
    background: rgba(4, 5, 10, 0.6);
    border: 1px solid var(--sp-glass-border);
    overflow: hidden;
  }
  .usage-meter__fill {
    height: 100%;
    border-radius: 999px;
    transition: width 400ms ease, background 240ms ease;
  }
  .usage-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-top: 22px;
  }
  .usage-stat {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    background: rgba(4, 5, 10, 0.4);
    border: 1px solid var(--sp-glass-border);
    border-radius: 8px;
  }
  .usage-stat__n {
    font: 500 22px var(--sp-font);
    color: var(--sp-text);
    letter-spacing: -0.02em;
  }
  .usage-stat__l {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sp-text-muted);
  }
  @media (max-width: 560px) {
    .usage-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
