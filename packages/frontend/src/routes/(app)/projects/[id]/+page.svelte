<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import {
    loadSecrets,
    getSecrets,
    createSecret,
    updateSecret,
    deleteSecret,
  } from '$lib/stores/secrets.svelte.js';
  import { rotatePDK as rotatePDKApi } from '$lib/api/projects.js';
  import { listSecrets } from '$lib/api/secrets.js';
  import * as keys from '$lib/crypto/keys.js';
  import * as s from '$lib/crypto/sodium.js';
  import { getKek } from '$lib/stores/auth.svelte.js';
  import { confirmModal, toast } from '$lib/stores/ui.svelte.js';
  import {
    Glass,
    PageHead,
    Button,
    Field,
    Empty,
    ProjectTabs,
    Icon,
  } from '$lib/components/spatial';

  let loading = $state(true);
  let showAdd = $state(false);
  let newName = $state('');
  let newValue = $state('');
  let creating = $state(false);
  let addError = $state('');
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let editValue = $state('');
  let editError = $state('');
  let rotating = $state(false);
  let rotateError = $state('');
  let loadError = $state('');
  let query = $state('');
  let revealedIds = $state<string[]>([]);
  let saving = $state(false);

  const filteredSecrets = $derived(
    getSecrets().filter((secret) => secret.name.toLowerCase().includes(query.trim().toLowerCase())),
  );

  function toggleReveal(id: string) {
    revealedIds = revealedIds.includes(id)
      ? revealedIds.filter((value) => value !== id)
      : [...revealedIds, id];
  }

  async function copySecret(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast('Secret copied to clipboard.', 'success');
    } catch {
      toast('Could not copy. Reveal the secret to copy it manually.', 'danger');
    }
  }

  const projectId = $derived(page.params.id!);
  const project = $derived(getProjectById(projectId));

  async function refresh() {
    loading = true;
    loadError = '';
    try {
      if (!project) await loadProjects();
      const p = getProjectById(projectId);
      if (p) await loadSecrets(projectId, p.pdk);
      else loadError = 'This project could not be found.';
    } catch (e: any) {
      loadError = e.message || 'Could not load secrets. Please try again.';
    } finally {
      loading = false;
    }
  }

  onMount(refresh);

  async function handleAdd(e: Event) {
    e.preventDefault();
    if (!newName.trim() || !project) return;
    creating = true;
    addError = '';
    try {
      await createSecret(projectId, project.pdk, newName.trim(), newValue);
      showAdd = false;
      newName = '';
      newValue = '';
    } catch (e: any) {
      addError = e.message || 'Could not save secret';
    } finally {
      creating = false;
    }
  }

  function startEdit(sec: { id: string; name: string; value: string }) {
    editingId = sec.id;
    editName = sec.name;
    editValue = sec.value;
    editError = '';
  }

  async function handleUpdate(e: Event) {
    e.preventDefault();
    if (!editingId || !project || saving || !editName.trim()) return;
    editError = '';
    saving = true;
    try {
      await updateSecret(projectId, project.pdk, editingId, editName.trim(), editValue);
      editingId = null;
    } catch (e: any) {
      editError = e.message || 'Could not update secret';
    } finally {
      saving = false;
    }
  }

  async function handleDelete(secretId: string, name: string) {
    const ok = await confirmModal({
      title: `Delete "${name}"?`,
      body: 'The secret and its history are gone for good.',
      confirmLabel: 'delete secret',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSecret(projectId, secretId);
    } catch (e: any) {
      toast(e.message || 'Could not delete secret', 'danger');
    }
  }

  async function handleRotatePDK() {
    const ok = await confirmModal({
      title: 'Rotate encryption key?',
      consequences: [
        'A new project key is generated and every secret is re-wrapped',
        'All tokens are revoked',
        'Running services lose access until you mint new tokens',
      ],
      confirmLabel: 'rotate & revoke tokens',
      danger: true,
    });
    if (!ok) return;

    const kek = getKek();
    if (!kek || !project) return;

    rotating = true;
    rotateError = '';
    try {
      const newPdk = keys.generatePDK();
      const { wrapped: wrappedPdk, nonce: wrapNonce } = keys.wrapPDKForUser(newPdk, kek);
      const { ct: nameCt, nonce: nameNonce } = keys.encryptProjectName(project.name, newPdk);

      const { secrets: rawSecrets } = await listSecrets(projectId);
      const rewrapped = rawSecrets.map((sec) => {
        const wikCt = s.fromBase64Standard(sec.wrapped_item_key);
        const wikNonce = s.fromBase64Standard(sec.wik_nonce);
        const itemKey = keys.unwrapItemKey(wikCt, wikNonce, project.pdk);
        const { wrapped, nonce } = keys.wrapItemKey(itemKey, newPdk);
        return {
          secret_id: sec.id,
          wrapped_item_key: s.toBase64Standard(wrapped),
          wik_nonce: s.toBase64Standard(nonce),
        };
      });

      await rotatePDKApi(projectId, {
        wrapped_pdk_for_user: s.toBase64Standard(wrappedPdk),
        wrap_nonce_for_user: s.toBase64Standard(wrapNonce),
        name_ct: s.toBase64Standard(nameCt),
        name_nonce: s.toBase64Standard(nameNonce),
        rewrapped_secrets: rewrapped,
      });

      await loadProjects();
      const p = getProjectById(projectId);
      if (p) await loadSecrets(projectId, p.pdk);
      toast('Key rotated — all tokens revoked.', 'success');
    } catch (e: any) {
      rotateError = e.message || 'Rotation failed';
    } finally {
      rotating = false;
    }
  }
</script>

<svelte:head><title>{project?.name ?? 'Project'} · Granith</title></svelte:head>

<PageHead back="All projects" backHref="/projects" title={project?.name ?? '…'}>
  {#snippet actions()}
    <Button variant="danger" onclick={handleRotatePDK} disabled={rotating}>
      {rotating ? 'Rotating…' : 'Rotate keys'}
    </Button>
    <Button onclick={() => (showAdd = !showAdd)}><Icon name="plus" size={17} />Add secret</Button>
  {/snippet}
  <p class="sp-mini" style="margin-top: 4px;">
    {getSecrets().length} secret{getSecrets().length === 1 ? '' : 's'} · encrypted on your device
  </p>
</PageHead>

<ProjectTabs {projectId} />

{#if rotateError}
  <p class="sp-alert sp-alert--danger" style="margin-bottom: 18px;">{rotateError}</p>
{/if}

{#if showAdd}
  <Glass style="padding: 22px; margin-bottom: 18px;">
    <form onsubmit={handleAdd} style="display: flex; flex-direction: column; gap: 14px;">
      <Field id="new-name" label="Name" bind:value={newName} placeholder="SECRET_NAME" autofocus />
      <Field
        id="new-value"
        type="textarea"
        label="Value"
        bind:value={newValue}
        placeholder="Secret value…"
        rows={3}
      />
      {#if addError}<p class="sp-alert sp-alert--danger">{addError}</p>{/if}
      <div style="display: flex; gap: 8px;">
        <Button type="submit" disabled={creating || !newName.trim()}
          >{creating ? 'Saving…' : 'Save secret'}</Button
        >
        <Button
          variant="link"
          onclick={() => {
            showAdd = false;
            newName = '';
            newValue = '';
            addError = '';
          }}>Cancel</Button
        >
      </div>
    </form>
  </Glass>
{/if}

{#if loadError}
  <div class="sp-alert sp-alert--danger" role="alert">
    {loadError}<Button variant="link" onclick={refresh}>Try again</Button>
  </div>
{:else if loading}
  <p class="sp-mini" role="status">Opening your secrets…</p>
{:else if getSecrets().length === 0}
  <Empty
    title="A safe place for your first secret."
    hint="Add an API key, connection string, or environment variable to this project."
  >
    <Button onclick={() => (showAdd = true)}><Icon name="plus" size={17} />Add a secret</Button>
  </Empty>
{:else}
  <div class="secrets-toolbar">
    <label class="sp-search"
      ><Icon name="search" size={18} /><input
        type="search"
        aria-label="Search secrets"
        placeholder="Find a secret…"
        bind:value={query}
      /></label
    >
    <span class="sp-mini"
      >{filteredSecrets.length} secret{filteredSecrets.length === 1 ? '' : 's'}</span
    >
  </div>
  <div class="sp-stack">
    {#each filteredSecrets as secret (secret.id)}
      {#if editingId === secret.id}
        <Glass style="padding: 20px;">
          <form onsubmit={handleUpdate} style="display: flex; flex-direction: column; gap: 12px;">
            <Field id="en-{secret.id}" label="Name" bind:value={editName} />
            <Field
              id="ev-{secret.id}"
              label="Value"
              type="textarea"
              bind:value={editValue}
              rows={3}
            />
            {#if editError}<p class="sp-alert sp-alert--danger">{editError}</p>{/if}
            <div style="display: flex; gap: 8px;">
              <Button type="submit" disabled={saving || !editName.trim()}
                >{saving ? 'Saving…' : 'Save changes'}</Button
              >
              <Button
                variant="link"
                onclick={() => {
                  editingId = null;
                  editError = '';
                }}>Cancel</Button
              >
            </div>
          </form>
        </Glass>
      {:else}
        <div class="sp-row secret-row">
          <div class="secret-main">
            <span class="secret-icon"><Icon name="key" size={20} /></span>
            <div class="secret-content">
              <div class="secret-name">
                <p class="sp-row__title">{secret.name}</p>
                <span class="secret-version">v{secret.version}</span>
              </div>
              <p class="secret-value" class:revealed={revealedIds.includes(secret.id)}>
                {revealedIds.includes(secret.id) ? secret.value : '••••••••••••••••'}
              </p>
              <p class="secret-updated">
                Updated {new Date(secret.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div class="secret-actions">
            <button
              class="secret-tool"
              type="button"
              aria-label="{revealedIds.includes(secret.id) ? 'Hide' : 'Reveal'} {secret.name}"
              title={revealedIds.includes(secret.id) ? 'Hide value' : 'Reveal value'}
              aria-pressed={revealedIds.includes(secret.id)}
              onclick={() => toggleReveal(secret.id)}
              ><Icon name={revealedIds.includes(secret.id) ? 'lock' : 'eye'} size={17} /></button
            >
            <button
              class="secret-tool"
              type="button"
              aria-label="Copy {secret.name}"
              title="Copy value"
              onclick={() => copySecret(secret.value)}><Icon name="copy" size={16} /></button
            >
            <span class="secret-divider"></span>
            <Button variant="link" onclick={() => startEdit(secret)}>Edit</Button>
            <Button variant="link-danger" onclick={() => handleDelete(secret.id, secret.name)}
              >Delete</Button
            >
          </div>
        </div>
      {/if}
    {:else}
      <Empty title="No matching secrets." hint="Try a different name, or clear your search."
        ><Button variant="bordered" onclick={() => (query = '')}>Clear search</Button></Empty
      >
    {/each}
  </div>
{/if}

<style>
  .secrets-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 0 4px;
    margin-bottom: 20px;
  }
  .secrets-toolbar .sp-search {
    flex: 1;
    max-width: 320px;
  }
  .secret-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .secret-main {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    min-width: 0;
    flex: 1;
  }
  .secret-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 40px;
    border: 1px solid var(--sp-glass-border);
    background: var(--sp-bg);
    color: var(--sp-accent);
    border-radius: 9px;
    flex-shrink: 0;
  }
  .secret-content {
    min-width: 0;
  }
  .secret-name {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .secret-name p {
    margin: 0;
    font-family: var(--sp-mono);
    font-size: 12px;
  }
  .secret-version {
    font-size: 10px;
    padding: 3px 6px;
    color: var(--sp-text-muted);
    background: var(--sp-bg-deep);
    border-radius: 4px;
  }
  .secret-value {
    font: 13px/1.7 var(--sp-mono);
    margin: 8px 0 0;
    letter-spacing: 2px;
    color: var(--sp-text-muted);
    overflow-wrap: anywhere;
  }
  .secret-value.revealed {
    letter-spacing: normal;
    white-space: pre-wrap;
    color: var(--sp-text);
  }
  .secret-updated {
    font-size: 11px;
    color: var(--sp-text-muted);
    margin: 6px 0 0;
  }
  .secret-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .secret-tool {
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--sp-text-soft);
    width: 36px;
    height: 36px;
    cursor: pointer;
    border-radius: 6px;
  }
  .secret-tool:hover,
  .secret-tool[aria-pressed='true'] {
    color: var(--sp-accent);
    background: var(--sp-accent-soft);
  }
  .secret-divider {
    width: 1px;
    height: 16px;
    background: var(--sp-glass-border);
    margin: 0 8px;
  }
  @media (max-width: 1000px) {
    .secret-row {
      flex-wrap: wrap;
    }
    .secret-main {
      flex-basis: 100%;
    }
    .secret-actions {
      margin-left: 50px;
    }
  }
  @media (max-width: 480px) {
    .secret-main {
      gap: 12px;
    }
    .secret-actions {
      margin-left: 0;
    }
  }
</style>
