/*=== LOGIN ===*/
(function () {
  const form = document.getElementById('loginForm');
  const submit = document.getElementById('submit');
  const msg = document.getElementById('msg');
  const codeField = document.getElementById('codeField');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    msg.textContent = 'checking …';
    msg.classList.remove('bad');

    const data = new FormData(form);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password'),
          code: data.get('code') || '',
        }),
      });

      const body = await res.json().catch(() => ({}));

      // passwort stimmt, es fehlt nur der code aus der app. das passwortfeld
      // behaelt seinen inhalt — es wird beim zweiten anlauf wieder gebraucht.
      if (res.ok && body.totpRequired) {
        codeField.hidden = false;
        msg.textContent = 'and the code from your app';
        msg.classList.remove('bad');
        form.querySelector('[name=code]').focus();
        return;
      }

      if (res.ok) {
        msg.textContent = 'ok …';
        location.href = '/admin/';
        return;
      }

      msg.textContent = body.error || 'that did not work';
      msg.classList.add('bad');

      if (body.totpRequired) {
        // code war falsch, passwort war richtig — nur den code leeren
        codeField.hidden = false;
        const code = form.querySelector('[name=code]');
        code.value = '';
        code.focus();
      } else {
        codeField.hidden = true;
        form.querySelector('[name=code]').value = '';
        form.querySelector('[name=password]').value = '';
        form.querySelector('[name=password]').focus();
      }
    } catch {
      msg.textContent = 'no connection';
      msg.classList.add('bad');
    } finally {
      submit.disabled = false;
    }
  });
})();
