<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import { listAudit } from '$lib/api/audit.js';
  import type { AuditEntry } from '$lib/api/audit.js';
  import { Glass, PageHead, Label, Button, Empty } from '$lib/components/spatial';

  const projectId = $derived(page.params.id!);
  const project = $derived(getProjectById(projectId));

  let entries = $state<AuditEntry[]>([]);
  let loading = $state(true);
  let filterAction = $state('');
  let offset = $state(0);
  const limit = 50;
  let hasMore = $state(false);

  const AUDIT_ACTIONS = [
    '',
    'secret.create',
    'secret.update',
    'secret.delete',
    'token.create',
    'token.revoke',
    'token.update',
    'bundle.fetch',
    'project.rotate_pdk',
  ];

  onMount(async () => {
    if (!project) await loadProjects();
    await fetchEntries();
  });

  async function fetchEntries() {
    loading = true;
    const params: Record<string, any> = { limit: limit + 1, offset };
    if (filterAction) params.action = filterAction;
    const res = await listAudit(projectId, params);
    hasMore = res.entries.length > limit;
    entries = res.entries.slice(0, limit);
    loading = false;
  }

  async function handleFilter() {
    offset = 0;
    await fetchEntries();
  }

  async function nextPage() {
    offset += limit;
    await fetchEntries();
  }

  async function prevPage() {
    offset = Math.max(0, offset - limit);
    await fetchEntries();
  }

  function actionClass(action: string) {
    if (action.includes('delete') || action.includes('revoke')) return 'sp-audit__action sp-audit__action--danger';
    if (action.includes('create')) return 'sp-audit__action sp-audit__action--create';
    return 'sp-audit__action sp-audit__action--neutral';
  }
</script>

<PageHead back={project?.name ?? 'Project'} backHref="/projects/{projectId}" title="Audit log">
  <p class="sp-mini" style="margin-top: 4px;">
    enough to spot a stolen token; not enough to leak which secret your process touched when.
  </p>
</PageHead>

<Glass depth={0.25} style="padding: 14px; margin-bottom: 18px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
  <Label>filter</Label>
  <select
    class="sp-audit__select"
    bind:value={filterAction}
    onchange={handleFilter}
  >
    {#each AUDIT_ACTIONS as a (a)}
      <option value={a}>{a || 'all actions'}</option>
    {/each}
  </select>
  <span class="sp-mini" style="margin-left: auto;">{entries.length} entries</span>
</Glass>

{#if loading}
  <p class="sp-mini">Loading…</p>
{:else if entries.length === 0}
  <Empty title="No audit entries found." />
{:else}
  <Glass depth={0.15} style="padding: 6px 0;">
    {#each entries as entry (entry.id)}
      <div class="sp-audit__row">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span class={actionClass(entry.action)}>{entry.action}</span>
          <span class="sp-audit__actor">{entry.actor_type}:{entry.actor_id.slice(0, 8)}</span>
        </div>
        <div class="sp-audit__right">
          {#if entry.ip}<span>{entry.ip}</span>{/if}
          <span>{new Date(entry.ts).toLocaleString()}</span>
        </div>
      </div>
    {/each}
  </Glass>

  <div class="sp-audit__paging">
    <Button variant="link" disabled={offset === 0} onclick={prevPage}>← previous</Button>
    <span>showing {offset + 1}–{offset + entries.length}</span>
    <Button variant="link" disabled={!hasMore} onclick={nextPage}>next →</Button>
  </div>
{/if}
