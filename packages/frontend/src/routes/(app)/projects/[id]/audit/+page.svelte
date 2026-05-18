<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import { listAudit } from '$lib/api/audit.js';
  import type { AuditEntry } from '$lib/api/audit.js';

  const projectId = $derived(page.params.id!);
  const project = $derived(getProjectById(projectId));

  let entries = $state<AuditEntry[]>([]);
  let loading = $state(true);
  let filterAction = $state('');
  let offset = $state(0);
  const limit = 50;
  let hasMore = $state(false);

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

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString();
  }

  function actionColor(action: string) {
    if (action.includes('delete') || action.includes('revoke')) return 'text-danger';
    if (action.includes('create')) return 'text-success';
    return 'text-text';
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <a href="/projects/{projectId}" class="text-text-muted text-sm hover:text-primary transition-colors">&larr; {project?.name ?? 'Project'}</a>
      <h1 class="text-xl font-bold mt-1">Audit Log</h1>
    </div>
  </div>

  <div class="flex items-center gap-3">
    <select
      bind:value={filterAction}
      onchange={handleFilter}
      class="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-text focus:border-border-focus focus:outline-none"
    >
      <option value="">All actions</option>
      <option value="secret.create">secret.create</option>
      <option value="secret.update">secret.update</option>
      <option value="secret.delete">secret.delete</option>
      <option value="token.create">token.create</option>
      <option value="token.revoke">token.revoke</option>
      <option value="token.update">token.update</option>
      <option value="bundle.fetch">bundle.fetch</option>
      <option value="project.rotate_pdk">project.rotate_pdk</option>
    </select>
  </div>

  {#if loading}
    <p class="text-text-muted">Loading…</p>
  {:else if entries.length === 0}
    <p class="text-text-muted text-center py-8">No audit entries found.</p>
  {:else}
    <div class="border border-border rounded-md divide-y divide-border">
      {#each entries as entry (entry.id)}
        <div class="px-4 py-3 flex items-center justify-between text-sm">
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs {actionColor(entry.action)}">{entry.action}</span>
            <span class="text-text-muted text-xs">{entry.actor_type}:{entry.actor_id.slice(0, 8)}</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-text-muted">
            {#if entry.ip}
              <span>{entry.ip}</span>
            {/if}
            <span>{formatTime(entry.ts)}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="flex justify-between items-center">
      <button
        onclick={prevPage}
        disabled={offset === 0}
        class="text-sm text-text-muted hover:text-primary disabled:opacity-30 transition-colors"
      >
        &larr; Previous
      </button>
      <span class="text-xs text-text-muted">Showing {offset + 1}–{offset + entries.length}</span>
      <button
        onclick={nextPage}
        disabled={!hasMore}
        class="text-sm text-text-muted hover:text-primary disabled:opacity-30 transition-colors"
      >
        Next &rarr;
      </button>
    </div>
  {/if}
</div>
