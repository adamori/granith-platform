<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkSession } from '$lib/stores/auth.svelte.js';

  onMount(async () => {
    const ok = await checkSession();
    goto(ok ? '/projects' : '/login');
  });
</script>

<div style="min-height: 100vh; display: grid; place-items: center;">
  <p class="sp-mini">Loading…</p>
</div>
