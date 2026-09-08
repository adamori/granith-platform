(() => {
  let theme = 'light';
  try {
    if (localStorage.getItem('granith-theme') === 'dark') theme = 'dark';
  } catch {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#151e1a' : '#f6f7f2');
})();
