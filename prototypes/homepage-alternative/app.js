const menuButton = document.querySelector('.menu-button');
const mobileNav = document.querySelector('#mobile-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  mobileNav.hidden = isOpen;
  menuButton.textContent = isOpen ? 'Меню' : 'Закрыть';
});

document.querySelectorAll('.mobile-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    if (!mobileNav || !menuButton) return;
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = 'Меню';
  });
});

document.querySelectorAll('[data-studio-link]').forEach((link) => {
  link.addEventListener('click', () => {
    const product = link.dataset.studioLink || 'set';
    const target = new URL(link.href, window.location.href);
    target.searchParams.set('product', product);
    const material = link.href.includes('material=satin')
      ? 'satin'
      : link.href.includes('material=silicone')
        ? 'silicone'
        : '';
    if (material) target.searchParams.set('material', material);
    link.href = target.toString();
    window.sessionStorage.setItem('studio-entry-context', JSON.stringify({ product, material }));
    window.dispatchEvent(new CustomEvent('homepage:studio-entry', { detail: { product, material } }));
  });
});

const params = new URLSearchParams(window.location.search);
if (params.get('focus') === 'products') document.querySelector('#products')?.scrollIntoView();
