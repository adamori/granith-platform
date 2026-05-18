<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { loadProjects, getProjects, createProject, deleteProject } from '$lib/stores/projects.svelte.js';

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

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold">Projects</h1>
    <button
      onclick={() => showCreate = !showCreate}
      class="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover transition-colors"
    >
      + New Project
    </button>
  </div>

  {#if showCreate}
    <form onsubmit={handleCreate} class="flex gap-2">
      <div class="chevrons chevrons--on-focus chevrons--sm flex-1">
        <input
          type="text"
          bind:value={newName}
          placeholder="Project name"
          autofocus
          class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={creating || !newName.trim()}
        class="rounded-md bg-primary px-4 py-2 text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
      >
        {creating ? '…' : 'Create'}
      </button>
      <button
        type="button"
        onclick={() => { showCreate = false; newName = ''; }}
        class="rounded-md border border-border px-3 py-2 text-text-muted text-sm hover:border-border-focus transition-colors"
      >
        Cancel
      </button>
    </form>
  {/if}

  {#if loading}
    <p class="text-text-muted">Loading…</p>
  {:else if getProjects().length === 0}
    <div class="text-center py-12">
      <p class="text-text-muted">No projects yet.</p>
      <p class="text-text-muted text-sm mt-1">Create one to start managing secrets.</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each getProjects() as project (project.id)}
        <div class="chevrons chevrons--on-hover chevrons--sm flex items-center justify-between border border-border rounded-md p-4 hover:border-border-focus transition-colors">
          <a href="/projects/{project.id}" class="flex-1">
            <span class="font-medium text-text">{project.name}</span>
            <span class="text-text-muted text-xs ml-3">
              {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </a>
          <button
            onclick={() => handleDelete(project.id, project.name)}
            class="text-text-muted hover:text-danger text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
