<script lang="ts">
  import type { Snippet } from 'svelte';
  import SpatialLogo from './SpatialLogo.svelte';
  import Icon from './Icon.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  let {
    eyebrow,
    title,
    subtitle,
    footer,
    children,
  }: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    footer?: Snippet;
    children: Snippet;
  } = $props();
</script>

<main class="auth-layout">
  <aside class="auth-story">
    <a class="auth-brand" href="/login" aria-label="Granith home"
      ><SpatialLogo size={30} />granith<span>.</span></a
    >
    <div class="story-content">
      <span class="story-label">A little peace of mind</span>
      <h2>Good things.<br />Kept secret.</h2>
      <p>One quiet home for your application secrets.<br />Secure by design. Simple by nature.</p>
      <div class="vault-art" aria-hidden="true">
        <div class="vault-outline outline-one"></div>
        <div class="vault-outline outline-two"></div>
        <div class="vault-face">
          <div class="vault-heading">
            <Icon name="lock" size={18} /><span>Your private vault</span><span class="vault-dot"
            ></span>
          </div>
          <div class="vault-secret"><span>DATABASE_URL</span><span>••••••••••••</span></div>
          <div class="vault-secret"><span>API_KEY</span><span>••••••••••••</span></div>
          <div class="vault-secret"><span>APP_SECRET</span><span>••••••••••••</span></div>
          <div class="vault-seal"><Icon name="check" size={15} />Encrypted. Always.</div>
        </div>
      </div>
    </div>
    <div class="story-footer">
      <Icon name="shield" size={18} /><span>Only you hold the keys.</span><span
        class="story-footer-end">Zero knowledge</span
      >
    </div>
  </aside>
  <section class="auth-form-side" aria-label={title}>
    <div class="auth-theme"><ThemeToggle /></div>
    <div class="auth-form">
      <span class="auth-symbol"><Icon name="lock" size={24} /></span>
      {#if eyebrow}<p class="auth-eyebrow">{eyebrow}</p>{/if}
      <h1 class="sp-h1">{title}</h1>
      {#if subtitle}<p class="sp-body auth-subtitle">{subtitle}</p>{/if}
      {@render children()}
      <p class="auth-password-note">
        Your password encrypts your vault keys. That’s why Granith uses a password instead of SSO.
      </p>
      {#if footer}<p class="auth-footer">{@render footer()}</p>{/if}
    </div>
    <p class="auth-assurance">
      <Icon name="shield" size={15} />Your password stays on your device.
    </p>
  </section>
</main>

<style>
  .auth-layout {
    min-height: 100svh;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    padding: 20px;
    gap: 20px;
  }
  .auth-story {
    --sp-accent: #d3e5a1;
    display: flex;
    flex-direction: column;
    background: #183b32;
    color: #f3f5e9;
    border-radius: 16px;
    padding: 36px clamp(30px, 4.5vw, 72px);
    min-height: calc(100svh - 40px);
    overflow: hidden;
  }
  .auth-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -1.3px;
    color: inherit;
    text-decoration: none;
  }
  .auth-brand > span {
    color: #d3e5a1;
    margin-left: -8px;
  }
  .story-content {
    margin: auto 0;
    padding: 60px 0 40px;
  }
  .story-label {
    color: #c7d9af;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: 500;
  }
  h2 {
    margin: 20px 0;
    font: 500 clamp(42px, 4.8vw, 72px)/1.06 var(--sp-font);
    letter-spacing: -0.06em;
  }
  .story-content > p {
    color: #c0d0c5;
    font-size: 14px;
    line-height: 1.8;
    margin: 0;
  }
  .vault-art {
    position: relative;
    max-width: 350px;
    margin: 58px auto 28px;
  }
  .vault-outline {
    position: absolute;
    inset: -13px 5px;
    border: 1px solid #69816a;
    border-radius: 16px;
    transform: rotate(-8deg);
  }
  .outline-two {
    inset: -24px 14px;
    border-color: #456449;
    transform: rotate(-15deg);
  }
  .vault-face {
    position: relative;
    background: #25473b;
    border: 1px solid #78906a;
    border-radius: 12px;
    padding: 22px;
  }
  .vault-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 22px;
    color: #e4eecf;
    font-size: 12px;
  }
  .vault-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-left: auto;
    background: #d3e5a1;
  }
  .vault-secret {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-top: 1px solid #4b6450;
    padding: 14px 0;
    font: 10px var(--sp-mono);
    color: #c8d8c4;
  }
  .vault-secret > span:last-child {
    color: #d3e5a1;
    letter-spacing: 2px;
  }
  .vault-seal {
    position: absolute;
    right: -12px;
    bottom: -16px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 14px;
    border-radius: 6px;
    background: #d3e5a1;
    color: #254332;
    font-size: 11px;
    font-weight: 600;
    transform: rotate(-4deg);
  }
  .story-footer {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 11px;
    color: #c0d0c5;
    margin-top: 24px;
  }
  .story-footer-end {
    margin-left: auto;
  }
  .auth-theme {
    position: absolute;
    top: 16px;
    right: 16px;
  }
  .auth-form-side {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px clamp(24px, 4.5vw, 72px) 32px;
  }
  .auth-form {
    width: 100%;
    max-width: 390px;
    margin-block: auto;
    padding-block: 40px;
  }
  .auth-symbol {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border: 1px solid var(--sp-glass-edge);
    border-radius: 14px;
    color: var(--sp-accent);
    background: var(--sp-accent-soft);
    margin-bottom: 30px;
  }
  .auth-eyebrow {
    color: var(--sp-accent);
    font-size: 12px;
    font-weight: 600;
    margin: 0 0 12px;
  }
  .sp-h1 {
    font-size: clamp(30px, 3vw, 40px);
  }
  .auth-subtitle {
    font-size: 14px;
    margin: 16px 0 32px;
    line-height: 1.8;
  }
  .auth-footer {
    font-size: 13px;
    color: var(--sp-text-muted);
    margin: 28px 0 0;
  }
  .auth-password-note {
    font-size: 12px;
    line-height: 1.7;
    color: var(--sp-text-muted);
    margin: 20px 0 0;
  }
  .auth-assurance {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 24px 0 0;
    font-size: 11px;
    color: var(--sp-text-muted);
  }
  @media (max-width: 1000px) {
    .auth-story {
      padding-inline: 32px;
    }
    .story-footer-end {
      display: none;
    }
    .vault-art {
      margin-top: 48px;
    }
  }
  @media (max-width: 760px) {
    .auth-layout {
      display: flex;
      flex-direction: column;
      padding: 0;
      gap: 0;
    }
    .auth-story {
      min-height: 0;
      padding: 24px;
      border-radius: 0;
    }
    .auth-brand {
      font-size: 25px;
    }
    .story-content,
    .story-footer {
      display: none;
    }
    .auth-theme {
      position: absolute;
      top: 16px;
      right: 16px;
    }
    .auth-form-side {
      position: relative;
      flex: 1;
      padding: 56px 26px 32px;
    }
    .auth-form {
      padding: 10px 0 26px;
    }
    .auth-symbol {
      margin-bottom: 24px;
    }
  }
</style>
