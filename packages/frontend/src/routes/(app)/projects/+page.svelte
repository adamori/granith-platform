<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    loadProjects,
    getProjects,
    createProject,
    deleteProject,
  } from '$lib/stores/projects.svelte.js';
  import { confirmModal, toast } from '$lib/stores/ui.svelte.js';
  import { Glass, PageHead, Button, Field, Empty, Icon } from '$lib/components/spatial';

  let loading = $state(true);
  let showCreate = $state(false);
  let newName = $state('');
  let creating = $state(false);
  let createError = $state('');
  let loadError = $state('');
  let query = $state('');
  let sort = $state('newest');

  const projects = $derived(getProjects());
  const approvalCount = $derived(projects.filter((project) => project.requireApproval).length);
  const filteredProjects = $derived.by(() => {
    const filtered = projects.filter((project) =>
      project.name.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return filtered.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async function refresh() {
    loading = true;
    loadError = '';
    try {
      await loadProjects();
    } catch (e: any) {
      loadError = e.message || 'Could not load projects. Please try again.';
    } finally {
      loading = false;
    }
  }

  onMount(refresh);

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!newName.trim()) return;
    creating = true;
    createError = '';
    try {
      const id = await createProject(newName.trim());
      showCreate = false;
      newName = '';
      goto(`/projects/${id}`);
    } catch (e: any) {
      createError = e.message || 'Could not create project';
    } finally {
      creating = false;
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmModal({
      title: `Delete "${name}"?`,
      body: 'The project, its secrets and its tokens are gone for good.',
      confirmLabel: 'delete project',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProject(id);
      toast(`"${name}" deleted.`, 'success');
    } catch (e: any) {
      toast(e.message || 'Could not delete project', 'danger');
    }
  }
</script>

<svelte:head><title>Projects · Granith</title></svelte:head>

<PageHead eyebrow="Your private workspace" title="Projects">
  {#snippet actions()}
    <Button onclick={() => (showCreate = !showCreate)}
      ><Icon name="plus" size={17} />New project</Button
    >
  {/snippet}
  <p class="sp-mini">A little order. A lot of peace of mind. All your secrets, in one place.</p>
</PageHead>

<div class="workspace-overview">
  <div class="overview-title">
    <span class="overview-icon"><Icon name="projects" size={24} /></span>
    <div>
      <strong>{loading ? '—' : projects.length}</strong><span
        >Project{projects.length === 1 ? '' : 's'} in your workspace</span
      >
    </div>
  </div>
  <div class="overview-detail">
    <Icon name="shield" size={18} /><span
      ><strong>{loading ? '—' : approvalCount}</strong> with access approval</span
    >
  </div>
</div>

{#if showCreate}
  <Glass style="padding: 24px; margin-bottom: 24px;">
    <h2 class="sp-h3" style="margin-bottom: 18px;">Give your project a home</h2>
    <form onsubmit={handleCreate} class="create-form">
      <div class="create-field">
        <Field
          id="new-proj"
          label="Project name"
          bind:value={newName}
          placeholder="e.g. payments-production"
          autofocus
        />
      </div>
      <Button type="submit" disabled={creating || !newName.trim()}
        >{creating ? 'Creating…' : 'Create project'}</Button
      >
      <Button
        variant="link"
        onclick={() => {
          showCreate = false;
          newName = '';
          createError = '';
        }}>Cancel</Button
      >
    </form>
    {#if createError}<p class="sp-alert sp-alert--danger" style="margin-top: 14px;" role="alert">
        {createError}
      </p>{/if}
  </Glass>
{/if}

{#if loadError}
  <div class="sp-alert sp-alert--danger" role="alert">
    {loadError}<Button variant="link" onclick={refresh}>Try again</Button>
  </div>
{:else if loading}
  <div class="loading-projects" role="status">Opening your workspace…</div>
{:else if projects.length === 0}
  <Empty
    title="Your next idea starts here."
    hint="Create a project to keep its environment variables, API keys, and other secrets together."
  >
    <Button onclick={() => (showCreate = true)}
      ><Icon name="plus" size={17} />Create your first project</Button
    >
  </Empty>
{:else}
  <section class="project-list" aria-label="Your projects">
    <div class="sp-toolbar">
      <label class="sp-search"
        ><Icon name="search" size={18} /><input
          type="search"
          aria-label="Search projects"
          placeholder="Find a project…"
          bind:value={query}
        /></label
      >
      <select aria-label="Sort projects" bind:value={sort}
        ><option value="newest">Newest first</option><option value="name">Name A–Z</option></select
      >
    </div>
    <div class="project-columns" aria-hidden="true">
      <span>Project name</span><span>Access</span><span>Created</span><span></span>
    </div>
    {#each filteredProjects as project, i (project.id)}
      <div class="project-row">
        <a class="project-name" href="/projects/{project.id}">
          <span class="project-icon tone-{i % 3}"><Icon name="projects" size={21} /></span>
          <span class="project-name-text"
            ><strong>{project.name}</strong><span
              ><Icon name="lock" size={11} />Encrypted project</span
            ></span
          >
        </a>
        <div class="project-access">
          <span class="sp-badge {project.requireApproval ? 'sp-badge--warm' : 'sp-badge--neutral'}"
            >{#if project.requireApproval}<Icon
                name="shield"
                size={13}
              />{/if}{project.requireApproval ? 'Approval required' : 'Token access'}</span
          >
        </div>
        <time class="project-date" datetime={project.createdAt}
          >{formatDate(project.createdAt)}</time
        >
        <div class="project-actions">
          <Button variant="link-danger" onclick={() => handleDelete(project.id, project.name)}
            >Delete</Button
          >
          <a
            class="open-project"
            href="/projects/{project.id}"
            aria-label="Open {project.name}"
            title="Open project"><Icon name="arrow" size={18} /></a
          >
        </div>
      </div>
    {:else}
      <div class="no-results">
        <p>No projects match “{query}”.</p>
        <Button variant="link" onclick={() => (query = '')}>Clear search</Button>
      </div>
    {/each}
    <div class="list-footer">
      <span>{filteredProjects.length} of {projects.length} projects</span><span
        ><Icon name="lock" size={12} />Private by default</span
      >
    </div>
  </section>
{/if}

<style>
  .workspace-overview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 25px 28px;
    margin-bottom: 32px;
    background: var(--sp-overview-bg);
    border: 1px solid var(--sp-overview-border);
    border-radius: 12px;
  }
  .overview-title {
    display: flex;
    align-items: center;
    gap: 17px;
  }
  .overview-icon {
    display: grid;
    place-items: center;
    width: 50px;
    height: 50px;
    background: var(--sp-overview-icon);
    color: var(--sp-accent);
    border-radius: 12px;
  }
  .overview-title strong {
    font-size: 28px;
    line-height: 1;
    font-weight: 500;
    letter-spacing: -1px;
  }
  .overview-title div > span {
    display: block;
    font-size: 12px;
    color: var(--sp-text-soft);
    margin-top: 6px;
  }
  .overview-detail {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--sp-text-soft);
    font-size: 12px;
  }
  .overview-detail strong {
    color: var(--sp-text);
    font-weight: 600;
  }
  .create-form {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .create-field {
    flex: 1;
    min-width: min(240px, 100%);
  }
  .project-list {
    background: var(--sp-glass-bg);
    border: 1px solid var(--sp-glass-border);
    border-radius: 12px;
    overflow: hidden;
  }
  .project-columns,
  .project-row {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) 155px 115px 104px;
    align-items: center;
    gap: 16px;
    padding: 0 24px;
  }
  .project-columns {
    background: var(--sp-surface-subtle);
    min-height: 44px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--sp-text-muted);
  }
  .project-row {
    min-height: 94px;
    border-top: 1px solid var(--sp-glass-border);
    transition: background 150ms ease;
  }
  .project-row:hover {
    background: var(--sp-hover);
  }
  .project-name {
    display: flex;
    align-items: center;
    gap: 14px;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }
  .project-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 44px;
    flex-shrink: 0;
    color: var(--sp-icon-green);
    background: var(--sp-icon-green-bg);
    border: 1px solid var(--sp-icon-green-border);
    border-radius: 10px;
  }
  .tone-1 {
    color: var(--sp-icon-sand);
    background: var(--sp-icon-sand-bg);
    border-color: var(--sp-icon-sand-border);
  }
  .tone-2 {
    color: var(--sp-icon-blue);
    background: var(--sp-icon-blue-bg);
    border-color: var(--sp-icon-blue-border);
  }
  .project-name-text {
    min-width: 0;
  }
  .project-name-text strong {
    display: block;
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .project-name-text > span {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: var(--sp-text-muted);
    margin-top: 7px;
  }
  .project-date {
    font-size: 11px;
    color: var(--sp-text-soft);
  }
  .project-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .open-project {
    display: grid;
    place-items: center;
    color: var(--sp-accent);
    width: 34px;
    height: 36px;
    border-radius: 6px;
  }
  .open-project:hover {
    background: var(--sp-accent-soft);
  }
  .list-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--sp-glass-border);
    color: var(--sp-text-muted);
    padding: 16px 24px;
    font-size: 11px;
  }
  .list-footer > span:last-child {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .no-results,
  .loading-projects {
    padding: 48px 20px;
    text-align: center;
    color: var(--sp-text-muted);
    font-size: 14px;
  }
  @media (max-width: 1150px) {
    .project-columns,
    .project-row {
      grid-template-columns: minmax(150px, 1fr) 144px 94px;
      gap: 12px;
      padding-inline: 18px;
    }
    .project-columns span:nth-child(3) {
      display: none;
    }
    .project-date {
      grid-column: 1;
      grid-row: 2;
      margin: -12px 0 18px 56px;
    }
    .project-actions {
      grid-column: 3;
      grid-row: 1;
    }
    .project-row {
      padding-top: 18px;
      row-gap: 18px;
    }
  }
  @media (max-width: 900px) {
    .overview-detail {
      max-width: 145px;
      line-height: 1.6;
    }
  }
  @media (max-width: 600px) {
    .workspace-overview {
      padding: 20px;
      gap: 20px;
      flex-wrap: wrap;
    }
    .overview-detail {
      max-width: none;
    }
    .project-columns {
      display: none;
    }
    .project-row {
      grid-template-columns: minmax(0, 1fr) auto;
      padding: 20px 16px 16px;
      gap: 14px;
    }
    .project-name {
      grid-column: 1 / -1;
    }
    .project-name-text strong {
      font-size: 15px;
    }
    .project-access {
      grid-row: 2;
      grid-column: 1;
      margin-left: 56px;
    }
    .project-date {
      grid-row: 3;
      margin: -6px 0 0 56px;
    }
    .project-actions {
      grid-row: 2 / 4;
      grid-column: 2;
      gap: 0;
    }
    .list-footer {
      padding-inline: 16px;
      font-size: 10px;
    }
  }
</style>
