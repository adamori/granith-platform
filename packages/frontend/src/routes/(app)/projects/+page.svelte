<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loadProjects, getProjects, createProject, deleteProject } from '$lib/stores/projects.svelte.js';
  import { Glass, PageHead, Button, Field, Empty } from '$lib/components/spatial';

  let loading = $state(true);
  let showCreate = $state(false);
  let newName = $state('');
  let creating = $state(false);

  onMount(async () => {
    await loadProjects();
    loading = false;
  });

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!newName.trim()) return;
    creating = true;
    try {
      const id = await createProject(newName.trim());
      showCreate = false;
      newName = '';
      goto(`/projects/${id}`);
    } finally {
      creating = false;
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    await deleteProject(id);
  }

</script>

<PageHead eyebrow="§02 · workspace" title="Projects">
  {#snippet actions()}
    <Button onclick={() => (showCreate = !showCreate)}>+ new project</Button>
  {/snippet}
  <p class="sp-mini" style="margin-top: 4px;">
    {getProjects().length} project{getProjects().length === 1 ? '' : 's'} · all wrapped with their own PDK
  </p>
</PageHead>

{#if showCreate}
  <Glass depth={0.3} style="padding: 18px; margin-bottom: 18px;">
    <form onsubmit={handleCreate} style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 240px;">
        <Field id="new-proj" label="Project name" bind:value={newName} placeholder="my-service-prod" autofocus />
      </div>
      <Button type="submit" disabled={creating || !newName.trim()}>{creating ? '…' : 'create'}</Button>
      <Button variant="link" onclick={() => { showCreate = false; newName = ''; }}>cancel</Button>
    </form>
  </Glass>
{/if}

{#if loading}
  <p class="sp-mini">Loading…</p>
{:else if getProjects().length === 0}
  <Empty title="No projects yet." hint="Create one to start managing secrets." />
{:else}
  <div class="sp-stack">
    {#each getProjects() as project, i (project.id)}
      <div
        class="sp-row sp-parallax"
        style="--depth: {0.15 + (i % 3) * 0.04}; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;"
      >
        <a
          href="/projects/{project.id}"
          style="flex: 1; min-width: 0; text-decoration: none; display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;"
        >
          <span class="sp-row__title">{project.name}</span>
          <span class="sp-mini" style="color: var(--sp-text-dim);">
            created {new Date(project.createdAt).toISOString().slice(0, 10)}
          </span>
        </a>
        <div style="display: flex; gap: 8px;">
          <Button variant="link-danger" onclick={() => handleDelete(project.id, project.name)}>delete</Button>
          <Button variant="bordered" href="/projects/{project.id}">open  →</Button>
        </div>
      </div>
    {/each}
  </div>
{/if}
