<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects, setRequireApproval } from '$lib/stores/projects.svelte.js';
  import {
    listAccessRequests,
    approveAccessRequest,
    denyAccessRequest,
  } from '$lib/api/approvals.js';
  import type { AccessRequestResponse } from '$lib/api/approvals.js';
  import { toast } from '$lib/stores/ui.svelte.js';
  import { Glass, PageHead, Button, Empty, ProjectTabs } from '$lib/components/spatial';

  const projectId = $derived(page.params.id!);
  const project = $derived(getProjectById(projectId));

  let requests = $state<AccessRequestResponse[]>([]);
  let loading = $state(true);
  let toggling = $state(false);
  let decidingId = $state<string | null>(null);
  let error = $state('');

  const pending = $derived(
    requests.filter((r) => r.state === 'pending' && new Date(r.expires_at) > new Date()),
  );
  const history = $derived(requests.filter((r) => !pending.includes(r)));

  async function refresh() {
    const res = await listAccessRequests({ project_id: projectId });
    requests = res.requests;
  }

  onMount(() => {
    (async () => {
      if (!project) await loadProjects();
      try {
        await refresh();
      } catch (e: any) {
        toast(e.message || 'Could not load access requests', 'danger');
      }
      loading = false;
    })();
    const timer = setInterval(() => refresh().catch(() => {}), 10_000);
    return () => clearInterval(timer);
  });

  async function handleToggle() {
    if (!project) return;
    toggling = true;
    error = '';
    try {
      await setRequireApproval(projectId, !project.requireApproval);
    } catch (e: any) {
      error = e.message || 'Failed to update';
    } finally {
      toggling = false;
    }
  }

  async function decide(id: string, action: 'approve' | 'deny') {
    decidingId = id;
    error = '';
    try {
      await (action === 'approve' ? approveAccessRequest(id) : denyAccessRequest(id));
      await refresh();
    } catch (e: any) {
      error = e.message || 'Decision failed';
      await refresh();
    } finally {
      decidingId = null;
    }
  }

  function fmt(ts: string) {
    return new Date(ts).toLocaleString();
  }
</script>

<svelte:head><title>Approvals · {project?.name ?? 'Project'} · Granith</title></svelte:head>

<PageHead back="All projects" backHref="/projects" title={project?.name ?? '…'}>
  <p class="sp-mini" style="margin-top: 4px;">
    {pending.length} pending
  </p>
</PageHead>

<ProjectTabs {projectId} />

{#if error}
  <p class="sp-alert sp-alert--danger" style="margin-bottom: 18px;">{error}</p>
{/if}

<Glass style="padding: 22px; margin-bottom: 18px;">
  <div
    style="display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;"
  >
    <div>
      <p style="margin: 0;">Require approval for bundle access</p>
      <p class="sp-mini" style="margin: 6px 0 0;">
        {project?.requireApproval
          ? 'ON — every fetch waits for your approval and auto-denies after 5 minutes.'
          : 'OFF — tokens fetch the bundle directly.'}
      </p>
    </div>
    <Button
      variant={project?.requireApproval ? 'danger' : 'primary'}
      onclick={handleToggle}
      disabled={toggling || !project}
    >
      {toggling ? '…' : project?.requireApproval ? 'Disable' : 'Enable'}
    </Button>
  </div>
</Glass>

{#if loading}
  <p class="sp-mini">Loading…</p>
{:else}
  {#if pending.length === 0}
    <Empty title="Nothing waiting." hint="Fetches that need your approval show up here." />
  {:else}
    <div class="sp-stack" style="margin-bottom: 24px;">
      {#each pending as req (req.id)}
        <div class="sp-row">
          <div
            style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap;"
          >
            <div style="flex: 1; min-width: 0;">
              <p class="sp-row__title" style="margin: 0;">
                bundle fetch from {req.requester_ip ?? 'unknown IP'}
              </p>
              <p class="sp-row__value" style="margin: 6px 0 0;">
                {req.requester_user_agent ?? 'unknown client'} · token {req.token_id.slice(0, 12)}…
              </p>
              <p class="sp-mini" style="margin: 6px 0 0;">
                requested {fmt(req.created_at)} · auto-denies {fmt(req.expires_at)}
              </p>
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              <Button
                variant="primary"
                onclick={() => decide(req.id, 'approve')}
                disabled={decidingId === req.id}>Approve</Button
              >
              <Button
                variant="link-danger"
                onclick={() => decide(req.id, 'deny')}
                disabled={decidingId === req.id}>Deny</Button
              >
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if history.length > 0}
    <p class="sp-mini" style="margin-bottom: 10px;">recent decisions</p>
    <div class="sp-stack">
      {#each history as req (req.id)}
        <div class="sp-row">
          <div style="display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
            <p class="sp-row__value" style="margin: 0;">
              {req.requester_ip ?? 'unknown IP'} · {fmt(req.created_at)}
            </p>
            <p class="sp-row__value" style="margin: 0;">
              {req.state}{req.decided_via ? ` via ${req.decided_via}` : ''}
            </p>
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/if}
