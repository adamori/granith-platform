<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import { loadSecrets, getSecrets, createSecret, updateSecret, deleteSecret } from '$lib/stores/secrets.svelte.js';
  import { rotatePDK as rotatePDKApi } from '$lib/api/projects.js';
  import { listSecrets } from '$lib/api/secrets.js';
  import * as keys from '$lib/crypto/keys.js';
  import * as s from '$lib/crypto/sodium.js';
  import { getKek } from '$lib/stores/auth.svelte.js';

  let loading = $state(true);
  let showAdd = $state(false);
  let newName = $state('');
  let newValue = $state('');
  let creating = $state(false);
  let editingId = $state<string | null>(null);
  let editName = $state('');
  let editValue = $state('');
  let rotating = $state(false);
  let rotateError = $state('');

  const projectId = $derived(page.params.id!);
  const project = $derived(getProjectById(projectId));

  onMount(async () => {
    if (!project) await loadProjects();
    const p = getProjectById(projectId);
    if (p) {
      await loadSecrets(projectId, p.pdk);
    }
    loading = false;
  });

  async function handleAdd(e: Event) {
    e.preventDefault();
    if (!newName.trim() || !project) return;
    creating = true;
    try {
      await createSecret(projectId, project.pdk, newName.trim(), newValue);
      showAdd = false;
      newName = '';
      newValue = '';
    } finally {
      creating = false;
    }
  }

  function startEdit(sec: { id: string; name: string; value: string }) {
    editingId = sec.id;
    editName = sec.name;
    editValue = sec.value;
  }

  async function handleUpdate(e: Event) {
    e.preventDefault();
    if (!editingId || !project) return;
    await updateSecret(projectId, project.pdk, editingId, editName, editValue);
    editingId = null;
  }

  async function handleDelete(secretId: string, name: string) {
    if (!confirm(`Delete secret "${name}"?`)) return;
    await deleteSecret(projectId, secretId);
  }

  async function handleRotatePDK() {
    if (!confirm('Rotate project encryption key?\n\nThis will:\n- Generate a new PDK\n- Re-wrap all secret keys\n- REVOKE ALL TOKENS\n\nRunning services will lose access until new tokens are minted.')) return;

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
    } catch (e: any) {
      rotateError = e.message || 'Rotation failed';
    } finally {
      rotating = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <a href="/projects" class="text-text-muted text-sm hover:text-primary transition-colors">&larr; Projects</a>
      <h1 class="text-xl font-bold mt-1">{project?.name ?? '…'}</h1>
    </div>
    <div class="flex gap-2">
      <a
        href="/projects/{projectId}/audit"
        class="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted hover:border-border-focus transition-colors"
      >
        Audit
      </a>
      <a
        href="/projects/{projectId}/tokens"
        class="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted hover:border-border-focus transition-colors"
      >
        Tokens
      </a>
      <button
        onclick={handleRotatePDK}
        disabled={rotating}
        class="rounded-md border border-danger/50 px-3 py-1.5 text-sm text-danger hover:border-danger hover:bg-danger/5 disabled:opacity-50 transition-colors"
      >
        {rotating ? 'Rotating…' : 'Rotate Keys'}
      </button>
      <button
        onclick={() => showAdd = !showAdd}
        class="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover transition-colors"
      >
        + Add Secret
      </button>
    </div>
  </div>

  {#if rotateError}
    <p class="text-danger text-sm">{rotateError}</p>
  {/if}

  {#if showAdd}
    <form onsubmit={handleAdd} class="border border-border rounded-md p-4 space-y-3">
      <div class="flex gap-3">
        <div class="chevrons chevrons--on-focus chevrons--sm flex-1">
          <input
            type="text"
            bind:value={newName}
            placeholder="SECRET_NAME"
            autofocus
            class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none font-mono text-sm"
          />
        </div>
      </div>
      <div class="chevrons chevrons--on-focus chevrons--sm">
        <textarea
          bind:value={newValue}
          placeholder="Secret value…"
          rows="3"
          class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none font-mono text-sm resize-y"
        ></textarea>
      </div>
      <div class="flex gap-2">
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          class="rounded-md bg-primary px-4 py-2 text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {creating ? '…' : 'Save'}
        </button>
        <button
          type="button"
          onclick={() => { showAdd = false; newName = ''; newValue = ''; }}
          class="rounded-md border border-border px-3 py-2 text-text-muted text-sm hover:border-border-focus transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  {/if}

  {#if loading}
    <p class="text-text-muted">Loading…</p>
  {:else if getSecrets().length === 0}
    <div class="text-center py-12">
      <p class="text-text-muted">No secrets in this project.</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each getSecrets() as secret (secret.id)}
        {#if editingId === secret.id}
          <form onsubmit={handleUpdate} class="chevrons chevrons--strong border border-border-focus rounded-md p-4 space-y-3">
            <div class="chevrons chevrons--on-focus chevrons--sm">
              <input
                type="text"
                bind:value={editName}
                class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text focus:border-border-focus focus:outline-none font-mono text-sm"
              />
            </div>
            <div class="chevrons chevrons--on-focus chevrons--sm">
              <textarea
                bind:value={editValue}
                rows="3"
                class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text focus:border-border-focus focus:outline-none font-mono text-sm resize-y"
              ></textarea>
            </div>
            <div class="flex gap-2">
              <button type="submit" class="rounded-md bg-primary px-3 py-1.5 text-white text-sm hover:bg-primary-hover transition-colors">
                Update
              </button>
              <button type="button" onclick={() => editingId = null} class="text-text-muted text-sm">Cancel</button>
            </div>
          </form>
        {:else}
          <div class="chevrons chevrons--on-hover chevrons--sm border border-border rounded-md p-4 hover:border-border-focus transition-colors">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <p class="font-mono text-sm font-medium text-text">{secret.name}</p>
                <p class="font-mono text-xs text-text-muted mt-1 truncate">{secret.value.length > 80 ? secret.value.slice(0, 80) + '…' : secret.value}</p>
              </div>
              <div class="flex gap-2 ml-4">
                <button
                  onclick={() => startEdit(secret)}
                  class="text-text-muted hover:text-primary text-sm transition-colors"
                >
                  Edit
                </button>
                <button
                  onclick={() => handleDelete(secret.id, secret.name)}
                  class="text-text-muted hover:text-danger text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            <p class="text-xs text-text-muted mt-2">v{secret.version}</p>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
