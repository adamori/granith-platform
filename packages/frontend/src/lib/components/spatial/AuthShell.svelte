<script lang="ts">
  import type { Snippet } from 'svelte';
  import Glass from './Glass.svelte';
  import Label from './Label.svelte';
  import SpatialLogo from './SpatialLogo.svelte';
  import LiveTerminal from './LiveTerminal.svelte';

  type Props = {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    footer?: Snippet;
    children: Snippet;
  };

  let { eyebrow, title, subtitle, footer, children }: Props = $props();
</script>

<div class="sp-wrap--auth">
  <div class="auth-grid">
    <div class="auth-grid__left">
      <Glass depth={0.3} style="padding: clamp(28px, 4vw, 44px);">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
          <SpatialLogo size={24} />
          <span style="font: 700 16px var(--sp-font); letter-spacing: -0.01em;">granith</span>
          <span style="width: 1px; height: 14px; background: var(--sp-glass-edge); margin: 0 4px;"></span>
          <Label accent>v1.0</Label>
        </div>
        {#if eyebrow}
          <div style="margin-bottom: 18px;"><Label accent>{eyebrow}</Label></div>
        {/if}
        <h1 class="sp-h1" style="font-size: clamp(32px, 4vw, 44px); margin-bottom: 14px;">{title}</h1>
        {#if subtitle}
          <p class="sp-body" style="margin: 0 0 28px; max-width: 480px;">{subtitle}</p>
        {/if}
        {@render children()}
        {#if footer}
          <p class="sp-mini" style="margin-top: 22px; color: var(--sp-text-muted);">{@render footer()}</p>
        {/if}
      </Glass>
    </div>
    <div class="auth-grid__right">
      <LiveTerminal depth={0.7} />
      <Glass depth={0.4} deep style="padding: 16px 20px; margin-top: 18px;">
        <Label>§ what crosses the wire</Label>
        <p class="sp-mono" style="margin: 12px 0 0; font-size: 12px; line-height: 1.7;">
          Server returned bytes; it never held a key that could read them. Plaintext exists only inside the running application.
        </p>
      </Glass>
    </div>
  </div>
</div>
