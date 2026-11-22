// Deal Tracker: sends a Buyer Document from the buyer's private page
// (api/_lib/deal-tracker.js, documentsSection). Plain browser script, loaded only
// on a page that shows the document form; no imports, no analytics, nothing from
// another site. The file goes straight to the private store with the upload URL
// the page's own server hands out: upload_start, the PUT, then upload_done, whose
// receipt is added to the list. The page can never open a file it sent.
(function () {
  'use strict';
  var form = document.getElementById('dt-docs-form');
  if (!form || !window.fetch || !window.FormData) return;
  var select = form.querySelector('select[name="doc_type"]');
  var input = form.querySelector('input[type="file"]');
  var button = form.querySelector('button[type="submit"]');
  var status = document.getElementById('dt-docs-status');
  var list = document.getElementById('dt-receipts');
  var heading = document.getElementById('dt-receipts-title');
  var target = form.getAttribute('action') || window.location.pathname;
  var maxBytes = Number(form.getAttribute('data-max-bytes')) || 20 * 1024 * 1024;
  var types = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp' };
  var allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
  var trouble = 'That didn’t go through. Check your connection and send it again.';
  var when = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  form.hidden = false;

  function say(text) { status.textContent = text; }
  // A message meant for the buyer; any other error (a dropped connection) gets the general one.
  function refusal(message) { var error = new Error(message || trouble); error.forBuyer = true; return error; }

  // Some phones leave a HEIC photo's type blank, so the extension decides then.
  function typeOf(file) {
    var type = String(file.type || '').toLowerCase();
    if (type) return type;
    var match = /\.([a-z0-9]+)$/i.exec(file.name || '');
    return match ? types[match[1].toLowerCase()] || '' : '';
  }

  // A POST to the page's own URL, answered in JSON.
  function post(fields) {
    return fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(fields).toString(),
      credentials: 'omit',
      cache: 'no-store'
    }).then(function (response) {
      return response.json().catch(function () { return { ok: false, message: trouble }; });
    });
  }

  function addReceipt(receipt) {
    var label = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : 'Document';
    var item = document.createElement('li');
    var time = document.createElement('time');
    time.setAttribute('datetime', receipt.at);
    time.textContent = when.format(new Date(receipt.at));
    item.appendChild(document.createTextNode(label + ' · sent '));
    item.appendChild(time);
    list.appendChild(item);
    list.hidden = false;
    if (heading) heading.hidden = false;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var file = input.files && input.files[0];
    var contentType = file ? typeOf(file) : '';
    if (!select.value) return say('Choose what kind of document this is.');
    if (!file) return say('Choose a file to send.');
    if (allowed.indexOf(contentType) === -1) return say('That kind of file can’t be sent here. Send a PDF or a photo (JPEG, PNG, HEIC or WebP).');
    if (file.size < 1) return say('That file is empty. Choose the file again and send it.');
    if (file.size > maxBytes) return say('That file is over 20 MB. Send a smaller copy, or email it to me instead.');

    button.disabled = true;
    say('Sending your file…');
    var ticket;
    post({ action: 'upload_start', doc_type: select.value, content_type: contentType, bytes: String(file.size) })
      .then(function (started) {
        if (!started.ok || !started.upload) throw refusal(started.message);
        ticket = started.ticket;
        return fetch(started.upload.url, { method: started.upload.method || 'PUT', headers: started.upload.headers || {}, body: file, credentials: 'omit', cache: 'no-store' });
      })
      .then(function (sent) {
        if (!sent.ok) throw refusal(trouble);
        return post({ action: 'upload_done', ticket: ticket });
      })
      .then(function (done) {
        if (!done.ok || !done.receipt) throw refusal(done.message);
        addReceipt(done.receipt);
        say('Sent. I have your file, and its receipt is in the list below.');
        form.reset();
      })
      .catch(function (error) {
        say(error && error.forBuyer ? error.message : trouble);
      })
      .then(function () { button.disabled = false; });
  });
})();
