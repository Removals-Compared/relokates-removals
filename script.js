// ═══════════════════════════════════════════════════════════════
//  RELOKATES REMOVALS — script.js
//  Navigation, FAQ accordion, quote form handler
// ═══════════════════════════════════════════════════════════════

// ── MOBILE NAV ──
function toggleMobile() {
  var m = document.getElementById('mobile-overlay');
  var isOpen = m.classList.toggle('open');
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

// ── NAV DROPDOWN ──
function toggleDropdown(id, e) {
  if (e) e.stopPropagation();
  var dd = document.getElementById(id);
  if (!dd) return;
  dd.classList.toggle('open');
}

document.addEventListener('click', function () {
  document.querySelectorAll('.nav-dropdown.open').forEach(function (dd) {
    dd.classList.remove('open');
  });
});

// ── FAQ ACCORDION ──
function toggleFaq(el) {
  var item = el.closest('.faq-item');
  var isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
  if (!isOpen) item.classList.add('open');
}

// ── QUOTE FORM ──
var quoteForm = document.getElementById('quote-form');
if (quoteForm) {
  quoteForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = this.querySelector('.form-submit');
    var successEl = document.getElementById('form-success');
    var errorEl = document.getElementById('form-error');
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Sending...';

    var data = {
      name:        document.getElementById('name') ? document.getElementById('name').value : '',
      email:       document.getElementById('email') ? document.getElementById('email').value : '',
      phone:       document.getElementById('phone') ? document.getElementById('phone').value : '',
      service:     document.getElementById('service') ? document.getElementById('service').value : '',
      move_from:   document.getElementById('move_from') ? document.getElementById('move_from').value : '',
      move_to:     document.getElementById('move_to') ? document.getElementById('move_to').value : '',
      move_date:   document.getElementById('move_date') ? document.getElementById('move_date').value : '',
      property:    document.getElementById('property') ? document.getElementById('property').value : '',
      message:     document.getElementById('message') ? document.getElementById('message').value : '',
    };

    try {
      var res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        quoteForm.reset();
        if (successEl) successEl.style.display = 'block';
        if (typeof gtag !== 'undefined') gtag('event', 'quote_form_submit', { event_category: 'lead', event_label: 'Relokates Quote Form' });
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      if (errorEl) errorEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Get My Free Quote →';
    }
  });
}

// ── STICKY NAV SHADOW ──
window.addEventListener('scroll', function () {
  var nav = document.getElementById('site-nav');
  if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(26,60,110,0.1)' : 'none';
});
