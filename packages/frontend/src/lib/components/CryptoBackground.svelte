<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = mql.matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;

    const DIRS: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ];
    const HEX = '0123456789ABCDEF';

    type Pip = { ch: string; x: number; y: number; t: number; life: number };

    type Streak = {
      x: number;
      y: number;
      dir: 0 | 1 | 2 | 3;
      speed: number;
      nodes: { x: number; y: number }[];
      maxTrail: number;
      segLeft: number;
      hue: number;
      alpha: number;
      pips: Pip[];
      life: number;
      fadeOutAt: number;
      ttl: number;
      age: number;
    };

    const streaks: Streak[] = [];
    let raf = 0;

    // mouse state (device-pixel coords)
    let mouseX = -1e6;
    let mouseY = -1e6;
    let mouseActive = false;
    const PROX_RADIUS_CSS = 130;
    let PROX_R = PROX_RADIUS_CSS * dpr;
    let PROX_R2 = PROX_R * PROX_R;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      PROX_R = PROX_RADIUS_CSS * dpr;
      PROX_R2 = PROX_R * PROX_R;
    }

    function spawn(): Streak {
      const dir = ((Math.random() * 4) | 0) as 0 | 1 | 2 | 3;
      const W = width * dpr;
      const H = height * dpr;
      const x = Math.random() * W;
      const y = Math.random() * H;
      const pick = Math.random();
      const hue =
        pick < 0.7 ? 225 + Math.random() * 20 : pick < 0.95 ? 185 + Math.random() * 20 : 270 + Math.random() * 10;
      const ttl = 4 + Math.random() * 6;
      return {
        x,
        y,
        dir,
        speed: (50 + Math.random() * 120) * dpr,
        nodes: [{ x, y }],
        maxTrail: 6 + ((Math.random() * 5) | 0),
        segLeft: (30 + Math.random() * 120) * dpr,
        hue,
        alpha: 0.12 + Math.random() * 0.16,
        pips: [],
        life: 1,
        fadeOutAt: 0.25,
        ttl,
        age: 0
      };
    }

    function populate() {
      streaks.length = 0;
      const area = width * height;
      const target = reduced ? 12 : Math.max(20, Math.min(70, Math.round(area / 28000)));
      for (let i = 0; i < target; i++) {
        const s = spawn();
        s.age = Math.random() * s.ttl * 0.6;
        streaks.push(s);
      }
    }

    resize();
    populate();

    const onResize = () => {
      resize();
      populate();
    };
    window.addEventListener('resize', onResize);
    const onMotion = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      populate();
    };
    mql.addEventListener?.('change', onMotion);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) * dpr;
      mouseY = (e.clientY - rect.top) * dpr;
      mouseActive = true;
    };
    const onMouseOut = () => {
      mouseActive = false;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseOut);

    let last = performance.now();

    function proximityBoost(mx: number, my: number): number {
      if (!mouseActive) return 0;
      const dx = mx - mouseX;
      const dy = my - mouseY;
      const d2 = dx * dx + dy * dy;
      if (d2 > PROX_R2) return 0;
      const k = 1 - Math.sqrt(d2) / PROX_R;
      return k * k; // squared falloff
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const W = width * dpr;
      const H = height * dpr;

      ctx!.clearRect(0, 0, W, H);
      ctx!.lineWidth = 1;
      ctx!.lineCap = 'butt';

      for (const s of streaks) {
        s.age += dt;
        if (s.age >= s.ttl) {
          Object.assign(s, spawn());
          continue;
        }
        const t = s.age / s.ttl;
        const fadeIn = Math.min(1, t / 0.12);
        const fadeOut = t > 1 - s.fadeOutAt ? Math.max(0, (1 - t) / s.fadeOutAt) : 1;
        s.life = fadeIn * fadeOut;

        const [dx, dy] = DIRS[s.dir];
        const step = s.speed * dt;
        s.x += dx * step;
        s.y += dy * step;
        s.segLeft -= step;

        const head = s.nodes[s.nodes.length - 1];
        head.x = s.x;
        head.y = s.y;

        if (s.segLeft <= 0) {
          s.segLeft = (40 + Math.random() * 160) * dpr;
          if (Math.random() < 0.6) {
            const turn = Math.random() < 0.5 ? 1 : -1;
            s.dir = (((s.dir + turn + 4) % 4) as 0 | 1 | 2 | 3);
            s.nodes.push({ x: s.x, y: s.y });
            s.nodes.push({ x: s.x, y: s.y });
            s.pips.push({
              ch: HEX[(Math.random() * 16) | 0],
              x: s.x,
              y: s.y,
              t: 1,
              life: 1.2 + Math.random() * 0.8
            });
            while (s.nodes.length > s.maxTrail) s.nodes.shift();
          }
        }

        const pad = 40 * dpr;
        if (s.x < -pad || s.x > W + pad || s.y < -pad || s.y > H + pad) {
          Object.assign(s, spawn());
          continue;
        }

        const N = s.nodes.length;
        if (N >= 2) {
          for (let i = 0; i < N - 1; i++) {
            const a = s.nodes[i];
            const b = s.nodes[i + 1];
            const segHead = (i + 1) / (N - 1);
            const segTail = i / (N - 1);

            // proximity boost based on segment midpoint
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            const prox = proximityBoost(mx, my);
            const aBoost = 1 + prox * 2.6;
            const lightBoost = prox * 12;

            const grad = ctx!.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(
              0,
              `hsla(${s.hue}, 70%, ${70 + lightBoost}%, ${Math.min(1, s.alpha * s.life * segTail * 0.9 * aBoost)})`
            );
            grad.addColorStop(
              1,
              `hsla(${s.hue}, 80%, ${78 + lightBoost}%, ${Math.min(1, s.alpha * s.life * segHead * aBoost)})`
            );
            ctx!.strokeStyle = grad;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }

          // head highlight, also boosted by proximity
          const proxHead = proximityBoost(s.x, s.y);
          const headBoost = 1 + proxHead * 2;
          ctx!.fillStyle = `hsla(${s.hue}, 90%, ${85 + proxHead * 10}%, ${Math.min(0.85, (s.alpha * s.life + 0.15) * headBoost)})`;
          ctx!.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        }

        if (s.pips.length) {
          ctx!.font = `${9 * dpr}px "JetBrains Mono", ui-monospace, monospace`;
          ctx!.textBaseline = 'middle';
          ctx!.textAlign = 'center';
          for (let i = s.pips.length - 1; i >= 0; i--) {
            const pp = s.pips[i];
            pp.t -= dt / pp.life;
            if (pp.t <= 0) {
              s.pips.splice(i, 1);
              continue;
            }
            const prox = proximityBoost(pp.x, pp.y);
            const a = Math.min(1, pp.t * s.alpha * s.life * 0.9 * (1 + prox * 2));
            ctx!.fillStyle = `hsla(${s.hue}, 80%, ${78 + prox * 10}%, ${a})`;
            ctx!.fillText(pp.ch, pp.x, pp.y - 6 * dpr);
            if (Math.random() < 0.05) pp.ch = HEX[(Math.random() * 16) | 0];
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      mql.removeEventListener?.('change', onMotion);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseOut);
    };
  });
</script>

<div class="bg-wrap" aria-hidden="true">
  <canvas bind:this={canvas} class="bg-canvas"></canvas>
  <div class="bg-vignette"></div>
</div>

<style>
  .bg-wrap {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.06), transparent 60%),
      radial-gradient(ellipse at 80% 85%, rgba(34, 211, 238, 0.04), transparent 60%),
      #0a0a0f;
  }

  .bg-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .bg-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at center, transparent 35%, rgba(10, 10, 15, 0.85) 100%);
  }
</style>
