<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    let raf = 0;
    let target = { x: 0.7, y: 0.3 };
    let cur = { x: 0.7, y: 0.3 };

    function applyVars() {
      const root = document.documentElement;
      root.style.setProperty('--aurora-x', (cur.x * 100).toFixed(2) + '%');
      root.style.setProperty('--aurora-y', (cur.y * 100).toFixed(2) + '%');
      root.style.setProperty('--mx', (cur.x - 0.5).toFixed(3));
      root.style.setProperty('--my', (cur.y - 0.5).toFixed(3));
    }

    function tick() {
      raf = 0;
      cur.x += (target.x - cur.x) * 0.12;
      cur.y += (target.y - cur.y) * 0.12;
      applyVars();
      if (Math.abs(target.x - cur.x) > 0.001 || Math.abs(target.y - cur.y) > 0.001) {
        raf = requestAnimationFrame(tick);
      }
    }

    function onMove(e: PointerEvent) {
      const motion = document.documentElement.getAttribute('data-motion');
      if (motion === 'still') {
        const root = document.documentElement;
        root.style.setProperty('--aurora-x', '70%');
        root.style.setProperty('--aurora-y', '30%');
        root.style.setProperty('--mx', '0');
        root.style.setProperty('--my', '0');
        target = { x: 0.7, y: 0.3 };
        cur = { x: 0.7, y: 0.3 };
        return;
      }
      target = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
      if (!raf) raf = requestAnimationFrame(tick);
    }

    applyVars();
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  });
</script>

<div class="sp-stage">
  <div class="sp-aurora" aria-hidden="true"></div>
  <div class="sp-marks" aria-hidden="true">
    {#each ['tl', 'tr', 'bl', 'br'] as p (p)}
      <svg class={p}>
        <path d="M0 9 L18 9 M9 0 L9 18" stroke="rgba(186,198,232,0.18)" stroke-width="1" />
      </svg>
    {/each}
  </div>
  <div class="sp-content">
    {@render children()}
  </div>
</div>
