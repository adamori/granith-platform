<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import { listTokens, createToken, revokeToken, patchToken } from '$lib/api/tokens.js';
  import type { TokenResponse } from '$lib/api/tokens.js';
  import { generateTokenPair, wrapPDKForToken } from '$lib/crypto/keys.js';
  import { createHashAsync } from '$lib/crypto/hash.js';
  import { toBase64, toBase64Standard, toHex } from '$lib/crypto/sodium.js';

  const projectId = $derived(page.params.id!);
  const project = $derived(getProjectById(projectId));

  let tokens = $state<TokenResponse[]>([]);
  let loading = $state(true);
  let showMint = $state(false);
  let minting = $state(false);
  let mintedToken = $state<string | null>(null);
  let copied = $state(false);
  let ttlDays = $state(90);
  let editingTokenId = $state<string | null>(null);
  let allowlistInput = $state('');
  let savingAllowlist = $state(false);

  onMount(async () => {
    if (!project) await loadProjects();
    const res = await listTokens(projectId);
    tokens = res.tokens;
    loading = false;
  });

  async function handleMint() {
    if (!project) return;
    minting = true;
    try {
      const { lookupId, tokenKey, rawToken } = generateTokenPair();
      const tokenId = await createHashAsync(lookupId);
      const { wrapped, nonce } = wrapPDKForToken(project.pdk, tokenKey);

      await createToken(projectId, {
        token_id: toHex(tokenId),
        wrapped_pdk: toBase64Standard(wrapped),
        wrap_nonce: toBase64Standard(nonce),
        scopes: { read: true },
        label_ct: null,
        label_nonce: null,
        ip_allowlist: null,
        expires_at: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      });

      mintedToken = rawToken;
      showMint = false;

      const res = await listTokens(projectId);
      tokens = res.tokens;
    } finally {
      minting = false;
    }
  }

  async function handleCopy() {
    if (!mintedToken) return;
    await navigator.clipboard.writeText(mintedToken);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function dismissToken() {
    mintedToken = null;
  }

  async function handleRevoke(tokenId: string) {
    if (!confirm('Revoke this token? Running services will lose access.')) return;
    await revokeToken(tokenId);
    const res = await listTokens(projectId);
    tokens = res.tokens;
  }

  function startEditAllowlist(token: TokenResponse) {
    editingTokenId = token.token_id;
    allowlistInput = token.ip_allowlist?.join(', ') ?? '';
  }

  async function saveAllowlist() {
    if (!editingTokenId) return;
    savingAllowlist = true;
    try {
      const raw = allowlistInput.trim();
      const ip_allowlist = raw ? raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean) : null;
      await patchToken(editingTokenId, { ip_allowlist });
      editingTokenId = null;
      const res = await listTokens(projectId);
      tokens = res.tokens;
    } finally {
      savingAllowlist = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <a href="/projects/{projectId}" class="text-text-muted text-sm hover:text-primary transition-colors">&larr; {project?.name ?? 'Project'}</a>
      <h1 class="text-xl font-bold mt-1">Tokens</h1>
    </div>
    <button
      onclick={() => showMint = !showMint}
      class="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover transition-colors"
    >
      + Mint Token
    </button>
  </div>

  {#if mintedToken}
    <div class="chevrons chevrons--success chevrons--lg border border-success/60 rounded-md p-4 space-y-3 bg-surface-raised/30 shadow-[0_0_30px_-10px_rgba(34,197,94,0.4)]">
      <p class="text-sm font-medium text-success">Token minted — copy it now. You won't see it again.</p>
      <div class="bg-surface-raised rounded-md p-3 font-mono text-xs break-all text-text">
        {mintedToken}
      </div>
      <div class="flex gap-2">
        <button
          onclick={handleCopy}
          class="rounded-md bg-success px-3 py-1.5 text-sm text-white hover:opacity-90 transition-opacity"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onclick={dismissToken}
          class="text-text-muted text-sm hover:text-text transition-colors"
        >
          Dismiss
        </button>
      </div>
      <p class="text-xs text-text-muted">Hint: your clipboard will NOT auto-clear. Clear it manually within 10 minutes.</p>
    </div>
  {/if}

  {#if showMint}
    <div class="border border-border rounded-md p-4 space-y-3">
      <div>
        <label for="ttl" class="block text-sm text-text-muted mb-1">TTL (days)</label>
        <div class="chevrons chevrons--on-focus chevrons--sm w-32">
          <input
            id="ttl"
            type="number"
            bind:value={ttlDays}
            min="1"
            max="1095"
            class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text focus:border-border-focus focus:outline-none text-sm"
          />
        </div>
      </div>
      <div class="flex gap-2">
        <button
          onclick={handleMint}
          disabled={minting}
          class="rounded-md bg-primary px-4 py-2 text-white text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {minting ? 'Minting…' : 'Mint'}
        </button>
        <button
          onclick={() => showMint = false}
          class="text-text-muted text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="text-text-muted">Loading…</p>
  {:else if tokens.length === 0}
    <p class="text-text-muted text-center py-8">No tokens minted yet.</p>
  {:else}
    <div class="space-y-2">
      {#each tokens as token (token.token_id)}
        <div class="chevrons chevrons--sm border border-border rounded-md p-4 space-y-2 {token.revoked_at ? 'opacity-50' : ''} {editingTokenId === token.token_id ? 'chevrons--strong' : 'chevrons--on-hover'}">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-mono text-xs text-text">{token.token_id.slice(0, 16)}…</p>
              <div class="flex gap-3 mt-1 text-xs text-text-muted">
                <span>Expires {new Date(token.expires_at).toLocaleDateString()}</span>
                {#if token.last_used_at}
                  <span>Used {new Date(token.last_used_at).toLocaleDateString()}</span>
                {/if}
                {#if token.ip_allowlist?.length}
                  <span>IPs: {token.ip_allowlist.join(', ')}</span>
                {/if}
                {#if token.revoked_at}
                  <span class="text-danger">Revoked</span>
                {/if}
              </div>
            </div>
            {#if !token.revoked_at}
              <div class="flex gap-2">
                <button
                  onclick={() => startEditAllowlist(token)}
                  class="text-text-muted hover:text-primary text-sm transition-colors"
                >
                  IP Rules
                </button>
                <button
                  onclick={() => handleRevoke(token.token_id)}
                  class="text-text-muted hover:text-danger text-sm transition-colors"
                >
                  Revoke
                </button>
              </div>
            {/if}
          </div>

          {#if editingTokenId === token.token_id}
            <div class="border-t border-border pt-2 space-y-2">
              <label class="block text-xs text-text-muted">IP Allowlist (CIDR, comma or newline separated, empty = unrestricted)</label>
              <div class="chevrons chevrons--on-focus chevrons--sm">
                <textarea
                  bind:value={allowlistInput}
                  rows="2"
                  placeholder="192.168.1.0/24, 10.0.0.1/32"
                  class="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-text text-xs font-mono focus:border-border-focus focus:outline-none resize-y"
                ></textarea>
              </div>
              <div class="flex gap-2">
                <button
                  onclick={saveAllowlist}
                  disabled={savingAllowlist}
                  class="rounded-md bg-primary px-3 py-1 text-xs text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
                >
                  {savingAllowlist ? 'Saving…' : 'Save'}
                </button>
                <button
                  onclick={() => editingTokenId = null}
                  class="text-text-muted text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
