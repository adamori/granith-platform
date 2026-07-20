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
  import { Glass, PageHead, Button, Field, Empty } from '$lib/components/spatial';

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
    if (!editingId || !project) return;
    editError = '';
    try {
      await updateSecret(projectId, project.pdk, editingId, editName, editValue);
      editingId = null;
    } catch (e: any) {
      editError = e.message || 'Could not update secret';
    }
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

<PageHead back="projects" backHref="/projects" title={project?.name ?? '…'}>
  {#snippet actions()}
    <Button variant="link" href="/projects/{projectId}/audit">audit</Button>
    <Button variant="link" href="/projects/{projectId}/approvals">approvals</Button>
    <Button variant="bordered" href="/projects/{projectId}/tokens">tokens</Button>
    <Button variant="danger" onclick={handleRotatePDK} disabled={rotating}>
      {rotating ? 'rotating…' : 'rotate keys'}
    </Button>
    <Button onclick={() => (showAdd = !showAdd)}>+ add secret</Button>
  {/snippet}
  <p class="sp-mini" style="margin-top: 4px;">
    {getSecrets().length} secret{getSecrets().length === 1 ? '' : 's'} · wrapped by pdk · 142 bytes / bundle
  </p>
</PageHead>

{#if rotateError}
  <p class="sp-alert sp-alert--danger" style="margin-bottom: 18px;">{rotateError}</p>
{/if}

{#if showAdd}
  <Glass depth={0.3} style="padding: 22px; margin-bottom: 18px;">
    <form onsubmit={handleAdd} style="display: flex; flex-direction: column; gap: 14px;">
      <Field id="new-name" label="Name" bind:value={newName} placeholder="SECRET_NAME" autofocus />
      <Field id="new-value" type="textarea" label="Value" bind:value={newValue} placeholder="Secret value…" rows={3} />
      {#if addError}<p class="sp-alert sp-alert--danger">{addError}</p>{/if}
      <div style="display: flex; gap: 8px;">
        <Button type="submit" disabled={creating || !newName.trim()}>{creating ? '…' : 'save'}</Button>
        <Button variant="link" onclick={() => { showAdd = false; newName = ''; newValue = ''; addError = ''; }}>cancel</Button>
      </div>
    </form>
  </Glass>
{/if}

{#if loading}
  <p class="sp-mini">Loading…</p>
{:else if getSecrets().length === 0}
  <Empty title="No secrets in this project." hint="Add one with the button above, or via the CLI: granith secret put NAME=value" />
{:else}
  <div class="sp-stack">
    {#each getSecrets() as secret, i (secret.id)}
      {#if editingId === secret.id}
        <Glass depth={0.2} style="padding: 20px;">
          <form onsubmit={handleUpdate} style="display: flex; flex-direction: column; gap: 12px;">
            <Field id="en-{secret.id}" label="Name" bind:value={editName} />
            <Field id="ev-{secret.id}" label="Value" type="textarea" bind:value={editValue} rows={3} />
            {#if editError}<p class="sp-alert sp-alert--danger">{editError}</p>{/if}
            <div style="display: flex; gap: 8px;">
              <Button type="submit">update</Button>
              <Button variant="link" onclick={() => { editingId = null; editError = ''; }}>cancel</Button>
            </div>
          </form>
        </Glass>
      {:else}
        <div class="sp-row sp-parallax" style="--depth: {0.1 + (i % 4) * 0.04};">
          <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 0;">
              <p class="sp-row__title" style="margin: 0;">{secret.name}</p>
              <p class="sp-row__value" style="margin: 6px 0 0;">
                {secret.value.length > 80 ? secret.value.slice(0, 80) + '…' : secret.value}
              </p>
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              <Button variant="link" onclick={() => startEdit(secret)}>edit</Button>
              <Button variant="link-danger" onclick={() => handleDelete(secret.id, secret.name)}>delete</Button>
            </div>
          </div>
          <p class="sp-row__version">v{secret.version}</p>
        </div>
      {/if}
    {/each}
  </div>
{/if}
