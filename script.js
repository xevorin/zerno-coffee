(function () {
  'use strict';

  var rub = function (n) { return n.toLocaleString('ru-RU') + ' ₽'; };

  /* ---------- tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); selectTab(next, true); }
    });
  });

  /* ---------- menu data from markup ---------- */
  var groups = [
    { title: 'Кофе', panel: 'panel-coffee' },
    { title: 'Не кофе', panel: 'panel-other' },
    { title: 'Выпечка', panel: 'panel-bakery' }
  ];
  var menu = [];
  groups.forEach(function (g) {
    document.querySelectorAll('#' + g.panel + ' .item').forEach(function (el) {
      menu.push({ id: el.dataset.id, name: el.dataset.name, price: Number(el.dataset.price), group: g.title });
    });
  });
  var qty = {};

  /* ---------- order form ---------- */
  var dialog = document.getElementById('order');
  var form = document.getElementById('order-form');
  var done = document.getElementById('order-done');
  var picker = document.getElementById('picker');
  var totalEl = document.getElementById('o-total');
  var timeSel = document.getElementById('o-time');
  var nameIn = document.getElementById('o-name');
  var phoneIn = document.getElementById('o-phone');
  var lastTrigger = null;

  function buildPicker() {
    picker.innerHTML = '';
    menu.forEach(function (m) {
      qty[m.id] = 0;
      var li = document.createElement('li');
      li.className = 'pick';
      li.innerHTML =
        '<span class="pick__name" id="pn-' + m.id + '">' + m.name + '<small>' + m.group + ' · ' + rub(m.price) + '</small></span>' +
        '<span class="qty">' +
          '<button type="button" data-step="-1" data-id="' + m.id + '" aria-label="Убрать: ' + m.name + '" disabled>−</button>' +
          '<output id="q-' + m.id + '" aria-labelledby="pn-' + m.id + '">0</output>' +
          '<button type="button" data-step="1" data-id="' + m.id + '" aria-label="Добавить: ' + m.name + '">+</button>' +
        '</span>';
      picker.appendChild(li);
    });
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function buildTimes() {
    timeSel.innerHTML = '';
    var add = function (v, t) { var o = document.createElement('option'); o.value = v; o.textContent = t; timeSel.appendChild(o); };
    add('15', 'Через 15 минут');
    add('30', 'Через 30 минут');
    var now = new Date();
    var day = now.getDay();
    var open = (day === 0 || day === 6) ? 9 * 60 : 7 * 60 + 30;
    var close = 21 * 60 - 15;
    var start = Math.max(open, now.getHours() * 60 + now.getMinutes() + 45);
    start = Math.ceil(start / 15) * 15;
    for (var m = start; m <= close; m += 15) {
      var t = Math.floor(m / 60) + ':' + pad(m % 60);
      add(t, 'Сегодня к ' + t);
    }
    if (start > close) add('tomorrow', 'Завтра к открытию');
  }

  function total() {
    return menu.reduce(function (s, m) { return s + m.price * qty[m.id]; }, 0);
  }

  function render() {
    menu.forEach(function (m) {
      document.getElementById('q-' + m.id).textContent = qty[m.id];
      picker.querySelector('[data-step="-1"][data-id="' + m.id + '"]').disabled = qty[m.id] === 0;
    });
    totalEl.textContent = rub(total());
    if (total() > 0) document.getElementById('o-items-err').hidden = true;
  }

  picker.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-step]');
    if (!b) return;
    var id = b.dataset.id;
    qty[id] = Math.max(0, Math.min(20, qty[id] + Number(b.dataset.step)));
    render();
  });

  function digits(v) { return v.replace(/\D/g, ''); }
  function phoneOk(v) {
    var d = digits(v);
    if (d.length === 10 && d[0] === '9') return true;
    return d.length === 11 && (d[0] === '7' || d[0] === '8') && d[1] === '9';
  }
  function formatPhone(v) {
    var d = digits(v);
    if (d.length === 10) d = '7' + d;
    if (d.length !== 11) return v;
    return '+7 ' + d.slice(1, 4) + ' ' + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9, 11);
  }

  function setErr(input, errId, bad) {
    document.getElementById(errId).hidden = !bad;
    input.setAttribute('aria-invalid', String(bad));
  }

  phoneIn.addEventListener('blur', function () {
    if (!phoneIn.value) return;
    var ok = phoneOk(phoneIn.value);
    if (ok) phoneIn.value = formatPhone(phoneIn.value);
    setErr(phoneIn, 'o-phone-err', !ok);
  });
  phoneIn.addEventListener('input', function () {
    if (phoneIn.getAttribute('aria-invalid') === 'true' && phoneOk(phoneIn.value)) setErr(phoneIn, 'o-phone-err', false);
  });
  nameIn.addEventListener('input', function () {
    if (nameIn.value.trim()) setErr(nameIn, 'o-name-err', false);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nameBad = !nameIn.value.trim();
    var phoneBad = !phoneOk(phoneIn.value);
    var itemsBad = total() === 0;
    setErr(nameIn, 'o-name-err', nameBad);
    setErr(phoneIn, 'o-phone-err', phoneBad);
    document.getElementById('o-items-err').hidden = !itemsBad;
    if (nameBad) { nameIn.focus(); return; }
    if (phoneBad) { phoneIn.focus(); return; }
    if (itemsBad) { picker.querySelector('[data-step="1"]').focus(); return; }

    var count = menu.reduce(function (s, m) { return s + qty[m.id]; }, 0);
    var when = timeSel.options[timeSel.selectedIndex].text.toLowerCase();
    document.getElementById('order-summary').textContent =
      nameIn.value.trim() + ', соберём ' + count + ' ' + plural(count, 'позицию', 'позиции', 'позиций') +
      ' на ' + rub(total()) + ' — ' + when + '. Позвоним на ' + formatPhone(phoneIn.value) + ', если что-то закончится.';
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });

  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }

  function resetForm() {
    form.reset();
    [nameIn, phoneIn].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.field__err').forEach(function (p) { p.hidden = true; });
    menu.forEach(function (m) { qty[m.id] = 0; });
    form.hidden = false;
    done.hidden = true;
    render();
  }

  function openOrder(trigger) {
    lastTrigger = trigger || null;
    if (!done.hidden) resetForm();
    buildTimes();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('no-scroll');
    nameIn.focus();
  }

  function closeOrder() {
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); onClosed(); }
  }

  function onClosed() {
    document.body.classList.remove('no-scroll');
    if (!done.hidden) resetForm();
    if (lastTrigger) lastTrigger.focus();
  }

  dialog.addEventListener('close', onClosed);
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeOrder();
  });
  document.querySelectorAll('[data-close-order]').forEach(function (b) {
    b.addEventListener('click', closeOrder);
  });
  document.querySelectorAll('[data-open-order]').forEach(function (b) {
    b.addEventListener('click', function () { openOrder(b); });
  });

  buildPicker();
  render();
})();
