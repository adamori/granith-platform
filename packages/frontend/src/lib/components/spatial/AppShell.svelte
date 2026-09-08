<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import SpatialLogo from './SpatialLogo.svelte';
  import Icon from './Icon.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import { togglePalette } from '$lib/stores/ui.svelte.js';

  let { handle, onLogout, children }: { handle: string; onLogout: () => void; children: Snippet } =
    $props();

  const navItems = [
    { key: 'projects', label: 'Projects', href: '/projects', icon: 'projects' },
    { key: 'notifications', label: 'Notifications', href: '/notifications', icon: 'bell' },
    { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
  ] as const;
  const activeItem = $derived(
    navItems.find((item) => page.url.pathname.startsWith(item.href)) ?? navItems[0],
  );
</script>

<div class="workspace">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <aside class="sidebar">
    <a href="/projects" class="brand" aria-label="Granith home">
      <span class="brand-mark"><SpatialLogo size={29} /></span>
      <span>granith<span class="brand-period">.</span></span>
    </a>
    <div class="sidebar-label">Your workspace</div>
    <nav aria-label="Main navigation">
      {#each navItems as item (item.key)}
        <a
          href={item.href}
          class:active={activeItem.key === item.key}
          aria-current={activeItem.key === item.key ? 'page' : undefined}
        >
          <Icon name={item.icon} size={19} /><span>{item.label}</span>
          {#if activeItem.key === item.key}<span class="nav-dot"></span>{/if}
        </a>
      {/each}
    </nav>
    <div class="sidebar-bottom">
      <div class="privacy-note">
        <Icon name="shield" size={23} />
        <strong>Yours. And only yours.</strong>
        <p>Your secrets are encrypted before they reach our servers.</p>
      </div>
      <div class="account">
        <span class="avatar">{handle.slice(0, 1).toUpperCase()}</span>
        <div class="account-name"><strong>{handle}</strong><span>Personal workspace</span></div>
        <button type="button" onclick={onLogout} aria-label="Log out" title="Log out"
          ><Icon name="logout" size={18} /></button
        >
      </div>
    </div>
  </aside>
  <div class="workspace-body">
    <header class="workspace-bar">
      <div class="breadcrumb">
        <span>Workspace</span><span aria-hidden="true">/</span><span>{activeItem.label}</span>
      </div>
      <div class="header-actions">
        <button class="quick-search" type="button" onclick={togglePalette}>
          <Icon name="search" size={16} /><span>Quick search</span><kbd>⌘ / Ctrl K</kbd>
        </button>
        <ThemeToggle />
      </div>
    </header>
    <main id="main-content" class="sp-wrap" tabindex="-1">
      {@render children()}
    </main>
  </div>
</div>
<CommandPalette {onLogout} />

<style>
  .workspace {
    min-height: 100svh;
  }
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;
    width: 244px;
    padding: 35px 20px 18px;
    background: var(--sp-sidebar);
    color: #f8f9f3;
    display: flex;
    flex-direction: column;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    color: inherit;
    text-decoration: none;
    font: 700 29px var(--sp-font);
    letter-spacing: -1.4px;
  }
  .brand-mark {
    --sp-accent: #d3e5a1;
    display: flex;
  }
  .brand-period {
    color: #d3e5a1;
  }
  .sidebar-label {
    margin: 53px 14px 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: #acc4ba;
  }
  nav {
    display: grid;
    gap: 6px;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 46px;
    padding: 12px 14px;
    border-radius: 8px;
    color: #d4e2da;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: background 150ms ease;
  }
  nav a:hover {
    background: #254c40;
    color: #fff;
  }
  nav a.active {
    background: #d3e5a1;
    color: #19372d;
    font-weight: 700;
  }
  .nav-dot {
    width: 6px;
    height: 6px;
    margin-left: auto;
    border-radius: 50%;
    background: currentColor;
  }
  .sidebar-bottom {
    margin-top: auto;
    padding-top: 60px;
  }
  .privacy-note {
    padding: 20px 14px 28px;
    color: #d3e5a1;
  }
  .privacy-note strong {
    display: block;
    margin-top: 12px;
    font-size: 13px;
    font-weight: 600;
    color: #e9efdf;
  }
  .privacy-note p {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: #b9cdc3;
  }
  .account {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 4px 0;
    border-top: 1px solid #3b594d;
  }
  .avatar {
    display: grid;
    place-items: center;
    flex: 0 0 34px;
    height: 34px;
    background: #325347;
    border: 1px solid #537063;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 600;
  }
  .account-name {
    min-width: 0;
    flex: 1;
  }
  .account-name strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
  }
  .account-name span {
    display: block;
    color: #b9cdc3;
    font-size: 10px;
    margin-top: 4px;
  }
  .account button {
    display: grid;
    place-items: center;
    width: 34px;
    height: 36px;
    border: 0;
    border-radius: 6px;
    color: #d4e2da;
    background: transparent;
    cursor: pointer;
  }
  .account button:hover {
    background: #325347;
  }
  .workspace-body {
    margin-left: 244px;
  }
  .workspace-bar {
    min-height: 86px;
    padding: 20px clamp(24px, 4vw, 58px);
    border-bottom: 1px solid var(--sp-glass-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 12px;
    color: var(--sp-text-muted);
  }
  .breadcrumb span:last-child {
    color: var(--sp-text);
    font-weight: 600;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .quick-search {
    display: flex;
    align-items: center;
    gap: 9px;
    background: transparent;
    color: var(--sp-text-muted);
    border: 0;
    padding: 8px 0 8px 8px;
    cursor: pointer;
    font: 400 12px var(--sp-font);
  }
  .quick-search:hover {
    color: var(--sp-accent);
  }
  kbd {
    padding: 4px 6px;
    border: 1px solid var(--sp-glass-border);
    border-radius: 4px;
    font: 10px var(--sp-font);
  }
  @media (max-width: 1000px) {
    .sidebar {
      width: 210px;
      padding-inline: 14px;
    }
    .workspace-body {
      margin-left: 210px;
    }
  }
  @media (max-width: 760px) {
    .sidebar {
      position: static;
      width: auto;
      padding: 20px 20px 12px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
    }
    .brand {
      font-size: 25px;
      padding: 0;
    }
    .sidebar-label,
    .privacy-note,
    .account-name,
    .avatar,
    .nav-dot {
      display: none;
    }
    nav {
      grid-column: 1 / -1;
      grid-row: 2;
      display: flex;
      gap: 6px;
    }
    nav a {
      flex: 1;
      justify-content: center;
      padding: 10px 8px;
      font-size: 12px;
      min-height: 42px;
      gap: 7px;
    }
    .sidebar-bottom {
      padding: 0;
      margin: 0;
      grid-row: 1;
      grid-column: 2;
    }
    .account {
      padding: 0;
      border: 0;
    }
    .workspace-body {
      margin-left: 0;
    }
    .workspace-bar {
      min-height: 65px;
      padding: 12px 22px;
    }
    .quick-search kbd {
      display: none;
    }
    .header-actions {
      gap: 12px;
    }
  }
  @media (max-width: 480px) {
    .quick-search span {
      display: none;
    }
    .quick-search {
      padding: 8px;
    }
    .header-actions {
      gap: 5px;
    }
  }
  @media (max-width: 380px) {
    nav a {
      gap: 5px;
      font-size: 11px;
    }
    .sidebar {
      padding-inline: 12px;
    }
  }
</style>
