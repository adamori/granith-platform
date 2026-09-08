<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  let dark = $state(false);

  function applyTheme(value: boolean) {
    dark = value;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#151e1a' : '#f6f7f2');
  }

  function toggleTheme() {
    applyTheme(!dark);
    try {
      localStorage.setItem('granith-theme', dark ? 'dark' : 'light');
    } catch {}
  }

  onMount(() => {
    dark = document.documentElement.dataset.theme === 'dark';
    function syncTheme(event: StorageEvent) {
      if (event.key === 'granith-theme' || event.key === null)
        applyTheme(event.newValue === 'dark');
    }
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  });
</script>

<button
  class="theme-toggle"
  type="button"
  onclick={toggleTheme}
  aria-label="Switch to {dark ? 'light' : 'dark'} theme"
  title="Switch to {dark ? 'light' : 'dark'} theme"
>
  <Icon name={dark ? 'sun' : 'moon'} size={17} /><span>{dark ? 'Light' : 'Dark'}</span>
</button>

<style>
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 36px;
    min-height: 36px;
    padding: 8px 10px;
    border: 1px solid var(--sp-glass-border);
    border-radius: 7px;
    background: var(--sp-glass-bg);
    color: var(--sp-text-soft);
    font: 500 12px var(--sp-font);
    cursor: pointer;
    transition:
      background 150ms ease,
      border-color 150ms ease;
  }
  .theme-toggle:hover {
    background: var(--sp-accent-soft);
    border-color: var(--sp-accent-dim);
    color: var(--sp-accent);
  }
  @media (max-width: 480px) {
    .theme-toggle span {
      display: none;
    }
  }
</style>
