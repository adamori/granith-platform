<script lang="ts">
  import { goto } from '$app/navigation';
  import { getProjects, loadProjects } from '$lib/stores/projects.svelte.js';
  import { isPaletteOpen, setPaletteOpen, togglePalette } from '$lib/stores/ui.svelte.js';

  type Item = { label: string; kind: 'page' | 'project' | 'action'; href?: string; action?: () => void };

  let { onLogout }: { onLogout: () => void } = $props();

  let query = $state('');
  let active = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null);

  const baseItems = $derived<Item[]>([
    { label: 'projects', kind: 'page', href: '/projects' },
    { label: 'notifications', kind: 'page', href: '/notifications' },
    { label: 'settings', kind: 'page', href: '/settings' },
    { label: 'log out', kind: 'action', action: onLogout },
  ]);

  function subpages(id: string, name: string): Item[] {
    return [
      { label: name, kind: 'project', href: `/projects/${id}` },
      { label: `${name} · tokens`, kind: 'project', href: `/projects/${id}/tokens` },
      { label: `${name} · approvals`, kind: 'project', href: `/projects/${id}/approvals` },
      { label: `${name} · audit`, kind: 'project', href: `/projects/${id}/audit` },
    ];
  }

  function matches(label: string, q: string): boolean {
    const l = label.toLowerCase();
    let i = 0;
    for (const ch of q.toLowerCase()) {
      i = l.indexOf(ch, i);
      if (i === -1) return false;
      i += 1;
    }
    return true;
  }

  const items = $derived.by(() => {
    const q = query.trim();
    if (!q) {
      return [
        ...baseItems,
        ...getProjects().map<Item>((p) => ({ label: p.name, kind: 'project', href: `/projects/${p.id}` })),
      ].slice(0, 12);
    }
    const all = [...baseItems, ...getProjects().flatMap((p) => subpages(p.id, p.name))];
    return all.filter((it) => matches(it.label, q)).slice(0, 12);
  });

  $effect(() => {
    if (isPaletteOpen()) {
      query = '';
      active = 0;
      if (getProjects().length === 0) loadProjects().catch(() => {});
      setTimeout(() => inputEl?.focus(), 0);
    }
  });

  $effect(() => {
    if (active >= items.length) active = 0;
  });

  function select(item: Item) {
    setPaletteOpen(false);
    if (item.href) goto(item.href);
    item.action?.();
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      togglePalette();
      return;
    }
    if (!isPaletteOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setPaletteOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[active];
      if (item) select(item);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if isPaletteOpen()}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="sp-cmdk-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) setPaletteOpen(false);
    }}
  >
    <div class="sp-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
      <input
        class="sp-cmdk__input"
        type="text"
        placeholder="Jump to…"
        bind:value={query}
        bind:this={inputEl}
        aria-label="Search"
      />
      {#if items.length === 0}
        <div class="sp-cmdk__empty">Nothing matches "{query}"</div>
      {:else}
        <ul class="sp-cmdk__list" role="listbox">
          {#each items as item, i (item.kind + item.label)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <li
              class="sp-cmdk__item {i === active ? 'is-active' : ''}"
              role="option"
              aria-selected={i === active}
              onclick={() => select(item)}
              onmouseenter={() => (active = i)}
            >
              <span>{item.label}</span>
              <span class="sp-cmdk__kind">{item.kind}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="sp-cmdk__foot">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </div>
  </div>
{/if}
