<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import Glass from './Glass.svelte';
  import Label from './Label.svelte';
  import SpatialLogo from './SpatialLogo.svelte';

  type Props = {
    handle: string;
    onLogout: () => void;
    children: Snippet;
  };

  let { handle, onLogout, children }: Props = $props();

  const navItems = [
    { key: 'projects', label: 'projects', href: '/projects' },
    { key: 'notifications', label: 'notifications', href: '/notifications' },
    { key: 'settings', label: 'settings', href: '/settings' },
  ];

  const activeKey = $derived.by(() => {
    const path = page.url.pathname;
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/notifications')) return 'notifications';
    return 'projects';
  });
</script>

<div class="sp-topbar">
  <a href="/projects" class="glass sp-parallax sp-topbar__brand" style="--depth: 0.2;">
    <SpatialLogo size={22} />
    <span>granith</span>
    <span class="sp-topbar__divider"></span>
    <Label accent>v1.0</Label>
  </a>

  <Glass depth={0.2} class="sp-topbar__nav">
    {#each navItems as n (n.key)}
      <a href={n.href} class={activeKey === n.key ? 'is-active' : ''}>{n.label}</a>
    {/each}
    <span class="sp-topbar__divider"></span>
    <span style="color: var(--sp-text-muted); font-size: 12px;">{handle}</span>
    <button class="sp-topbar__cta" type="button" onclick={onLogout}>log out</button>
  </Glass>
</div>

<div class="sp-wrap">
  {@render children()}
</div>
