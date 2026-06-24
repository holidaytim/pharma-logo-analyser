// ── State ──────────────────────────────────────────────────────────────────
let imageBase64 = null;
let imageMimeType = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const uploadZone      = document.getElementById('uploadZone');
const fileInput       = document.getElementById('fileInput');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const previewArea     = document.getElementById('previewArea');
const logoPreview     = document.getElementById('logoPreview');
const removeBtn       = document.getElementById('removeBtn');
const brandNameInput  = document.getElementById('brandName');
const innNameInput    = document.getElementById('innName');
const contextSel      = document.getElementById('context');
const auditTypeSel    = document.getElementById('auditType');
const runBtn          = document.getElementById('runBtn');
const statusMsg       = document.getElementById('statusMsg');
const errorMsg        = document.getElementById('errorMsg');
const reportSection   = document.getElementById('reportSection');
const canvas          = document.getElementById('conversionCanvas');

// ── Upload ─────────────────────────────────────────────────────────────────
uploadZone.addEventListener('click', e => {
  if (!e.target.closest('.remove-btn')) fileInput.click();
});
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) processFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});
removeBtn.addEventListener('click', e => { e.stopPropagation(); clearUpload(); });
brandNameInput.addEventListener('input', syncRunBtn);

function clearUpload() {
  imageBase64 = null;
  imageMimeType = null;
  fileInput.value = '';
  logoPreview.src = '';
  previewArea.classList.remove('visible');
  uploadPlaceholder.style.display = '';
  syncRunBtn();
}

async function processFile(file) {
  const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
  const isPng = file.type === 'image/png' || file.name.endsWith('.png');
  if (!isSvg && !isPng) { showError('Please upload a PNG or SVG file.'); return; }
  hideError();

  if (isSvg) {
    try {
      const png = await svgToPng(file);
      imageBase64 = png;
      imageMimeType = 'image/png';
      // Show original SVG as preview
      const url = URL.createObjectURL(file);
      logoPreview.src = url;
      logoPreview.onload = () => URL.revokeObjectURL(url);
    } catch {
      showError('Could not render SVG. Try converting to PNG first.');
      return;
    }
  } else {
    await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        imageBase64 = dataUrl.split(',')[1];
        imageMimeType = 'image/png';
        logoPreview.src = dataUrl;
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  uploadPlaceholder.style.display = 'none';
  previewArea.classList.add('visible');
  syncRunBtn();
}

function svgToPng(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const blob = new Blob([e.target.result], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth  || 800;
        const h = img.naturalHeight || 400;
        const scale = 2;
        canvas.width  = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          const fr = new FileReader();
          fr.onload = ev => resolve(ev.target.result.split(',')[1]);
          fr.readAsDataURL(blob);
        }, 'image/png', 0.95);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')); };
      img.src = url;
    };
    reader.readAsText(file);
  });
}

function syncRunBtn() {
  runBtn.disabled = !(imageBase64 && brandNameInput.value.trim());
}

// ── Analysis ───────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (runBtn.disabled) return;
  hideError();
  setLoading(true);
  setStatus('Analysing logo — this may take 20–30 seconds…');

  try {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType: imageMimeType,
        brandName: brandNameInput.value.trim(),
        innName:   innNameInput.value.trim(),
        context:   contextSel.value,
        auditType: auditTypeSel.value,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const analysis = await res.json();
    setStatus('');
    renderReport(analysis);

  } catch (err) {
    setStatus('');
    showError(`Analysis failed: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  runBtn.classList.toggle('loading', on);
  runBtn.disabled = on;
  runBtn.querySelector('.btn-text').textContent = on ? 'Analysing…' : 'Analyse Logo';
}

function setStatus(msg) { statusMsg.textContent = msg; }
function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('visible'); }
function hideError()    { errorMsg.classList.remove('visible'); }

// ── Report ─────────────────────────────────────────────────────────────────
const TEST_CONFIG = {
  fdaGuidance:          { name: 'FDA Guidance',              icon: '⚖️',  bg: '#dbeafe', cat: 'regulatory' },
  innRatio:             { name: 'INN / Brand Name Ratio',    icon: '📏',  bg: '#dbeafe', cat: 'regulatory' },
  regulatoryLegibility: { name: 'Regulatory Legibility',     icon: '🔍',  bg: '#dbeafe', cat: 'regulatory' },
  colorblindness:       { name: 'Colour Blindness',          icon: '👁️',  bg: '#f0fdf4', cat: 'visual'     },
  monochrome:           { name: 'Monochrome / Fax',          icon: '◑',   bg: '#f0fdf4', cat: 'visual'     },
  contrast:             { name: 'Contrast & Background',     icon: '◐',   bg: '#f0fdf4', cat: 'visual'     },
  sizeScaling:          { name: 'Size Scaling',              icon: '⊞',   bg: '#f0fdf4', cat: 'visual'     },
  balance:              { name: 'Balance',                   icon: '⚖',   bg: '#f0fdf4', cat: 'visual'     },
  brandPersonality:     { name: 'Brand Personality',        icon: '✦',   bg: '#fdf4ff', cat: 'brand'      },
  therapeuticAreaFit:   { name: 'Therapeutic Area Fit',     icon: '◈',   bg: '#fdf4ff', cat: 'brand'      },
  containersProportions:{ name: 'Containers & Proportions', icon: '▣',   bg: '#fdf4ff', cat: 'brand'      },
};

const CATEGORIES = [
  { id: 'regulatory', label: 'Regulatory & Compliance', tests: ['fdaGuidance','innRatio','regulatoryLegibility'] },
  { id: 'visual',     label: 'Visual Performance',      tests: ['colorblindness','monochrome','contrast','sizeScaling','balance'] },
  { id: 'brand',      label: 'Brand',                   tests: ['brandPersonality','therapeuticAreaFit','containersProportions'] },
];

function scoreColor(n) {
  if (n >= 80) return 'var(--green)';
  if (n >= 50) return 'var(--amber)';
  return 'var(--red)';
}

function avgScore(testIds, analysis) {
  const vals = testIds.map(id => analysis.tests[id]?.score ?? 0);
  return Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
}

function statusLabel(s) {
  return s === 'pass' ? '✓ Pass' : s === 'warn' ? '⚠ Warn' : '✕ Fail';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function renderReport(data) {
  reportSection.innerHTML = '';
  reportSection.classList.add('visible');

  // ── Overall card ──
  const circ = 2 * Math.PI * 40;
  const offset = circ - (data.overallScore / 100) * circ;
  const col = scoreColor(data.overallScore);

  const overall = el('div', 'overall-card', `
    <div class="score-circle">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="10"/>
        <circle cx="48" cy="48" r="40" fill="none" stroke="${col}" stroke-width="10"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
      </svg>
      <div class="score-text">
        <span class="score-num">${data.overallScore}</span>
        <span class="score-denom">/ 100</span>
      </div>
    </div>
    <div class="overall-info">
      <h2>${esc(data.drugName || brandNameInput.value)}</h2>
      <div class="drug-inn">${data.innName && data.innName !== 'not specified' ? esc(data.innName) : ''}</div>
      <div class="overall-badge ${data.overallStatus}">${statusLabel(data.overallStatus)}</div>
      <p class="overall-summary">${esc(data.summary)}</p>
    </div>
  `);
  reportSection.appendChild(overall);

  // ── Category scores ──
  const catRow = el('div', 'cat-scores');
  CATEGORIES.forEach(cat => {
    const avg = avgScore(cat.tests, data);
    const c   = scoreColor(avg);
    catRow.innerHTML += `
      <div class="cat-card">
        <h3>${cat.label}</h3>
        <div class="cat-bar-wrap">
          <div class="cat-bar"><div class="cat-bar-fill" style="width:${avg}%;background:${c}"></div></div>
          <span class="cat-score-num" style="color:${c}">${avg}</span>
        </div>
      </div>`;
  });
  reportSection.appendChild(catRow);

  // ── Test sections ──
  CATEGORIES.forEach(cat => {
    const section = el('div', 'test-section', `<div class="test-section-title">${cat.label}</div>`);
    const grid    = el('div', 'test-grid');

    cat.tests.forEach(id => {
      const test = data.tests[id];
      const cfg  = TEST_CONFIG[id];
      if (!test || !cfg) return;
      grid.appendChild(makeTestCard(id, test, cfg));
    });

    section.appendChild(grid);
    reportSection.appendChild(section);
  });

  setTimeout(() => reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function makeTestCard(id, test, cfg) {
  const card   = el('div', 'test-card');
  const col    = scoreColor(test.score);

  // Header
  const header = el('div', 'test-card-header', `
    <div class="test-icon" style="background:${cfg.bg}">${cfg.icon}</div>
    <div class="test-card-meta">
      <div class="test-name">${cfg.name}</div>
      <div class="test-headline">${esc(test.headline)}</div>
    </div>
    <span class="status-badge ${test.status}">${cap(test.status)}</span>
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `);

  // Score bar
  const scoreWrap = el('div', 'test-score-wrap', `
    <div class="test-score-bar">
      <div class="test-score-fill" style="width:${test.score}%;background:${col}"></div>
    </div>
    <div class="test-score-label" style="color:${col}">${test.score}/100</div>
  `);

  // Detail (hidden until toggled)
  const detail = el('div', 'test-detail', buildDetail(id, test));

  header.addEventListener('click', () => {
    header.classList.toggle('expanded');
    detail.classList.toggle('visible');
  });

  card.append(header, scoreWrap, detail);
  return card;
}

function buildDetail(id, test) {
  let h = `<p class="detail-text">${esc(test.detail)}</p>`;

  switch (id) {
    case 'innRatio':
      h += innRatioVisual(test);
      h += subGrid([
        { label: 'Labelling compliance',    value: test.labellingStatus   === 'na' ? 'N/A' : cap(test.labellingStatus),   cls: test.labellingStatus   === 'na' ? 'na' : test.labellingStatus   },
        { label: 'Promotional compliance',  value: test.promotionalStatus === 'na' ? 'N/A' : cap(test.promotionalStatus), cls: test.promotionalStatus === 'na' ? 'na' : test.promotionalStatus },
      ]);
      break;

    case 'sizeScaling':
      h += subGrid([
        { label: 'Pill bottle / label',    value: cap(test.pillBottle),   cls: test.pillBottle   },
        { label: 'Package insert',         value: cap(test.packageInsert),cls: test.packageInsert},
        { label: 'Digital ad',             value: cap(test.digitalAd),    cls: test.digitalAd    },
        test.minimumRecommendedSize ? { label: 'Min. recommended size', value: test.minimumRecommendedSize, cls: '' } : null,
      ].filter(Boolean));
      break;

    case 'brandPersonality':
      if (test.traits?.length)
        h += `<div class="trait-tags">${test.traits.map(t => `<span class="trait-tag">${esc(t)}</span>`).join('')}</div>`;
      if (test.patientPerception || test.hcpPerception)
        h += `<div class="perception-grid">
          <div class="perception-card"><div class="perception-lbl">Patient perception</div><div class="perception-txt">${esc(test.patientPerception||'—')}</div></div>
          <div class="perception-card"><div class="perception-lbl">HCP perception</div><div class="perception-txt">${esc(test.hcpPerception||'—')}</div></div>
        </div>`;
      break;

    case 'colorblindness':
      if (test.affectedTypes?.length)
        h += `<div class="trait-tags">${test.affectedTypes.map(t => `<span class="trait-tag amber">${esc(t)}</span>`).join('')}</div>`;
      break;

    case 'monochrome':
      h += subGrid([
        test.faxPerformance          ? { label: 'Fax / thermal print',          value: cap(test.faxPerformance),          cls: test.faxPerformance } : null,
        test.regulatorySubmissionRisk? { label: 'Regulatory submission risk',    value: cap(test.regulatorySubmissionRisk),cls: test.regulatorySubmissionRisk } : null,
      ].filter(Boolean));
      break;

    case 'contrast':
      h += subGrid([
        test.wcagLevel               ? { label: 'WCAG level',       value: test.wcagLevel,                    cls: test.wcagLevel === 'below-AA' ? 'fail' : test.wcagLevel === 'AA' ? 'warn' : 'pass' } : null,
        test.darkBackgroundPerformance?{ label: 'Dark background',   value: cap(test.darkBackgroundPerformance),cls: test.darkBackgroundPerformance } : null,
      ].filter(Boolean));
      break;

    case 'fdaGuidance':
      if (test.regulations?.length)
        h += `<div class="recs"><div class="recs-title">Regulations referenced</div><ul>${test.regulations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
      break;
  }

  if (test.recommendations?.length)
    h += `<div class="recs"><div class="recs-title">Recommendations</div><ul>${test.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;

  return h;
}

function innRatioVisual(test) {
  const brandSize  = test.brandNameRelativeSize ?? 10;
  const innSize    = test.innRelativeSize ?? 5;
  const innPct     = Math.min(100, Math.round((innSize / brandSize) * 100));
  const threshold  = test.fdaRequirementPercent ?? 50;
  const innColor   = innPct >= threshold ? 'var(--green)' : innPct >= threshold * 0.7 ? 'var(--amber)' : 'var(--red)';

  return `
    <div class="inn-visual">
      <div class="inn-visual-title">Estimated type size relationship (21 CFR 201.10)</div>
      <div class="ratio-row">
        <span class="ratio-label">Brand name</span>
        <div class="ratio-track">
          <div class="ratio-fill" style="width:100%;background:var(--blue)">100%</div>
        </div>
      </div>
      <div class="ratio-row">
        <span class="ratio-label">INN / generic</span>
        <div class="ratio-track">
          <div class="ratio-fill" style="width:${innPct}%;background:${innColor}">${innPct}%</div>
          <div class="ratio-threshold-line" style="left:${threshold}%">
            <span class="ratio-threshold-lbl">FDA min ${threshold}%</span>
          </div>
        </div>
      </div>
      <p class="inn-visual-note">Size ratio is estimated from visual analysis. Verify exact measurements against production artwork.</p>
    </div>`;
}

function subGrid(items) {
  return `<div class="sub-grid">${items.map(it =>
    `<div class="sub-item">
      <div class="sub-label">${esc(it.label)}</div>
      <div class="sub-value ${it.cls || ''}">${esc(it.value)}</div>
    </div>`
  ).join('')}</div>`;
}

function el(tag, className, html = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}
