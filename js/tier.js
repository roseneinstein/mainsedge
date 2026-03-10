// ── MAINSEDGE · TIER & USAGE MANAGER ──

const Tier = (() => {
  const FREE_LIMIT    = 5;
  const USAGE_KEY     = 'mainsedge_usage';
  const APIKEY_KEY    = 'mainsedge_gemini_key';

  // ── USAGE TRACKING ──

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  function getUsageToday() {
    try {
      const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      return data[getTodayKey()] || 0;
    } catch { return 0; }
  }

  function incrementUsage() {
    try {
      const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
      const today = getTodayKey();
      data[today] = (data[today] || 0) + 1;
      // Clean up keys older than 7 days to keep storage tidy
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      Object.keys(data).forEach(k => {
        if (new Date(k) < cutoff) delete data[k];
      });
      localStorage.setItem(USAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  function canEvaluate() {
    return getUsageToday() < FREE_LIMIT;
  }

  function remaining() {
    return Math.max(0, FREE_LIMIT - getUsageToday());
  }

  // ── API KEY ──

  function getApiKey() {
    try { return localStorage.getItem(APIKEY_KEY) || ''; } catch { return ''; }
  }

  function setApiKey(key) {
    try { localStorage.setItem(APIKEY_KEY, key.trim()); } catch {}
  }

  function clearApiKey() {
    try { localStorage.removeItem(APIKEY_KEY); } catch {}
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  // ── UI HELPERS ──

  // Renders usage bar into any element with id="usage-bar-wrap"
  function renderUsageBar() {
    const wrap = document.getElementById('usage-bar-wrap');
    if (!wrap) return;
    const used = getUsageToday();
    const pct  = (used / FREE_LIMIT) * 100;
    const color = pct >= 100 ? 'var(--rust)' : pct >= 60 ? 'var(--gold)' : 'var(--gold)';
    wrap.innerHTML = `
      <div class="usage-wrap">
        <div class="usage-row">
          <span class="usage-label">Free evaluations today</span>
          <span class="usage-count">${used} / ${FREE_LIMIT}</span>
        </div>
        <div class="usage-track">
          <div class="usage-fill" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>`;
  }

  // Renders API key section into element with id="apikey-wrap"
  function renderApiKeySection() {
    const wrap = document.getElementById('apikey-wrap');
    if (!wrap) return;

    if (hasApiKey()) {
      wrap.innerHTML = `
        <div class="apikey-set-row">
          <span>✓ Gemini API key active</span>
          <span class="apikey-change" id="apikey-change-btn">Change</span>
        </div>`;
      document.getElementById('apikey-change-btn')?.addEventListener('click', () => {
        clearApiKey();
        renderApiKeySection();
      });
    } else {
      wrap.innerHTML = `
        <div class="apikey-box">
          <span class="label">Gemini API Key</span>
          <div class="apikey-row">
            <input class="input" type="password" id="apikey-input"
              placeholder="AIza…" autocomplete="off" spellcheck="false" />
            <button class="btn btn-gold" id="apikey-save-btn" style="flex-shrink:0;">Save</button>
          </div>
          <div class="apikey-hint">
            Free at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a>
            · Stored only in your browser. Never sent to our servers.
          </div>
        </div>`;

      const input = document.getElementById('apikey-input');
      const saveBtn = document.getElementById('apikey-save-btn');

      function trySave() {
        const val = input?.value?.trim();
        if (!val) { input?.focus(); return; }
        setApiKey(val);
        renderApiKeySection();
      }

      saveBtn?.addEventListener('click', trySave);
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') trySave(); });
    }
  }

  // Show / hide locked overlay on a section
  function applyLock(sectionId, locked, onUnlockClick) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const existing = section.querySelector('.lock-overlay');
    if (!locked) {
      existing?.remove();
      section.classList.remove('locked-section');
      section.querySelectorAll('.blurred').forEach(el => el.classList.remove('blurred'));
      return;
    }
    section.classList.add('locked-section');
    if (!existing) {
      const overlay = document.createElement('div');
      overlay.className = 'lock-overlay';
      overlay.innerHTML = `
        <button class="btn btn-primary" style="font-size:0.8rem;padding:0.5rem 1.2rem;">
          🔒 Unlock — Upgrade to Pro
        </button>`;
      overlay.querySelector('button')?.addEventListener('click', onUnlockClick || (() => {}));
      section.appendChild(overlay);
    }
  }

  // Update submit button state
  function updateSubmitBtn() {
    const btn = document.getElementById('submit-btn');
    if (!btn) return;
    if (!canEvaluate()) {
      btn.disabled = true;
      btn.textContent = `Daily limit reached (${FREE_LIMIT}/day) — Upgrade for unlimited`;
    } else {
      btn.disabled = false;
      btn.textContent = 'Evaluate My Answer →';
    }
  }

  return {
    FREE_LIMIT,
    getUsageToday,
    incrementUsage,
    canEvaluate,
    remaining,
    getApiKey,
    setApiKey,
    clearApiKey,
    hasApiKey,
    renderUsageBar,
    renderApiKeySection,
    applyLock,
    updateSubmitBtn
  };
})();
