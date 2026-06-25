function toggleMobile() {
var m = document.getElementById('mobile-overlay');
var isOpen = m.classList.toggle('open');
document.body.style.overflow = isOpen ? 'hidden' : '';
}
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
function toggleFaq(el) {
var item = el.closest('.faq-item');
var isOpen = item.classList.contains('open');
document.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
if (!isOpen) item.classList.add('open');
}
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
window.addEventListener('scroll', function () {
var nav = document.getElementById('site-nav');
if (nav) nav.style.boxShadow = window.scrollY > 10 ? '0 2px 20px rgba(26,60,110,0.1)' : 'none';
});/* Auto-update the footer copyright year so it never goes stale. */
document.querySelectorAll('.cy').forEach(function(el){ el.textContent = new Date().getFullYear(); });

/* WhatsApp click-to-chat floating button. Auto-injects on every page. */
(function(){
  var WA_NUMBER = '447359724844';
  var WA_MESSAGE = "Hi Relokates, I'd like a quote for my move.";
  var href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(WA_MESSAGE);
  var btn = document.createElement('a');
  btn.href = href;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.setAttribute('aria-label', 'Chat with Relokates Removals on WhatsApp');
  btn.id = 'wa-float';
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path fill="#fff" d="M16 .4C7.4.4.4 7.4.4 16c0 2.8.7 5.5 2.1 7.9L.3 31.7l8-2.1c2.3 1.3 4.9 1.9 7.7 1.9 8.6 0 15.6-7 15.6-15.6S24.6.4 16 .4zm0 28.4c-2.5 0-5-.7-7.1-2l-.5-.3-4.7 1.2 1.3-4.6-.3-.5C3.3 21 2.5 18.5 2.5 16 2.5 8.5 8.5 2.5 16 2.5S29.5 8.5 29.5 16 23.5 28.8 16 28.8zm7.7-9.7c-.4-.2-2.5-1.2-2.9-1.4-.4-.1-.7-.2-.9.2-.3.4-1 1.4-1.3 1.6-.2.3-.5.3-.9.1-.4-.2-1.8-.7-3.4-2.1-1.3-1.1-2.1-2.5-2.4-2.9-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.3-.4.4-.7.1-.3 0-.5-.1-.7-.1-.2-.9-2.2-1.3-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1 .5-.4.4-1.4 1.4-1.4 3.3 0 1.9 1.4 3.8 1.6 4.1.2.3 2.8 4.4 6.9 6.1.9.4 1.7.7 2.3.9 1 .3 1.8.3 2.5.2.8-.1 2.5-1 2.8-2 .3-1 .3-1.8.2-2-.1-.2-.4-.3-.8-.5z"/></svg>';
  var s = btn.style;
  s.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#25D366;box-shadow:0 4px 16px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;z-index:9999;text-decoration:none;transition:transform 0.18s ease, box-shadow 0.18s ease;';
  btn.addEventListener('mouseenter', function(){ btn.style.transform='scale(1.08)'; btn.style.boxShadow='0 6px 22px rgba(0,0,0,0.24)'; });
  btn.addEventListener('mouseleave', function(){ btn.style.transform='scale(1)'; btn.style.boxShadow='0 4px 16px rgba(0,0,0,0.18)'; });
  btn.addEventListener('click', function(){ if (typeof gtag !== 'undefined') gtag('event', 'whatsapp_click', { event_category: 'lead', event_label: 'WhatsApp Float Button' }); });
  function place(){ document.body.appendChild(btn); }
  if (document.body) place(); else document.addEventListener('DOMContentLoaded', place);
})();
