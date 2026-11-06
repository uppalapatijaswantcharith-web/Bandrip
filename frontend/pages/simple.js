// About / Lookbook / Stores: directional reveals, gentle image parallax, demo contact form.
import { gsap } from 'gsap';
import { enhanceForm } from '../ui/form.js';

export async function init({ prefs, loader }) {
  document.querySelectorAll('img[fetchpriority="high"]').forEach((img) => loader.image(img, 1));

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  if (!prefs.reduced) {
    document.querySelectorAll('.look__img img, .split-hero__img img, .stores-hero__img img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.closest('.chapter'), start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  const form = document.querySelector('[data-contact-form]');
  const success = document.querySelector('[data-contact-success]');
  enhanceForm(form, {
    onSuccess: () => { form.hidden = true; success.hidden = false; success.focus(); },
  });

  return { ready: loader.whenDone(5000), enter() {} };
}
