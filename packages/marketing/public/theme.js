(() => {
  const applyTheme = (dark) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#151e1a' : '#f6f7f2');
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      const label = `Switch to ${dark ? 'light' : 'dark'} theme`;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
  };
  const readTheme = () => {
    try {
      return localStorage.getItem('granith-theme') === 'dark';
    } catch {
      return false;
    }
  };
  applyTheme(readTheme());
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(readTheme());
    document.querySelectorAll('.theme-toggle').forEach((button) => {
      button.addEventListener('click', () => {
        const dark = document.documentElement.dataset.theme !== 'dark';
        applyTheme(dark);
        try {
          localStorage.setItem('granith-theme', dark ? 'dark' : 'light');
        } catch {}
      });
    });
  });
  window.addEventListener('storage', (event) => {
    if (event.key === 'granith-theme' || event.key === null) applyTheme(event.newValue === 'dark');
  });
})();
