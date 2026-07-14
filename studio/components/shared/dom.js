
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export function activate(groupSelector, button) {
  $$(groupSelector + ' button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}
