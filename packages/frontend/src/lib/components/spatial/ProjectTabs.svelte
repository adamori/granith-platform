<script lang="ts">
  import { page } from '$app/state';

  let { projectId }: { projectId: string } = $props();

  type Tab = { label: string; href: string; exact: boolean };

  const tabs = $derived<Tab[]>([
    { label: 'secrets', href: `/projects/${projectId}`, exact: true },
    { label: 'tokens', href: `/projects/${projectId}/tokens`, exact: false },
    { label: 'approvals', href: `/projects/${projectId}/approvals`, exact: false },
    { label: 'audit', href: `/projects/${projectId}/audit`, exact: false },
  ]);

  function isActive(tab: Tab): boolean {
    const path = page.url.pathname;
    return tab.exact ? path === tab.href : path.startsWith(tab.href);
  }
</script>

<nav class="sp-tabs" aria-label="Project sections">
  {#each tabs as tab (tab.href)}
    <a href={tab.href} class={isActive(tab) ? 'is-active' : ''} aria-current={isActive(tab) ? 'page' : undefined}>
      {tab.label}
    </a>
  {/each}
</nav>
