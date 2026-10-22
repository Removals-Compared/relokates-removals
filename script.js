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
branch:      window.RELOKATES_BRANCH || undefined,
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
  var WA_NUMBER = window.RELOKATES_WA_NUMBER || '447359724844';
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

/* Postcode -> address picker on public quote forms.
   Looks for .addr-find[data-target=...] + .addr-pc[data-target=...] siblings,
   and populates the <input id="<target>"> with a cleaned address from
   /api/address-lookup. Delegated handlers so it works for any form on the page. */
(function () {
  var CSS =
    ".addr-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center}"
    + ".addr-pc{flex:1 1 160px;min-width:140px;padding:12px 14px;border:1px solid var(--border,#dcdde0);border-radius:8px;font:600 14px/1.2 var(--ff-sans,system-ui,sans-serif);text-transform:uppercase;letter-spacing:0.5px;background:#fff;color:var(--navy,#1a3c6e)}"
    + ".addr-pc:focus{outline:none;border-color:var(--gold,#c89f3d);box-shadow:0 0 0 3px rgba(200,159,61,0.15)}"
    + ".addr-find{padding:12px 20px;border:0;border-radius:8px;background:var(--navy,#1a3c6e);color:#fff;font:700 13px/1 var(--ff-sans,system-ui,sans-serif);letter-spacing:0.5px;text-transform:uppercase;cursor:pointer;min-height:44px}"
    + ".addr-find:hover{background:var(--gold,#c89f3d)}"
    + ".addr-find:disabled{opacity:0.55;cursor:default}"
    + ".addr-select{width:100%;margin-top:8px;padding:12px 14px;border:1px solid var(--border,#dcdde0);border-radius:8px;font:500 14px/1.3 var(--ff-sans,system-ui,sans-serif);background:#fff;color:var(--navy,#1a3c6e)}"
    + ".addr-note{margin:6px 2px 0;font-size:12.5px;color:#a4281d}"
    + ".addr-note.ok{color:#1f6b43}";
  if (!document.getElementById("addr-picker-css")) {
    var s = document.createElement("style");
    s.id = "addr-picker-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function note(target, msg, ok) {
    var n = document.querySelector('.addr-note[data-target="' + target + '"]');
    if (!n) return;
    n.textContent = msg || "";
    n.hidden = !msg;
    n.classList.toggle("ok", !!ok);
  }
  function esc(x) {
    return String(x).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  document.addEventListener("click", async function (e) {
    var btn = e.target.closest(".addr-find");
    if (!btn) return;
    e.preventDefault();
    var target = btn.dataset.target;
    if (!target) return;
    var input = document.getElementById(target);
    var pcEl = document.querySelector('.addr-pc[data-target="' + target + '"]');
    var sel = document.querySelector('.addr-select[data-target="' + target + '"]');
    note(target, "");
    if (sel) sel.hidden = true;
    var pc = ((pcEl && pcEl.value) || (input && input.value) || "").trim();
    if (!pc) {
      note(target, "Enter a postcode first.");
      (pcEl || input) && (pcEl || input).focus();
      return;
    }
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Finding...";
    try {
      var r = await fetch("/api/address-lookup?postcode=" + encodeURIComponent(pc));
      if (r.status === 501) { note(target, "Address lookup is unavailable. Please type your address."); return; }
      var j = {};
      try { j = await r.json(); } catch (_) {}
      if (r.status === 400) { note(target, j.error || "Enter a valid UK postcode."); return; }
      if (!r.ok) { note(target, "Lookup unavailable. Please type your address."); return; }
      var list = (j && j.addresses) || [];
      if (!list.length) { note(target, "No addresses found for " + (j.postcode || pc) + ". Please type your address."); return; }
      if (sel) {
        sel.innerHTML = '<option value="">' + list.length + " addresses found, select yours</option>"
          + list.map(function (a) { return "<option>" + esc(a) + "</option>"; }).join("");
        sel.hidden = false;
        sel.focus();
        note(target, "Pick your address from the list.", true);
      }
    } catch (_) {
      note(target, "Lookup unavailable. Please type your address.");
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
  document.addEventListener("change", function (e) {
    var sel = e.target.closest(".addr-select");
    if (!sel || !sel.value) return;
    var input = document.getElementById(sel.dataset.target);
    if (input) {
      input.value = sel.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sel.hidden = true;
    note(sel.dataset.target, "");
  });
})();
