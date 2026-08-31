/*=== LOGIN ===*/
(function () {
  const form = document.getElementById('loginForm');
  const submit = document.getElementById('submit');
  const msg = document.getElementById('msg');

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
        }),
      });

      if (res.ok) {
        msg.textContent = 'ok …';
        location.href = '/admin/';
        return;
      }

      const body = await res.json().catch(() => ({}));
      msg.textContent = body.error || 'that did not work';
      msg.classList.add('bad');
      form.querySelector('[name=password]').value = '';
      form.querySelector('[name=password]').focus();
    } catch {
      msg.textContent = 'no connection';
      msg.classList.add('bad');
    } finally {
      submit.disabled = false;
    }
  });
})();
