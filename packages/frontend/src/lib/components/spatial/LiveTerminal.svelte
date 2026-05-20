<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Glass from './Glass.svelte';

  type Line = {
    text: string;
    color?: string;
    prefix?: { text: string; color?: string };
  };

  let { depth = 0.6 }: { depth?: number } = $props();

  const lines: Line[] = [
    { prefix: { text: '$ ', color: 'var(--sp-text-muted)' }, text: 'granith run -- node server.js', color: 'var(--sp-text)' },
    { prefix: { text: '▸ ', color: 'var(--sp-accent)' }, text: 'fetched bundle · 3 secrets' },
    { prefix: { text: '▸ ', color: 'var(--sp-accent)' }, text: 'wire saw 142 bytes of ciphertext' },
    { prefix: { text: '▸ ', color: 'var(--sp-accent)' }, text: 'decrypted in 11ms · pid 38172' },
    { text: 'listening on :3000', color: 'var(--sp-success)' },
  ];

  const startDelay = 600;
  const charDelay = 22;
  const lineDelay = 320;
  const loopAfter = 4500;

  let progress = $state({ line: 0, char: 0 });
  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;

  function step(line: number, char: number) {
    if (!alive) return;
    if (line >= lines.length) {
      done = true;
      timer = setTimeout(() => {
        if (!alive) return;
        done = false;
        step(0, 0);
      }, loopAfter);
      return;
    }
    const txt = lines[line].text;
    if (char > txt.length) {
      timer = setTimeout(() => step(line + 1, 0), lineDelay);
      return;
    }
    progress = { line, char };
    timer = setTimeout(() => step(line, char + 1), charDelay);
  }

  onMount(() => {
    timer = setTimeout(() => step(0, 0), startDelay);
  });

  onDestroy(() => {
    alive = false;
    if (timer) clearTimeout(timer);
  });

  function lineText(i: number): string {
    const ln = lines[i];
    if (i < progress.line) return ln.text;
    if (i === progress.line) return ln.text.slice(0, progress.char);
    return '';
  }
</script>

<Glass {depth} accent style="padding: 20px 24px 22px;">
  <div class="sp-term__bar">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span class="sp-term__dots">
        <span style="--c: #3a4252;"></span>
        <span style="--c: #3a4458;"></span>
        <span style="--c: #3a525c;"></span>
      </span>
      <span>~ · zsh · granith run</span>
    </div>
    <span>live</span>
  </div>
  <pre class="sp-term__pre" style="min-height: {9 * 22}px;">{#each lines as ln, i (i)}{#if i <= progress.line}<div>{#if ln.prefix}<span style="color: {ln.prefix.color ?? 'var(--sp-accent)'};">{ln.prefix.text}</span>{/if}<span style="color: {ln.color ?? 'var(--sp-text-soft)'};">{lineText(i)}</span></div>{/if}{/each}{#if !done}<span class="sp-caret"></span>{/if}</pre>
</Glass>
