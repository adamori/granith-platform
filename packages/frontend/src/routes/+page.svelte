<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { checkSession } from '$lib/stores/auth.svelte.js';

  onMount(async () => {
    const ok = await checkSession();
    if (ok) {
      goto('/projects');
    } else {
      goto('/login');
    }
  });
</script>

<div class="flex h-screen items-center justify-center">
  <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
</div>
