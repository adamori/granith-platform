<script lang="ts">
  const paths = {
    moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
    sun: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    projects: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7ZM8 12l3 3 5-5',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2M12 14v3',
    plus: 'M12 5v14M5 12h14',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    logout: 'M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M10 12h11m-4-4 4 4-4 4',
    key: 'M15 7a5 5 0 1 0 2 4l5-5-4-4-3 3M6 9h.01',
    copy: 'M9 9h11v12H9ZM15 9V3H3v12h6',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    check: 'm5 12 4 4L19 6',
  };
  let { name, size = 20 }: { name: keyof typeof paths; size?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={paths[name]} />
</svg>
