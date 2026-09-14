const menuButton = document.querySelector('.menu-button');
const menuButtonLabel = menuButton?.querySelector('.menu-button-label');
const mobileNav = document.querySelector('#mobile-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  mobileNav.hidden = isOpen;
  if (menuButtonLabel) menuButtonLabel.textContent = isOpen ? 'Меню' : 'Закрыть';
});

document.querySelectorAll('.mobile-nav a').forEach((link) => {
  link.addEventListener('click', () => {
    if (!mobileNav || !menuButton) return;
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    if (menuButtonLabel) menuButtonLabel.textContent = 'Меню';
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

const heroCtaTrigger = document.querySelector('.hero-cta-trigger');
const heroCtaMenu = document.querySelector('.hero-cta-menu');
const heroCtaDropdown = document.querySelector('.hero-cta-dropdown');

const closeHeroCtaDropdown = () => {
  if (!heroCtaDropdown || heroCtaDropdown.hidden) return;
  heroCtaDropdown.hidden = true;
  heroCtaTrigger?.setAttribute('aria-expanded', 'false');
};

if (heroCtaTrigger && heroCtaMenu && heroCtaDropdown) {
  heroCtaTrigger.addEventListener('click', (event) => {
    event.preventDefault();
    const isOpen = heroCtaTrigger.getAttribute('aria-expanded') === 'true';
    heroCtaDropdown.hidden = isOpen;
    heroCtaTrigger.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!heroCtaMenu.contains(event.target)) closeHeroCtaDropdown();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHeroCtaDropdown();
  });
}

const params = new URLSearchParams(window.location.search);
if (params.get('focus') === 'products') document.querySelector('#products')?.scrollIntoView();

const stickyCta = document.querySelector('.mobile-sticky-cta');
const hero = document.querySelector('.hero');
if (stickyCta && hero && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      stickyCta.classList.toggle('is-visible', !entry.isIntersecting);
    },
    { rootMargin: '0px 0px -20% 0px' },
  );
  observer.observe(hero);
}
