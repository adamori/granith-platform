<script lang="ts">
  let { title, hint }: { title: string; hint?: string } = $props();
</script>

<div class="sp-empty">
  <div>{title}</div>
  {#if hint}<div class="sp-empty__hint">{hint}</div>{/if}
</div>
