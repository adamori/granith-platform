<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { getProjectById, loadProjects } from '$lib/stores/projects.svelte.js';
  import { listTokens, createToken, revokeToken, patchToken } from '$lib/api/tokens.js';
  import type { TokenResponse } from '$lib/api/tokens.js';
  import { generateTokenPair, wrapPDKForToken } from '$lib/crypto/keys.js';
  import { createHashAsync } from '$lib/crypto/hash.js';
  import { toBase64Standard, toHex } from '$lib/crypto/sodium.js';
  import { Glass, PageHead, Button, Field, Empty } from '$lib/components/spatial';

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

  const liveCount = $derived(tokens.filter((t) => !t.revoked_at).length);
</script>

<PageHead back={project?.name ?? 'Project'} backHref="/projects/{projectId}" title="Tokens">
  {#snippet actions()}
    <Button onclick={() => (showMint = !showMint)}>+ mint token</Button>
  {/snippet}
  <p class="sp-mini" style="margin-top: 4px;">
    {liveCount} live · {tokens.length - liveCount} revoked · each token authorizes bundle.fetch on this project
  </p>
</PageHead>

{#if mintedToken}
  <div class="sp-reveal sp-parallax" style="--depth: 0.4; margin-bottom: 18px;">
    <p class="sp-reveal__title">▸ token minted — copy it now. you won't see it again.</p>
    <div class="sp-reveal__value">{mintedToken}</div>
    <div class="sp-reveal__row">
      <Button variant="primary" onclick={handleCopy}>{copied ? 'copied' : 'copy'}</Button>
      <Button variant="link" onclick={dismissToken}>dismiss</Button>
    </div>
    <p class="sp-reveal__hint">hint: your clipboard will NOT auto-clear. clear it manually within 10 minutes.</p>
  </div>
{/if}

{#if showMint}
  <Glass depth={0.3} style="padding: 22px; margin-bottom: 18px;">
    <div style="display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap;">
      <div style="min-width: 200px;">
        <Field id="ttl" label="TTL (days)" type="number" bind:value={ttlDays} min={1} max={1095} />
      </div>
      <Button onclick={handleMint} disabled={minting}>{minting ? 'minting…' : 'mint'}</Button>
      <Button variant="link" onclick={() => (showMint = false)}>cancel</Button>
    </div>
    <p class="sp-mini" style="margin-top: 14px;">
      tokens expire after the ttl, or until you revoke them — whichever first.
    </p>
  </Glass>
{/if}

{#if loading}
  <p class="sp-mini">Loading…</p>
{:else if tokens.length === 0}
  <Empty title="No tokens minted yet." hint="Mint one to let a service fetch this project's bundle." />
{:else}
  <div class="sp-stack">
    {#each tokens as token, i (token.token_id)}
      <div
        class="sp-row sp-parallax {token.revoked_at ? 'sp-row--revoked' : ''}"
        style="--depth: {0.1 + (i % 4) * 0.04};"
      >
        <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 0;">
            <p style="margin: 0; font: 500 13px var(--sp-font); color: var(--sp-text); letter-spacing: -0.01em;">
              {token.token_id.slice(0, 16)}…
            </p>
            <div style="display: flex; gap: 14px; margin-top: 6px; font-size: 11px; color: var(--sp-text-muted); flex-wrap: wrap; font-family: var(--sp-font);">
              <span>expires {new Date(token.expires_at).toLocaleDateString()}</span>
              {#if token.last_used_at}
                <span>used {new Date(token.last_used_at).toLocaleDateString()}</span>
              {:else}
                <span style="color: var(--sp-text-dim);">never used</span>
              {/if}
              {#if token.ip_allowlist?.length}
                <span>ip: {token.ip_allowlist.join(', ')}</span>
              {/if}
              {#if token.revoked_at}
                <span style="color: var(--sp-danger);">· revoked</span>
              {/if}
            </div>
          </div>
          {#if !token.revoked_at}
            <div style="display: flex; gap: 4px;">
              <Button variant="link" onclick={() => startEditAllowlist(token)}>ip rules</Button>
              <Button variant="link-danger" onclick={() => handleRevoke(token.token_id)}>revoke</Button>
            </div>
          {/if}
        </div>
        {#if editingTokenId === token.token_id}
          <div style="border-top: 1px solid var(--sp-glass-border); padding-top: 14px; margin-top: 14px; display: flex; flex-direction: column; gap: 10px;">
            <Field
              id="al-{token.token_id}"
              label="IP allowlist (CIDR, comma or newline separated, empty = unrestricted)"
              type="textarea"
              bind:value={allowlistInput}
              placeholder="192.168.1.0/24, 10.0.0.1/32"
              rows={2}
            />
            <div style="display: flex; gap: 8px;">
              <Button onclick={saveAllowlist} disabled={savingAllowlist}>{savingAllowlist ? 'saving…' : 'save'}</Button>
              <Button variant="link" onclick={() => (editingTokenId = null)}>cancel</Button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
