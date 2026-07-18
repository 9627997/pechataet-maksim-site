document.addEventListener('DOMContentLoaded', () => {
  const yearNode = document.getElementById('year');
  if (yearNode) {
    yearNode.textContent = new Date().getFullYear();
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  const form = document.getElementById('contact-form');
  const status = document.querySelector('.form-status');

  const downloadTextFile = (filename, content) => {
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (form && status) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const name = (formData.get('name') || '').toString().trim();
      const contact = (formData.get('contact') || '').toString().trim();
      const comment = (formData.get('comment') || '').toString().trim();

      if (!name || !contact) {
        status.textContent = 'Пожалуйста, укажите имя и контакт для обратной связи.';
        status.classList.add('is-error');
        return;
      }

      const request = [
        'Заявка — Печатает Максим',
        '',
        `Имя: ${name}`,
        `Контакт: ${contact}`,
        `Комментарий: ${comment || 'не указан'}`,
        '',
        'Файл сформирован на сайте печатаетмаксим.рф.',
      ].join('\n');

      downloadTextFile('zayavka-pechataet-maksim.txt', request);
      status.textContent =
        'Заявка скачана. Прямая отправка пока не подключена — сохраните файл для связи с Максимом.';
      status.classList.remove('is-error');
    });
  }
});
