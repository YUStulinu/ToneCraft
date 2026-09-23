(function () {
  'use strict';

  const STORAGE_KEYS = {
    saved: 'tonecraft_saved',
    history: 'tonecraft_history'
  };

  // ---------- STORAGE HELPERS ----------
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn('Could not save to localStorage', e); }
  }
  function getSaved() { return loadJSON(STORAGE_KEYS.saved, []); }
  function setSaved(list) { saveJSON(STORAGE_KEYS.saved, list); }
  function getHistory() { return loadJSON(STORAGE_KEYS.history, []); }
  function setHistory(list) { saveJSON(STORAGE_KEYS.history, list); }

  function variantId(variant, requestDate) {
    return (requestDate || '') + '::' + (variant.toneLabel || '') + '::' + (variant.body || '').slice(0, 30);
  }

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const contextInput = $('#contextInput');
  const toggleOriginal = $('#toggleOriginal');
  const originalInput = $('#originalInput');
  const composeBtn = $('#composeBtn');
  const formError = $('#formError');
  const loadingState = $('#loadingState');
  const emptyState = $('#emptyState');
  const variantResults = $('#variantResults');

  // ---------- TABS ----------
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('is-active'));
      $$('.tab-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      $('#tab-' + btn.dataset.tab).classList.add('is-active');
      if (btn.dataset.tab === 'saved') renderSaved();
      if (btn.dataset.tab === 'history') renderHistory();
    });
  });

  // ---------- OPTIONAL "REPLYING TO" TOGGLE ----------
  toggleOriginal.addEventListener('click', () => {
    const showing = !originalInput.hidden;
    originalInput.hidden = showing;
    toggleOriginal.textContent = showing
      ? '+ Add the message you\'re replying to (optional)'
      : '− Hide the original message field';
  });

  // ---------- COMPOSE ----------
  composeBtn.addEventListener('click', () => compose());

  async function compose() {
    formError.hidden = true;

    const context = contextInput.value.trim();
    if (!context) {
      formError.textContent = 'Please describe what you want to say first.';
      formError.hidden = false;
      return;
    }

    const options = {
      messageType: $('#messageType').value,
      formality: $('#formality').value,
      numVariants: $('#numVariants').value,
      language: $('#language').value
    };
    const originalMessage = originalInput.hidden ? '' : originalInput.value.trim();

    emptyState.hidden = true;
    variantResults.innerHTML = '';
    loadingState.hidden = false;
    composeBtn.disabled = true;

    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, originalMessage, options })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unknown error while generating messages.');
      }

      const requestRecord = {
        context,
        originalMessage,
        options,
        variants: data.variants || [],
        date: new Date().toISOString()
      };

      renderVariants(requestRecord, variantResults, { showSave: true });
      addToHistory(requestRecord);
    } catch (err) {
      console.error(err);
      formError.textContent = 'Could not generate messages: ' + err.message;
      formError.hidden = false;
      emptyState.hidden = false;
    } finally {
      loadingState.hidden = true;
      composeBtn.disabled = false;
    }
  }

  // ---------- RENDER VARIANT CARDS ----------
  function renderVariants(requestRecord, container, opts) {
    container.innerHTML = '';
    const variants = requestRecord.variants || [];
    if (!variants.length) {
      container.innerHTML = '<p class="hint">No message variants to display.</p>';
      return;
    }

    const saved = getSaved();

    variants.forEach((variant, idx) => {
      const id = variantId(variant, requestRecord.date);
      const isSaved = saved.some((s) => variantId(s.variant, s.date) === id);
      const accent = (idx % 3) + 1;

      const card = document.createElement('article');
      card.className = 'variant-card';
      card.dataset.accent = String(accent);

      const subjectHtml = variant.subject
        ? `<p class="msg-subject"><strong>Subject:</strong> ${escapeHtml(variant.subject)}</p>`
        : '';

      card.innerHTML = `
        <p class="tone-label">${escapeHtml(variant.toneLabel || 'Variant')}</p>
        ${subjectHtml}
        <p class="msg-body">${escapeHtml(variant.body || '')}</p>
        <div class="card-actions">
          <button type="button" class="btn-save ${isSaved ? 'is-saved' : ''}">${isSaved ? '★ Saved' : '☆ Save'}</button>
          <button type="button" class="btn-copy">Copy</button>
          <button type="button" class="btn-download">Download .txt</button>
          ${opts && opts.showRemove ? '<button type="button" class="btn-remove">Remove</button>' : ''}
        </div>
      `;

      card.querySelector('.btn-save').addEventListener('click', (e) => {
        toggleSaved(variant, requestRecord.date);
        const btn = e.currentTarget;
        const nowSaved = getSaved().some((s) => variantId(s.variant, s.date) === id);
        btn.classList.toggle('is-saved', nowSaved);
        btn.textContent = nowSaved ? '★ Saved' : '☆ Save';
        if ($('#tab-saved').classList.contains('is-active')) renderSaved();
      });

      card.querySelector('.btn-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(variantAsText(variant)).catch(() => {});
      });

      card.querySelector('.btn-download').addEventListener('click', () => {
        downloadText(variantAsText(variant), (variant.toneLabel || 'message') + '.txt');
      });

      const removeBtn = card.querySelector('.btn-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          setSaved(getSaved().filter((s) => variantId(s.variant, s.date) !== id));
          renderSaved();
        });
      }

      container.appendChild(card);
    });
  }

  function variantAsText(variant) {
    let out = '';
    if (variant.subject) out += `Subject: ${variant.subject}\n\n`;
    out += variant.body || '';
    return out;
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/[^a-z0-9.\-_ ]/gi, '_');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- SAVED ----------
  function toggleSaved(variant, date) {
    const saved = getSaved();
    const id = variantId(variant, date);
    const exists = saved.some((s) => variantId(s.variant, s.date) === id);
    if (exists) {
      setSaved(saved.filter((s) => variantId(s.variant, s.date) !== id));
    } else {
      saved.push({ variant, date });
      setSaved(saved);
    }
    updateCounts();
  }

  function renderSaved() {
    const saved = getSaved();
    const grid = $('#savedGrid');
    const empty = $('#savedEmpty');
    grid.innerHTML = '';
    if (!saved.length) { empty.hidden = false; return; }
    empty.hidden = true;

    const fakeRequest = { date: '', variants: saved.map((s) => s.variant) };
    // render using each saved item's own date for correct id matching
    saved.forEach((s, idx) => {
      const single = { date: s.date, variants: [s.variant] };
      const wrapper = document.createElement('div');
      renderVariants(single, wrapper, { showSave: true, showRemove: true });
      grid.appendChild(wrapper.firstElementChild);
    });
  }

  // ---------- HISTORY ----------
  function addToHistory(requestRecord) {
    const history = getHistory();
    history.unshift(requestRecord);
    setHistory(history.slice(0, 20));
  }

  function renderHistory() {
    const history = getHistory();
    const list = $('#historyList');
    const empty = $('#historyEmpty');
    list.innerHTML = '';
    if (!history.length) { empty.hidden = false; return; }
    empty.hidden = true;

    history.forEach((entry) => {
      const li = document.createElement('li');
      const date = new Date(entry.date);
      const dateStr = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const preview = (entry.context || '').slice(0, 80) + (entry.context.length > 80 ? '…' : '');
      li.innerHTML = `
        <div class="history-context">
          <div>${escapeHtml(preview)}</div>
          <div class="history-date">${dateStr} · ${(entry.variants || []).length} variants</div>
        </div>
        <button type="button" class="history-view">View</button>
      `;
      li.querySelector('.history-view').addEventListener('click', () => {
        $$('.tab-btn').forEach((b) => b.classList.remove('is-active'));
        $$('.tab-panel').forEach((p) => p.classList.remove('is-active'));
        document.querySelector('[data-tab="compose"]').classList.add('is-active');
        $('#tab-compose').classList.add('is-active');
        contextInput.value = entry.context || '';
        if (entry.originalMessage) {
          originalInput.hidden = false;
          originalInput.value = entry.originalMessage;
          toggleOriginal.textContent = '− Hide the original message field';
        }
        if (entry.options) {
          $('#messageType').value = entry.options.messageType || 'email';
          $('#formality').value = entry.options.formality || 'no preference';
          $('#numVariants').value = entry.options.numVariants || '3';
          $('#language').value = entry.options.language || 'auto';
        }
        emptyState.hidden = true;
        renderVariants(entry, variantResults, { showSave: true });
      });
      list.appendChild(li);
    });
  }

  // ---------- COUNTS ----------
  function updateCounts() {
    const saved = getSaved();
    $('#savedCount').textContent = saved.length ? `(${saved.length})` : '';
  }

  // ---------- UTIL ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- INIT ----------
  updateCounts();
})();
