// Progressive form handling: client checks, server validation via fetch, accessible errors.
const MESSAGES = {
  valueMissing: 'This field is required.',
  typeMismatch: 'Check the format.',
  tooShort: (el) => `Use at least ${el.minLength} characters.`,
  tooLong: (el) => `Use at most ${el.maxLength} characters.`,
  rangeUnderflow: (el) => `Minimum is ${el.min}.`,
  rangeOverflow: (el) => `Maximum is ${el.max}.`,
  badInput: 'Enter a number.',
};

function clientError(el) {
  const v = el.validity;
  if (v.valid) return '';
  for (const key of Object.keys(MESSAGES)) {
    if (v[key]) return typeof MESSAGES[key] === 'function' ? MESSAGES[key](el) : MESSAGES[key];
  }
  return 'Check this field.';
}

export function enhanceForm(form, { onSuccess } = {}) {
  if (!form) return;
  const summary = form.querySelector('[data-form-summary]');
  const setError = (name, msg) => {
    const wrap = form.querySelector(`[data-field-wrap="${name}"]`);
    const err = form.querySelector(`[data-err-for="${name}"]`);
    const input = form.elements[name];
    wrap?.classList.toggle('has-error', !!msg);
    if (err) err.textContent = msg || '';
    if (input && input.setAttribute) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const fields = [...form.querySelectorAll('input:not([type=hidden]), select, textarea')];
  fields.forEach((el) => {
    el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') setError(el.name, clientError(el)); });
    el.addEventListener('input', () => { if (el.closest('.has-error')) setError(el.name, clientError(el)); });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstBad = null;
    fields.forEach((el) => {
      const msg = clientError(el);
      setError(el.name, msg);
      if (msg && !firstBad) firstBad = el;
    });
    if (firstBad) {
      summary.hidden = false;
      summary.textContent = 'Please fix the highlighted fields.';
      firstBad.focus();
      return;
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (data.ok) {
        summary.hidden = true;
        onSuccess?.(data, new FormData(form));
      } else {
        let first = null;
        Object.entries(data.errors || {}).forEach(([name, errs]) => {
          setError(name, errs.map((x) => x.message).join(' '));
          if (!first && form.elements[name]) first = form.elements[name];
        });
        summary.hidden = false;
        summary.textContent = 'The server found problems. Please check the highlighted fields.';
        first?.focus?.();
      }
    } catch {
      summary.hidden = false;
      summary.textContent = 'Could not reach the server. Please try again.';
    } finally {
      btn.disabled = false;
    }
  });
}
