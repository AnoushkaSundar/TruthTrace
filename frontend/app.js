/* ═══════════════════════════════════════════════════════════════════
   TRUTHTRACE — Frontend Application Logic
   ═══════════════════════════════════════════════════════════════════ */

// Flask serves both the frontend and API from the same origin,
// so we use a relative base URL. This works regardless of port or host.
const API_BASE = '';

// ─── STATE ───────────────────────────────────────────────────────────
let currentClaim = '';
let currentVerdict = null;
let investigationHistory = [];
let loadingInterval = null;
let loadingStepInterval = null;
let activeTab = 'text';
let selectedImageFile = null;

// ─── LOADING MESSAGES ────────────────────────────────────────────────
const LOADING_MESSAGES = [
  'Cross-referencing sources...',
  'Scanning for logical fallacies...',
  'Checking emotional manipulation patterns...',
  'Identifying who benefits from this claim...',
  'Running forensic analysis...',
  'Analysing motive structures...',
  'Decomposing core assertions...',
  'Preparing verdict...',
];

// ─── DOM REFS ─────────────────────────────────────────────────────────
const inputScreen     = document.getElementById('inputScreen');
const loadingScreen   = document.getElementById('loadingScreen');
const verdictScreen   = document.getElementById('verdictScreen');
const errorScreen     = document.getElementById('errorScreen');
const claimInput      = document.getElementById('claimInput');
const charCount       = document.getElementById('charCount');
const charCounter     = document.getElementById('charCounter');
const inputError      = document.getElementById('inputError');
const investigateBtn  = document.getElementById('investigateBtn');
const backBtn         = document.getElementById('backBtn');
const retryBtn        = document.getElementById('retryBtn');
const errorBackBtn    = document.getElementById('errorBackBtn');
const errorMessage    = document.getElementById('errorMessage');
const loadingMessage  = document.getElementById('loadingMessage');
const historySidebar  = document.getElementById('historySidebar');
const sidebarOverlay  = document.getElementById('sidebarOverlay');
const toggleHistory   = document.getElementById('toggleHistory');
const closeSidebar    = document.getElementById('closeSidebar');
const historyBadge    = document.getElementById('historyBadge');
const historyList     = document.getElementById('historyList');

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────────
function showScreen(id) {
  [inputScreen, loadingScreen, verdictScreen, errorScreen].forEach(s => {
    s.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────
const tabText  = document.getElementById('tabText');
const tabImage = document.getElementById('tabImage');
const panelText  = document.getElementById('panelText');
const panelImage = document.getElementById('panelImage');
const btnLabel = investigateBtn.querySelector('.btn-label');

function switchTab(tab) {
  activeTab = tab;
  tabText.classList.toggle('active', tab === 'text');
  tabImage.classList.toggle('active', tab === 'image');
  tabText.setAttribute('aria-selected', String(tab === 'text'));
  tabImage.setAttribute('aria-selected', String(tab === 'image'));
  panelText.classList.toggle('hidden', tab !== 'text');
  panelImage.classList.toggle('hidden', tab !== 'image');
  btnLabel.textContent = tab === 'text' ? 'Investigate Claim' : 'Investigate Image';
  clearError();
}

tabText.addEventListener('click', () => switchTab('text'));
tabImage.addEventListener('click', () => switchTab('image'));

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────
const uploadZone   = document.getElementById('uploadZone');
const imageFileInput = document.getElementById('imageFileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg   = document.getElementById('previewImg');
const clearImageBtn = document.getElementById('clearImageBtn');
const imageError   = document.getElementById('imageError');

uploadZone.addEventListener('click', () => imageFileInput.click());
uploadZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') imageFileInput.click(); });
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setImageFile(file);
});
imageFileInput.addEventListener('change', () => {
  if (imageFileInput.files[0]) setImageFile(imageFileInput.files[0]);
});
clearImageBtn.addEventListener('click', clearImage);

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function setImageFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    imageError.textContent = 'Unsupported format. Please upload JPEG, PNG, GIF, or WebP.';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    imageError.textContent = 'Image is too large. Maximum size is 10 MB.';
    return;
  }
  imageError.textContent = '';
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    imagePreview.style.display = '';
    uploadZone.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedImageFile = null;
  previewImg.src = '';
  imagePreview.style.display = 'none';
  uploadZone.style.display = '';
  imageFileInput.value = '';
  imageError.textContent = '';
}

// ─── CHAR COUNTER ────────────────────────────────────────────────────
claimInput.addEventListener('input', () => {
  const len = claimInput.value.length;
  charCount.textContent = len;
  charCounter.className = 'char-counter';
  if (len > 1800) charCounter.classList.add('danger');
  else if (len > 1400) charCounter.classList.add('warning');
  if (inputError.textContent) clearError();
});

function clearError() {
  inputError.textContent = '';
  if (imageError) imageError.textContent = '';
}

function showError(msg) {
  inputError.textContent = msg;
  claimInput.focus();
}

// ─── DEMO BUTTONS ────────────────────────────────────────────────────
document.querySelectorAll('.btn-demo').forEach(btn => {
  btn.addEventListener('click', () => {
    const claim = btn.getAttribute('data-claim');
    claimInput.value = claim;
    charCount.textContent = claim.length;
    charCounter.className = 'char-counter';
    clearError();
    claimInput.focus();
  });
});

// ─── INVESTIGATE ─────────────────────────────────────────────────────
investigateBtn.addEventListener('click', () => {
  if (activeTab === 'image') runImageInvestigation();
  else runInvestigation();
});
retryBtn.addEventListener('click', () => {
  if (activeTab === 'image') {
    if (selectedImageFile) runImageInvestigation();
    else showScreen('inputScreen');
  } else {
    if (currentClaim && !currentClaim.startsWith('[Image:')) runInvestigation(currentClaim);
    else showScreen('inputScreen');
  }
});

claimInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runInvestigation();
});

async function runInvestigation(claimOverride) {
  const claim = (claimOverride || claimInput.value).trim();

  if (!claim) { showError('Please enter a claim to investigate.'); return; }
  if (claim.length < 10) { showError('Claim must be at least 10 characters.'); return; }
  if (claim.length > 2000) { showError('Claim must not exceed 2000 characters.'); return; }

  currentClaim = claim;
  startLoading();
  showScreen('loadingScreen');

  try {
    const data = await fetchVerdict(claim);
    stopLoading();
    currentVerdict = data;
    addToHistory(data, claim);
    renderVerdict(data);
    showScreen('verdictScreen');
  } catch (err) {
    stopLoading();
    errorMessage.textContent = err.message || 'Something went wrong. Please try again.';
    showScreen('errorScreen');
  }
}

async function runImageInvestigation() {
  if (!selectedImageFile) {
    imageError.textContent = 'Please select an image to investigate.';
    return;
  }

  currentClaim = `[Image: ${selectedImageFile.name}]`;
  startLoading();
  showScreen('loadingScreen');

  try {
    const formData = new FormData();
    formData.append('image', selectedImageFile);

    const res = await fetch(`${API_BASE}/api/investigate-image`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      let errMsg = `Server error (${res.status})`;
      try {
        const errData = await res.json();
        if (errData.error) errMsg = errData.error;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    stopLoading();
    currentVerdict = data;
    addToHistory(data, currentClaim);
    renderVerdict(data);
    showScreen('verdictScreen');
  } catch (err) {
    stopLoading();
    errorMessage.textContent = err.message || 'Something went wrong. Please try again.';
    showScreen('errorScreen');
  }
}

// ─── API CALL ─────────────────────────────────────────────────────────
async function fetchVerdict(claim) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${API_BASE}/api/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errMsg = `Server error (${res.status})`;
      try {
        const errData = await res.json();
        if (errData.error) errMsg = errData.error;
      } catch (_) {}
      throw new Error(errMsg);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  }
}

// ─── LOADING ANIMATION ────────────────────────────────────────────────
function startLoading() {
  let msgIndex = 0;
  loadingMessage.textContent = LOADING_MESSAGES[0];

  loadingInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
    loadingMessage.style.opacity = '0';
    setTimeout(() => {
      loadingMessage.textContent = LOADING_MESSAGES[msgIndex];
      loadingMessage.style.opacity = '1';
    }, 200);
  }, 2200);

  const steps = ['step1','step2','step3','step4'];
  let stepIdx = 0;
  steps.forEach(id => {
    const el = document.getElementById(id);
    el.className = 'loading-step';
  });
  document.getElementById('step1').className = 'loading-step active';

  loadingStepInterval = setInterval(() => {
    if (stepIdx < steps.length - 1) {
      document.getElementById(steps[stepIdx]).className = 'loading-step done';
      stepIdx++;
      document.getElementById(steps[stepIdx]).className = 'loading-step active';
    }
  }, 2000);
}

function stopLoading() {
  if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
  if (loadingStepInterval) { clearInterval(loadingStepInterval); loadingStepInterval = null; }
  // Reset steps
  ['step1','step2','step3','step4'].forEach((id, i) => {
    document.getElementById(id).className = i === 0 ? 'loading-step active' : 'loading-step';
  });
}

// ─── VERDICT RENDERING ────────────────────────────────────────────────
const VERDICT_META = {
  'TRUE':          { cls: 'badge-true',          icon: '✓', color: '#10b981' },
  'MOSTLY TRUE':   { cls: 'badge-mostly-true',   icon: '~', color: '#34d399' },
  'MISLEADING':    { cls: 'badge-misleading',     icon: '⚠', color: '#f59e0b' },
  'MOSTLY FALSE':  { cls: 'badge-mostly-false',   icon: '✗', color: '#fb923c' },
  'FALSE':         { cls: 'badge-false',          icon: '✗', color: '#ef4444' },
  'UNVERIFIABLE':  { cls: 'badge-unverifiable',   icon: '?', color: '#6b7280' },
};

const REC_META = {
  'Safe to share':       { cls: 'safe',     icon: '✅' },
  'Share with caution':  { cls: 'caution',  icon: '⚠️' },
  'Do not share':        { cls: 'no-share', icon: '🚫' },
  'Verify before sharing': { cls: 'verify', icon: '🔍' },
};

function renderVerdict(d) {
  // Case ID
  document.getElementById('caseId').textContent = d.case_id || 'TT-0000';

  // Verdict badge
  const vm = VERDICT_META[d.verdict] || VERDICT_META['UNVERIFIABLE'];
  const badge = document.getElementById('verdictBadge');
  badge.className = `verdict-badge ${vm.cls}`;
  document.getElementById('verdictIcon').textContent = vm.icon;
  document.getElementById('verdictLabel').textContent = d.verdict;

  // Summary
  document.getElementById('summaryText').textContent = d.summary || '';

  // Confidence bar
  const conf = parseInt(d.confidence) || 0;
  const bar = document.getElementById('confidenceBar');
  bar.style.background = `linear-gradient(90deg, ${vm.color}, ${vm.color}aa)`;
  setTimeout(() => { bar.style.width = conf + '%'; }, 100);
  document.getElementById('confidencePct').textContent = conf + '%';

  // Danger chip
  const dangerChip = document.getElementById('dangerChip');
  const dl = (d.danger_level || 'MEDIUM').toLowerCase();
  dangerChip.className = `danger-chip ${dl}`;
  dangerChip.textContent = d.danger_level || 'MEDIUM';

  // Manipulation gauge
  const ms = parseFloat(d.manipulation_score) || 0;
  setTimeout(() => {
    document.getElementById('manipGauge').style.width = (ms / 10 * 100) + '%';
  }, 100);
  document.getElementById('manipScore').textContent = ms.toFixed(1) + ' / 10';

  // Recommendation
  const rec = d.recommendation || 'Verify before sharing';
  const rm = REC_META[rec] || REC_META['Verify before sharing'];
  const recIcon = document.getElementById('recIcon');
  recIcon.className = `rec-icon ${rm.cls}`;
  recIcon.textContent = rm.icon;
  document.getElementById('recText').textContent = rec;

  // Red flags
  const rfList = document.getElementById('redFlagsList');
  rfList.innerHTML = '';
  if (d.red_flags && d.red_flags.length > 0) {
    d.red_flags.forEach(rf => {
      const sev = (rf.severity || 'MEDIUM').toLowerCase();
      rfList.innerHTML += `
        <div class="red-flag-item">
          <span class="flag-sev ${sev}">${(rf.severity || 'MEDIUM').toUpperCase()}</span>
          <span class="flag-text">${escapeHtml(rf.flag || '')}</span>
        </div>`;
    });
    document.getElementById('redFlagsSection').style.display = '';
  } else {
    rfList.innerHTML = '<div class="empty-state">No significant red flags detected.</div>';
  }

  // Logical fallacies
  const fallGrid = document.getElementById('fallaciesGrid');
  fallGrid.innerHTML = '';
  if (d.logical_fallacies && d.logical_fallacies.length > 0) {
    d.logical_fallacies.forEach(f => {
      fallGrid.innerHTML += `
        <div class="fallacy-card">
          <div class="fallacy-name">${escapeHtml(f.name || '')}</div>
          <div class="fallacy-explanation">${escapeHtml(f.explanation || '')}</div>
        </div>`;
    });
    document.getElementById('fallaciesSection').style.display = '';
  } else {
    fallGrid.innerHTML = '<div class="empty-state">No logical fallacies detected.</div>';
  }

  // Evidence
  renderList('evidenceSupporting', (d.evidence && d.evidence.supporting) || []);
  renderList('evidenceContradicting', (d.evidence && d.evidence.contradicting) || []);

  // Decomposition
  const dec = d.decomposition || {};
  const dg = document.getElementById('decompGrid');
  dg.innerHTML = '';
  const decompFields = [
    { key: 'core_assertion',     label: 'Core Assertion', isList: false },
    { key: 'verifiable_facts',   label: 'Verifiable Facts',       isList: true },
    { key: 'implicit_assumptions',label: 'Implicit Assumptions',  isList: true },
    { key: 'missing_context',    label: 'Missing Context',        isList: true },
    { key: 'emotional_triggers', label: 'Emotional Triggers',     isList: true },
  ];
  decompFields.forEach(({ key, label, isList }) => {
    const val = dec[key];
    if (!val || (Array.isArray(val) && val.length === 0)) return;
    if (isList) {
      const items = Array.isArray(val) ? val : [val];
      dg.innerHTML += `
        <div class="decomp-group">
          <div class="decomp-group-title">${label}</div>
          <ul class="decomp-list">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
        </div>`;
    } else {
      dg.innerHTML += `
        <div class="decomp-group" style="grid-column: 1/-1">
          <div class="decomp-group-title">${label}</div>
          <p class="decomp-text">${escapeHtml(val)}</p>
        </div>`;
    }
  });

  // Motive
  document.getElementById('motiveText').textContent = d.motive_analysis || '';

  // Reasoning
  document.getElementById('reasoningText').textContent = d.reasoning || '';

  // Investigator's note
  document.getElementById('noteText').textContent = d.investigators_note || '';

  // Social media signals
  const sms = d.social_media_signals;
  const smSection = document.getElementById('socialMediaSection');
  if (sms && sms.is_social_media_post) {
    smSection.style.display = '';
    document.getElementById('smPlatform').textContent = sms.platform_detected || 'Unknown';
    const baitEl = document.getElementById('smEngagementBait');
    baitEl.textContent = sms.engagement_bait ? 'Yes' : 'No';
    baitEl.className = 'social-meta-value ' + (sms.engagement_bait ? 'bait-yes' : 'bait-no');

    const tacticsWrap = document.getElementById('smTacticsWrap');
    const tacticsList = document.getElementById('smTacticsList');
    if (sms.virality_tactics && sms.virality_tactics.length > 0) {
      tacticsList.innerHTML = sms.virality_tactics.map(t => `<span class="tactic-tag">${escapeHtml(t)}</span>`).join('');
      tacticsWrap.style.display = '';
    } else {
      tacticsWrap.style.display = 'none';
    }

    const credWrap = document.getElementById('smCredibilityWrap');
    if (sms.credibility_assessment) {
      document.getElementById('smCredibilityText').textContent = sms.credibility_assessment;
      credWrap.style.display = '';
    } else {
      credWrap.style.display = 'none';
    }
  } else {
    smSection.style.display = 'none';
  }

  // Reset collapsibles
  resetCollapsibles();
}

function renderList(elId, items) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  if (items.length === 0) {
    el.innerHTML = '<li style="color:var(--text-muted);font-style:italic;border:none;background:none;padding:0">None identified</li>';
  } else {
    items.forEach(item => { el.innerHTML += `<li>${escapeHtml(item)}</li>`; });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── COLLAPSIBLES ─────────────────────────────────────────────────────
function resetCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
    const bodyId = btn.getAttribute('aria-controls');
    if (bodyId) document.getElementById(bodyId)?.classList.remove('open');
  });
}

document.querySelectorAll('.collapsible-header').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    const bodyId = btn.getAttribute('aria-controls');
    if (bodyId) document.getElementById(bodyId)?.classList.toggle('open', !expanded);
  });
});

// Back buttons
backBtn.addEventListener('click', () => {
  claimInput.value = currentClaim;
  charCount.textContent = currentClaim.length;
  showScreen('inputScreen');
});
errorBackBtn.addEventListener('click', () => showScreen('inputScreen'));

// ─── HISTORY ──────────────────────────────────────────────────────────
function addToHistory(verdict, claim) {
  investigationHistory.unshift({ verdict, claim, ts: Date.now() });
  if (investigationHistory.length > 10) investigationHistory.pop();
  updateHistoryUI();
}

function updateHistoryUI() {
  const count = investigationHistory.length;
  if (count > 0) {
    historyBadge.style.display = 'inline-flex';
    historyBadge.textContent = count;
  } else {
    historyBadge.style.display = 'none';
  }

  if (count === 0) {
    historyList.innerHTML = '<div class="history-empty">No investigations yet. Submit a claim to begin.</div>';
    return;
  }

  historyList.innerHTML = '';
  investigationHistory.forEach((item, idx) => {
    const vm = VERDICT_META[item.verdict.verdict] || VERDICT_META['UNVERIFIABLE'];
    const shortClaim = item.claim.length > 70 ? item.claim.slice(0, 70) + '…' : item.claim;
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-item-top">
        <span class="history-verdict-mini ${vm.cls}">${item.verdict.verdict || 'UNKNOWN'}</span>
        <span class="history-case-id">${item.verdict.case_id || ''}</span>
      </div>
      <div class="history-summary">${escapeHtml(item.verdict.summary || shortClaim)}</div>`;
    div.addEventListener('click', () => {
      currentVerdict = item.verdict;
      currentClaim = item.claim;
      renderVerdict(item.verdict);
      showScreen('verdictScreen');
      closeSidebarFn();
    });
    historyList.appendChild(div);
  });
}

// ─── HISTORY SIDEBAR TOGGLE ───────────────────────────────────────────
function openSidebarFn() {
  historySidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
  historySidebar.setAttribute('aria-hidden', 'false');
}
function closeSidebarFn() {
  historySidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
  historySidebar.setAttribute('aria-hidden', 'true');
}

toggleHistory.addEventListener('click', () => {
  if (historySidebar.classList.contains('open')) closeSidebarFn();
  else openSidebarFn();
});
closeSidebar.addEventListener('click', closeSidebarFn);
sidebarOverlay.addEventListener('click', closeSidebarFn);

// ─── KEYBOARD NAV ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (historySidebar.classList.contains('open')) closeSidebarFn();
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────
updateHistoryUI();
console.log('%cTruthTrace v1.0 — AI Evidence Investigator', 'color:#00d4ff;font-size:14px;font-weight:bold;');
console.log('%cTeam F — AI Detective | April 2026', 'color:#7c3aed;font-size:11px;');
