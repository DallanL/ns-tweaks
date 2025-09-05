(function () {
  'use strict';

  if (window.__DTMF_OVERLAY_LOADED__) return;
  window.__DTMF_OVERLAY_LOADED__ = true;

  // ---- Helpers -------------------------------------------------------------

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function ensureJQ(cb) {
    if (window.jQuery) return cb(window.jQuery);
    var t = setInterval(function () {
      if (window.jQuery) { clearInterval(t); cb(window.jQuery); }
    }, 50);
  }

  function csvUrlFrom(href) {
    var base = href.split('#')[0].split('?')[0].replace(/\/+$/, '');
    return base + '/csv';
  }

  function parseDtmfCsv(text) {
    var entries = [], m;
    var reDigits = /Digits\s+entered\s*=\s*<([^>]+)>/gi;
    var reNone   = /T\/O\s+no\s+digit\s+entered/gi;
    while ((m = reDigits.exec(text)) !== null) entries.push({ type: 'digits', value: (m[1] || '').trim() });
    while ((m = reNone.exec(text))   !== null) entries.push({ type: 'none',   value: '' });
    return entries;
  }

  function injectStyles() {
    if (document.getElementById('dtmf-overlay-styles')) return;
    var css = `
#dtmf-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483000;display:none}
#dtmf-card{position:absolute;top:10%;left:50%;transform:translateX(-50%);width:900px;max-width:95vw;background:#fff;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.5);overflow:hidden}
#dtmf-head{padding:10px 14px;border-bottom:1px solid #eee;display:flex;gap:8px;justify-content:space-between;align-items:center}
#dtmf-body{padding:12px 14px;max-height:70vh;overflow:auto}
#dtmf-summary{margin-bottom:8px}
#dtmf-raw{display:none;white-space:pre;max-height:60vh;overflow:auto;margin-top:10px;background:#f8f9fa;border:1px solid #eee;padding:10px}
#dtmf-actions a{margin-left:6px}
.dtmf-btn-label{display:inline-block;padding:0 6px;height:24px;line-height:24px;border:1px solid #bbb;border-radius:12px;vertical-align:middle}
    `;
    var st = document.createElement('style');
    st.id = 'dtmf-overlay-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function ensureOverlay($) {
    var $ov = $('#dtmf-overlay');
    if ($ov.length) return $ov;
    $('body').append(
      '<div id="dtmf-overlay">' +
        '<div id="dtmf-card">' +
          '<div id="dtmf-head">' +
            '<strong>DTMF Entered</strong>' +
            '<div id="dtmf-actions">' +
              '<a href="#" id="dtmf-toggle-raw" class="btn btn-small">Show raw</a>' +
              '<a href="#" id="dtmf-copy" class="btn btn-small">Copy</a>' +
              '<a href="#" id="dtmf-download" class="btn btn-small">Download</a>' +
              '<a href="#" id="dtmf-close" class="btn btn-small">Close</a>' +
            '</div>' +
          '</div>' +
          '<div id="dtmf-body">' +
            '<div id="dtmf-summary" aria-live="polite"></div>' +
            '<div id="dtmf-results"></div>' +
            '<pre id="dtmf-raw"></pre>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    $ov = $('#dtmf-overlay');

    $ov.on('click', '#dtmf-close', function (e) { e.preventDefault(); $ov.hide(); });
    $ov.on('click', function (e) { if (e.target.id === 'dtmf-overlay') $ov.hide(); });
    $ov.on('click', '#dtmf-toggle-raw', function (e) {
      e.preventDefault();
      var pre = document.getElementById('dtmf-raw');
      var btn = e.currentTarget;
      var vis = pre.style.display !== 'none';
      pre.style.display = vis ? 'none' : 'block';
      btn.textContent = vis ? 'Show raw' : 'Hide raw';
    });
    $ov.on('click', '#dtmf-copy', function (e) {
      e.preventDefault();
      var text = document.getElementById('dtmf-raw').textContent || '';
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t);
        t.select(); try { document.execCommand('copy'); } finally { document.body.removeChild(t); }
      }
    });
    $ov.on('click', '#dtmf-download', function (e) {
      e.preventDefault();
      var text = document.getElementById('dtmf-raw').textContent || '';
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      a.download = 'sip-trace.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ try { URL.revokeObjectURL(a.href); } catch(e){} }, 1000);
    });

    return $ov;
  }
  function renderParsed(entries) {
    var $sum = window.jQuery('#dtmf-summary');
    var $res = window.jQuery('#dtmf-results');
    $sum.empty(); $res.empty();

    if (!entries.length) {
      $sum.text('No DTMF or timeout markers found in SIP trace CSV for this call.');
      return;
    }

    var seqs = entries.filter(function (e) { return e.type === 'digits'; })
                      .map(function (e) { return e.value; });

    if (seqs.length) {
      var safe = window.jQuery('<div/>').text(seqs.join(' ')).html();
      $sum.html('<strong>Combined sequences:</strong> ' + safe);
    } else {
      $sum.text('No digits entered; only timeout markers present.');
    }

    var rows = entries.map(function (e, i) {
      var typeLabel = e.type === 'digits' ? 'Digits entered' : 'No digit entered';
      var content   = e.type === 'digits' ? window.jQuery('<div/>').text(e.value).html() : '—';
      return '<tr><td>' + (i + 1) + '</td><td>' + typeLabel + '</td><td>' + content + '</td></tr>';
    }).join('');

    $res.html('<table class="table table-striped table-condensed">' +
                '<thead><tr><th>#</th><th>Type</th><th>Content</th></tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
              '</table>');
  }

  function renderRaw(text, urlUsed) {
    var meta = 'Source: ' + urlUsed + ' · ' + text.length + ' bytes';
    window.jQuery('#dtmf-summary').text(meta);
    document.getElementById('dtmf-raw').textContent = text; // raw goes in <pre>
  }

  function fetchCsvOnly(csvUrl) {
    return fetch(csvUrl, { credentials: 'same-origin', cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (txt) { return { txt: txt, used: csvUrl }; });
  }
  function openDtmfOverlay(el) {
    var $ = window.jQuery;
    var $row = $(el).closest('tr');
    var href = $row.find('a.details').attr('href'); // SIP Flow link already in the row
    if (!href) { alert('SIP Flow link not found for this row.'); return false; }

    injectStyles();
    var $ov = ensureOverlay($);
    $('#dtmf-summary').text('Loading…');
    $('#dtmf-results').empty();
    $('#dtmf-raw').text('').hide(); // hidden until user clicks "Show raw"
    $ov.show();

    // cache by CSV URL
    window.__DTMF_CACHE__ = window.__DTMF_CACHE__ || {};
        var csvUrl = csvUrlFrom(href);   // builds href-without-query + '/csv'
        var key = csvUrl;

        if (window.__DTMF_CACHE__[key]) {
          var cached = window.__DTMF_CACHE__[key];
          renderRaw(cached.txt, cached.used);
          renderParsed(parseDtmfCsv(cached.txt));
          return false;
        }

        fetchCsvOnly(csvUrl)
          .then(function (res) {
            window.__DTMF_CACHE__[key] = res; // { txt, used }
            renderRaw(res.txt, res.used);
            renderParsed(parseDtmfCsv(res.txt));
          })
          .catch(function (err) {
            if (window.console && console.error) console.error('DTMF CSV load failed:', err);
            jQuery('#dtmf-summary').text('Failed to load SIP trace CSV for this call.');
    });

    return false;
  }
  // ---- Button injection ----------------------------------------------------

  function makeButton(doc) {
    var a = doc.createElement('a');
    a.href = '#';
    a.className = 'dtmf-view helpsy reports';  // 'reports' reuses your 24x24 icon box
    a.title = 'Show DTMF entries';
    // If your theme hides empty anchors, you can uncomment the label line below:
    // a.className += ' dtmf-btn-label'; a.textContent = 'DTMF';
    return a;
  }

  function injectButtons(root) {
    var doc = root.ownerDocument || document;
    var cells = (root.querySelectorAll ? root : doc).querySelectorAll('td.action-buttons');
    for (var i = 0; i < cells.length; i++) {
      var td = cells[i];
      if (td.querySelector('a.dtmf-view')) continue;                 // already injected
      var sip = td.querySelector('a.details');                       // existing SIP Flow link
      if (!sip) continue;
      var btn = makeButton(doc);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        openDtmfOverlay(e.currentTarget);
        return false;
      });
      td.appendChild(btn);
    }
  }

  function observeTable() {
    var obs = new MutationObserver(function (mut) {
      for (var i = 0; i < mut.length; i++) {
        var m = mut[i];
        for (var n = 0; n < m.addedNodes.length; n++) {
          var node = m.addedNodes[n];
          if (node.nodeType !== 1) continue;
          // Inject into any new action-buttons cells
          if (node.matches && node.matches('td.action-buttons')) {
            injectButtons(node.parentNode || node);
          } else if (node.querySelector) {
            var hit = node.querySelector('td.action-buttons');
            if (hit) injectButtons(node);
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  // ---- Init ----------------------------------------------------------------

  onReady(function () {
    ensureJQ(function ($) {
      injectStyles();
      injectButtons(document);
      observeTable();

      // Delegated safety net (in case other handlers exist)
      $(document).off('click.dtmf', 'a.dtmf-view').on('click.dtmf', 'a.dtmf-view', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return openDtmfOverlay(this);
      });
    });
  });
})();

