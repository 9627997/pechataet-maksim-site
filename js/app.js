document.addEventListener('DOMContentLoaded', () => {
  const yearNode = document.getElementById('year');
  if (yearNode) {
    yearNode.textContent = new Date().getFullYear();
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-contact-channel]').forEach((link) => {
    link.addEventListener('click', () => {
      const detail = {
        event: `${link.dataset.contactChannel}_click`,
        channel: link.dataset.contactChannel,
        location: link.dataset.contactLocation || 'unknown',
        page: window.location.pathname,
      };
      window.dispatchEvent(new CustomEvent('pm:contact', {detail}));
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(detail);
      }
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') {
        return;
      }

      const target = document.querySelector(targetId);
      if (!target) {
        return;
      }

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  });

  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach((item) => {
    const button = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (!button || !answer) {
      return;
    }

    button.addEventListener('click', () => {
      const isOpen = button.getAttribute('aria-expanded') === 'true';

      faqItems.forEach((otherItem) => {
        const otherButton = otherItem.querySelector('.faq-question');
        const otherAnswer = otherItem.querySelector('.faq-answer');
        if (!otherButton || !otherAnswer) {
          return;
        }
        otherButton.setAttribute('aria-expanded', 'false');
        otherAnswer.hidden = true;
        otherItem.classList.remove('is-open');
      });

      if (!isOpen) {
        button.setAttribute('aria-expanded', 'true');
        answer.hidden = false;
        item.classList.add('is-open');
      }
    });
  });

});
