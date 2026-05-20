<script lang="ts">
  let { size = 22 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <path d="M16 2 L28 8 L28 24 L16 30 L4 24 L4 8 Z" fill="none" stroke="var(--sp-accent)" stroke-width="1.4" />
  <path d="M16 9 L22 12 L22 20 L16 23" fill="none" stroke="var(--sp-accent)" stroke-width="1.4" />
  <circle cx="11" cy="16" r="1.6" fill="var(--sp-accent)" />
</svg>
