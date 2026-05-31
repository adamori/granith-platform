<script lang="ts">
  import { onMount } from 'svelte';
  import { getProjects, getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import { getServices, loadServices, addService, editService, removeService } from '$lib/stores/notifications.svelte.js';
  import { listDeliveries } from '$lib/api/notifications.js';
  import type { NotificationService, NotificationDriver, ThrottleMode, DeliveryEntry } from '$lib/api/notifications.js';
  import { ApiError } from '$lib/api/client.js';
  import { Glass, PageHead, Button, Field, Empty, Collapsible } from '$lib/components/spatial';

  let loading = $state(true);
  let deliveries = $state<DeliveryEntry[]>([]);

  // form state
  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let driver = $state<NotificationDriver>('telegram');
  let label = $state('');
  let tgBotToken = $state('');
  let tgChatId = $state('');
  let poAppToken = $state('');
  let poUserKey = $state('');
  let watchAll = $state(false);
  let watchProjects = $state<string[]>([]);
  let trigBundle = $state(true);
  let trigDashboard = $state(false);
  let throttleMode = $state<ThrottleMode>('cooldown');
  let cooldownMinutes = $state(15);
  let newSourceMinutes = $state(60);
  let saving = $state(false);
  let error = $state('');

  const services = $derived(getServices());
  const projects = $derived(getProjects());
  const activeCount = $derived(services.filter((s) => s.state === 'enabled' || s.state === 'probation').length);

  onMount(async () => {
    await loadProjects();
    await loadServices();
    await reloadDeliveries();
    loading = false;
  });

  async function reloadDeliveries() {
    try {
      const { entries } = await listDeliveries({ limit: 50 });
      deliveries = entries;
    } catch {
      /* non-critical */
    }
  }

  function projectName(id: string | null): string {
    if (!id) return 'unknown project';
    return getProjectById(id)?.name ?? id.slice(0, 8);
  }

  function resetForm() {
    editingId = null;
    driver = 'telegram';
    label = '';
    tgBotToken = tgChatId = poAppToken = poUserKey = '';
    watchAll = false;
    watchProjects = [];
    trigBundle = true;
    trigDashboard = false;
    throttleMode = 'cooldown';
    cooldownMinutes = 15;
    newSourceMinutes = 60;
    error = '';
  }

  function openAdd() {
    resetForm();
    showForm = true;
  }

  function openEdit(s: NotificationService) {
    resetForm();
    editingId = s.id;
    driver = s.driver;
    label = s.label ?? '';
    watchAll = s.watch_all_projects;
    watchProjects = [...s.project_ids];
    trigBundle = s.triggers.bundle_pull;
    trigDashboard = s.triggers.dashboard_read;
    throttleMode = s.throttle.mode;
    cooldownMinutes = s.throttle.cooldown_minutes ?? 15;
    newSourceMinutes = s.throttle.new_source_window_minutes ?? 60;
    showForm = true;
  }

  function toggleProject(id: string) {
    watchProjects = watchProjects.includes(id)
      ? watchProjects.filter((p) => p !== id)
      : [...watchProjects, id];
  }

  function buildCredential(): Record<string, string> | null {
    if (driver === 'telegram') {
      if (!tgBotToken.trim() || !tgChatId.trim()) return null;
      return { bot_token: tgBotToken.trim(), chat_id: tgChatId.trim() };
    }
    if (!poAppToken.trim() || !poUserKey.trim()) return null;
    return { app_token: poAppToken.trim(), user_key: poUserKey.trim() };
  }

  function credentialPartlyFilled(): boolean {
    return driver === 'telegram'
      ? !!(tgBotToken.trim() || tgChatId.trim())
      : !!(poAppToken.trim() || poUserKey.trim());
  }

  async function handleSave() {
    error = '';
    if (!watchAll && watchProjects.length === 0) {
      error = 'Select at least one project to watch, or enable all projects.';
      return;
    }
    if (!trigBundle && !trigDashboard) {
      error = 'Enable at least one trigger.';
      return;
    }
    const throttle = {
      mode: throttleMode,
      ...(throttleMode === 'cooldown' ? { cooldown_minutes: Number(cooldownMinutes) } : {}),
      ...(throttleMode === 'new_source_only' ? { new_source_window_minutes: Number(newSourceMinutes) } : {}),
    };
    const triggers = { bundle_pull: trigBundle, dashboard_read: trigDashboard };

    saving = true;
    try {
      if (editingId) {
        const body: Parameters<typeof editService>[1] = {
          label: label.trim() || null,
          watch_all_projects: watchAll,
          project_ids: watchProjects,
          triggers,
          throttle,
        };
        if (credentialPartlyFilled()) {
          const cred = buildCredential();
          if (!cred) {
            error = 'Fill in both credential fields, or leave both blank to keep the current one.';
            saving = false;
            return;
          }
          body.credential = cred;
        }
        await editService(editingId, body);
      } else {
        const cred = buildCredential();
        if (!cred) {
          error = 'Fill in both credential fields.';
          saving = false;
          return;
        }
        await addService({
          driver,
          credential: cred,
          label: label.trim() || null,
          watch_all_projects: watchAll,
          project_ids: watchProjects,
          triggers,
          throttle,
        });
      }
      showForm = false;
      resetForm();
    } catch (e) {
      error = e instanceof ApiError ? e.message : 'Failed to save.';
    } finally {
      saving = false;
    }
  }

  async function handleReenable(s: NotificationService) {
    await editService(s.id, { state: 'enabled' });
  }

  async function handleDelete(s: NotificationService) {
    if (!confirm('Delete this notification service?')) return;
    await removeService(s.id);
  }

  function statusBadge(s: NotificationService): { text: string; tone: 'ok' | 'warn' | 'danger' } {
    switch (s.state) {
      case 'enabled':
        return { text: 'active', tone: 'ok' };
      case 'probation':
        return { text: 'retrying', tone: 'warn' };
      case 'disabled': {
        const when = s.disabled_until ? new Date(s.disabled_until).toLocaleString() : 'soon';
        return { text: `auto-disabled · retry ${when}`, tone: 'warn' };
      }
      case 'permanently_disabled':
        return { text: 'disabled — fix & re-enable', tone: 'danger' };
    }
  }

  function watchSummary(s: NotificationService): string {
    if (s.watch_all_projects) return 'all projects';
    if (s.project_ids.length === 0) return 'no projects';
    return s.project_ids.map(projectName).join(', ');
  }

  function triggerSummary(s: NotificationService): string {
    const t: string[] = [];
    if (s.triggers.bundle_pull) t.push('bundle pull');
    if (s.triggers.dashboard_read) t.push('dashboard reads');
    return t.join(' + ') || 'none';
  }

  function throttleSummary(s: NotificationService): string {
    if (s.throttle.mode === 'every') return 'every fetch';
    if (s.throttle.mode === 'cooldown') return `cooldown ${s.throttle.cooldown_minutes ?? 15}m`;
    return `new source / ${s.throttle.new_source_window_minutes ?? 60}m`;
  }

  const statusColor = { ok: 'var(--sp-accent)', warn: '#d9a441', danger: 'var(--sp-danger)' } as const;
</script>

<PageHead title="Notifications">
  {#snippet actions()}
    <Button onclick={openAdd}>+ add service</Button>
  {/snippet}
  <p class="sp-mini" style="margin-top: 4px;">
    {activeCount} active · get pinged when your project secrets are fetched
  </p>
</PageHead>

<div style="margin-bottom: 18px;">
  <Collapsible title="▸ before you add a service — read this">
    <ul class="sp-mini" style="margin: 0; padding-left: 18px; line-height: 1.6;">
      <li>Use a token scoped to Granith only. Don't reuse the same Telegram bot or Pushover app token across other apps.</li>
      <li>
        These tokens are encrypted <strong>server-side</strong>, not end-to-end like your secrets — Granith can read
        them at send time. A broadly-scoped token is dangerous if leaked, so create a dedicated bot/app for Granith.
      </li>
    </ul>
  </Collapsible>
</div>

{#if showForm}
  <Glass depth={0.3} style="padding: 22px; margin-bottom: 18px;">
    <div class="sp-stack--lg">
      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <label class="sp-field" style="min-width: 160px;">
          <span class="sp-field__label">Driver</span>
          <select class="sp-field__input" bind:value={driver} disabled={!!editingId}>
            <option value="telegram">Telegram</option>
            <option value="pushover">Pushover</option>
          </select>
        </label>
        <div style="flex: 1; min-width: 200px;">
          <Field id="label" label="Label (optional)" bind:value={label} placeholder="ops telegram" />
        </div>
      </div>

      {#if driver === 'telegram'}
        <div style="display: flex; gap: 14px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 220px;">
            <Field id="tg-token" label="Bot token" type="password" bind:value={tgBotToken}
              placeholder={editingId ? 'leave blank to keep current' : '123456:ABC-DEF…'} />
          </div>
          <div style="flex: 1; min-width: 160px;">
            <Field id="tg-chat" label="Chat ID" bind:value={tgChatId} placeholder="123456789" />
          </div>
        </div>
      {:else}
        <div style="display: flex; gap: 14px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 220px;">
            <Field id="po-token" label="App token" type="password" bind:value={poAppToken}
              placeholder={editingId ? 'leave blank to keep current' : 'azGD…'} />
          </div>
          <div style="flex: 1; min-width: 160px;">
            <Field id="po-user" label="User key" type="password" bind:value={poUserKey}
              placeholder={editingId ? 'leave blank to keep current' : 'uQi…'} />
          </div>
        </div>
      {/if}

      <div>
        <span class="sp-field__label" style="display: block; margin-bottom: 8px;">Watches</span>
        <label class="sp-check">
          <input type="checkbox" bind:checked={watchAll} />
          <span>All my projects (including future ones)</span>
        </label>
        {#if !watchAll}
          <div class="sp-checklist">
            {#if projects.length === 0}
              <p class="sp-mini">No projects yet.</p>
            {:else}
              {#each projects as p (p.id)}
                <label class="sp-check">
                  <input type="checkbox" checked={watchProjects.includes(p.id)} onchange={() => toggleProject(p.id)} />
                  <span>{p.name}</span>
                </label>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <div>
        <span class="sp-field__label" style="display: block; margin-bottom: 8px;">Triggers</span>
        <label class="sp-check">
          <input type="checkbox" bind:checked={trigBundle} />
          <span>Machine token bundle pull</span>
          <span class="sp-mini" title="Fires when a CI/consumer fetches secrets via an API token.">ⓘ</span>
        </label>
        <label class="sp-check">
          <input type="checkbox" bind:checked={trigDashboard} />
          <span>Owner dashboard secret reads</span>
          <span class="sp-mini" title="Fires when you open the secrets page in the web UI. Noisier.">ⓘ</span>
        </label>
      </div>

      <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;">
        <label class="sp-field" style="min-width: 200px;">
          <span class="sp-field__label">Throttle</span>
          <select class="sp-field__input" bind:value={throttleMode}>
            <option value="cooldown">Cooldown (one per window)</option>
            <option value="every">Every fetch</option>
            <option value="new_source_only">New source only</option>
          </select>
        </label>
        {#if throttleMode === 'cooldown'}
          <div style="min-width: 140px;">
            <Field id="cooldown" label="Cooldown (min)" type="number" bind:value={cooldownMinutes} min={1} max={1440} />
          </div>
        {:else if throttleMode === 'new_source_only'}
          <div style="min-width: 160px;">
            <Field id="newsrc" label="Source window (min)" type="number" bind:value={newSourceMinutes} min={1} max={1440} />
          </div>
        {/if}
      </div>

      {#if error}<p class="sp-alert sp-alert--danger">{error}</p>{/if}

      <div style="display: flex; gap: 8px;">
        <Button onclick={handleSave} disabled={saving}>{saving ? 'saving…' : editingId ? 'save' : 'add service'}</Button>
        <Button variant="link" onclick={() => { showForm = false; resetForm(); }}>cancel</Button>
      </div>
    </div>
  </Glass>
{/if}

{#if loading}
  <p class="sp-mini">Loading…</p>
{:else if services.length === 0}
  <Empty title="No notification services yet." hint="Add one to get notified when your project secrets are fetched." />
{:else}
  <div class="sp-stack">
    {#each services as s, i (s.id)}
      {@const badge = statusBadge(s)}
      <div class="sp-row sp-parallax" style="--depth: {0.1 + (i % 4) * 0.04};">
        <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 0;">
            <p style="margin: 0; font: 500 13px var(--sp-font); color: var(--sp-text); letter-spacing: -0.01em;">
              {s.label || s.driver}
              <span style="color: var(--sp-text-dim); font-weight: 400;"> · {s.driver}</span>
            </p>
            <div style="display: flex; gap: 14px; margin-top: 6px; font-size: 11px; color: var(--sp-text-muted); flex-wrap: wrap; font-family: var(--sp-font);">
              <span>watches {watchSummary(s)}</span>
              <span>· {triggerSummary(s)}</span>
              <span>· {throttleSummary(s)}</span>
            </div>
            <div style="margin-top: 8px; font-size: 11px; font-family: var(--sp-font);">
              <span style="color: {statusColor[badge.tone]};">● {badge.text}</span>
              {#if s.last_error}
                <span style="color: var(--sp-text-dim);"> — {s.last_error}</span>
              {/if}
            </div>
          </div>
          <div style="display: flex; gap: 4px;">
            <Button variant="link" onclick={() => openEdit(s)}>edit</Button>
            {#if s.state === 'disabled' || s.state === 'permanently_disabled'}
              <Button variant="link" onclick={() => handleReenable(s)}>re-enable</Button>
            {/if}
            <Button variant="link-danger" onclick={() => handleDelete(s)}>delete</Button>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<div style="margin-top: 22px;">
  <Collapsible title="▸ recent deliveries (7-day log)">
    <p class="sp-mini" style="margin: 0 0 12px;">
      Granith keeps 7 days of delivery attempts. No server addresses or internal details are recorded — only what you
      need to fix your own setup.
    </p>
    {#if deliveries.length === 0}
      <p class="sp-mini">No deliveries logged yet.</p>
    {:else}
      <div class="sp-stack" style="gap: 6px;">
        {#each deliveries as d (d.id)}
          {@const tone = d.status === 'success' ? 'ok' : d.status === 'client_error' ? 'danger' : 'warn'}
          <div style="display: flex; gap: 12px; align-items: baseline; font-size: 11px; font-family: var(--sp-font); color: var(--sp-text-muted);">
            <span style="color: {statusColor[tone]}; min-width: 90px;">● {d.status.replace('_', ' ')}</span>
            <span style="min-width: 120px;">{projectName(d.project_id)}</span>
            <span style="color: var(--sp-text-dim);">{d.trigger_type}</span>
            <span style="flex: 1;">{d.error_message ?? ''}</span>
            <span style="color: var(--sp-text-dim);">{new Date(d.created_at).toLocaleString()}</span>
          </div>
        {/each}
      </div>
    {/if}
  </Collapsible>
</div>

<style>
  .sp-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 400 13px var(--sp-font);
    color: var(--sp-text);
    margin-bottom: 6px;
    cursor: pointer;
  }
  .sp-check input {
    accent-color: var(--sp-accent);
  }
  .sp-checklist {
    margin-top: 6px;
    padding: 10px 12px;
    border: 1px solid var(--sp-glass-border);
    border-radius: 10px;
    max-height: 200px;
    overflow-y: auto;
  }
  select.sp-field__input {
    appearance: none;
    cursor: pointer;
  }
</style>
