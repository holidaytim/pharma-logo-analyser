// ── State ──────────────────────────────────────────────────────────────────
let imageBase64 = null;
let imageMimeType = null;
let logoImage     = null;

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
  logoImage = null;
  fileInput.value = '';
  logoPreview.src = '';
  previewArea.classList.remove('visible');
  uploadPlaceholder.style.display = '';
  syncRunBtn();
}

const MAX_DIM = 750;

function fitDims(w, h) {
  const longest = Math.max(w, h);
  if (longest <= MAX_DIM) return { w, h };
  const s = MAX_DIM / longest;
  return { w: Math.round(w * s), h: Math.round(h * s) };
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
        const img = new Image();
        img.onload = () => {
          const { w, h } = fitDims(img.naturalWidth, img.naturalHeight);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(blob => {
            const fr = new FileReader();
            fr.onload = ev => {
              imageBase64 = ev.target.result.split(',')[1];
              imageMimeType = 'image/png';
              logoPreview.src = dataUrl;
              resolve();
            };
            fr.readAsDataURL(blob);
          }, 'image/png', 0.92);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  uploadPlaceholder.style.display = 'none';
  previewArea.classList.add('visible');
  logoImage = new Image();
  logoImage.src = `data:${imageMimeType};base64,${imageBase64}`;
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
        const { w, h } = fitDims(img.naturalWidth || 800, img.naturalHeight || 400);
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
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



// ── Demo mode ──────────────────────────────────────────────────────────────
const DEMO_DATA = {
  overallScore: 68, overallStatus: 'warn',
  summary: 'LUMIERA presents a professional pharmaceutical aesthetic with good regulatory legibility, but the INN-to-brand ratio requires attention for labelling compliance under 21 CFR 201.10(g)(1).',
  drugName: 'LUMIERA', innName: 'adalimumab',
  tests: {
    fdaGuidance: { score:62, status:'warn', headline:'FDA labelling compliance is borderline due to INN prominence concerns.', detail:'The brand name dominates without sufficient visual emphasis on the INN.', regulations:['21 CFR 201.10(g)(1)','21 CFR 201.100(b)(1)'], recommendation:'Ensure INN appears at minimum 50% of brand name type size on all labelling.' },
    innRatio: { score:45, status:'fail', headline:'INN is estimated at 30% of brand name size, below the 50% FDA minimum.', detail:'The proprietary name LUMIERA significantly outweighs the established name adalimumab in visual prominence.', labellingStatus:'fail', promotionalStatus:'warn', brandNameRelativeSize:10, innRelativeSize:3, estimatedRatioPercent:30, fdaRequirementPercent:50, recommendation:'Increase adalimumab type size to at least 50% of LUMIERA on all labelling.' },
    regulatoryLegibility: { score:78, status:'warn', headline:'Type is legible at standard sizes but small-format legibility is marginal.', detail:'The typeface is clean above 8pt but letter spacing may cause issues on small labels.', recommendation:'Test legibility at 6pt minimum for pill bottle labels.' },
    colorblindness: { score:82, status:'pass', headline:'Logo remains distinguishable across all major colour vision deficiencies.', detail:'The blue-on-white palette performs well for deuteranopia and protanopia but loses some depth under tritanopia.', affectedTypes:['tritanopia'], recommendation:'Consider adding a shape cue to reinforce recognition under tritanopia.' },
    monochrome: { score:85, status:'pass', headline:'Performs well in greyscale and monochrome reproduction.', detail:'The high contrast between the navy wordmark and white background ensures fax and thermal print legibility.', faxPerformance:'pass', regulatorySubmissionRisk:'low', recommendation:'No changes required for monochrome applications.' },
    contrast: { score:74, status:'warn', headline:'Strong on white but contrast drops significantly on dark backgrounds.', detail:'WCAG AA is met on white and light backgrounds, but no dark-background variant exists.', wcagLevel:'AA', darkBackgroundPerformance:'fail', recommendation:'Develop a white-reverse version for dark packaging and digital applications.' },
    sizeScaling: { score:70, status:'warn', headline:'Logo is clear at 64px and above but detail is lost at 32px and below.', detail:'Fine typography in the tagline becomes illegible below 32px wide.', pillBottle:'warn', packageInsert:'pass', digitalAd:'pass', minimumRecommendedSize:'20mm width minimum', recommendation:'Create a simplified mark for small-format applications below 20mm.' },
    balance: { score:80, status:'pass', headline:'Well-balanced composition with good visual weight distribution.', detail:'The horizontal layout distributes weight evenly with a slight left anchor from the symbol.', visualWeightDistribution:'centred', recommendation:'Maintain consistent clear space in all applications.' },
    brandPersonality: { score:75, status:'warn', headline:'Communicates clinical authority but lacks warmth for patient-facing materials.', detail:'The mark reads as established and trustworthy to HCPs but may feel cold to patients.', traits:['Clinical','Authoritative'], recommendation:'Consider softening the mark for DTC materials while retaining the HCP version.' },
    therapeuticAreaFit: { score:72, status:'warn', headline:'Blue palette aligns with immunology conventions but could be more distinctive.', detail:'The navy/blue palette is common in immunology and does not strongly differentiate from competitor brands.', inferredArea:'immunology', colorMoodAlignment:'neutral', recommendation:'Explore a secondary accent colour to differentiate within the category.' },
    containersProportions: { score:78, status:'warn', headline:'Horizontal format is versatile but awkward in square containers.', detail:'The 3:1 aspect ratio works well for banners and inserts but requires cropping in icon formats.', aspectRatioAssessment:'overly wide', containerEffect:'No visible enclosure or framing elements', recommendation:'Develop a stacked version for square and vertical format applications.' }
  }
};

function createDemoLogo() {
  const cv = document.createElement('canvas');
  cv.width = 600; cv.height = 200;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 200);
  // Symbol
  ctx.fillStyle = '#2563eb';
  ctx.beginPath(); ctx.arc(100, 100, 60, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(76, 88, 48, 24); ctx.fillRect(88, 76, 24, 48);
  // Brand name
  ctx.fillStyle = '#1a2e4a';
  ctx.font = 'bold 62px Georgia, serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('LUMIERA', 185, 82);
  // INN
  ctx.fillStyle = '#64748b';
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('adalimumab', 187, 138);
  return cv;
}

function loadDemo() {
  const cv = createDemoLogo();
  imageMimeType = 'image/png';
  const dataUrl = cv.toDataURL('image/png');
  imageBase64 = dataUrl.split(',')[1];
  logoImage = new Image();
  logoImage.src = dataUrl;
  brandNameInput.value = 'LUMIERA';
  innNameInput.value = 'adalimumab';
  logoPreview.src = dataUrl;
  uploadPlaceholder.style.display = 'none';
  previewArea.classList.add('visible');
  hideError();
  setStatus('');
  renderReport(DEMO_DATA);
}

// ── Visual simulations ─────────────────────────────────────────────────────
const MATRICES = {
  grayscale:    [0.299,0.587,0.114, 0.299,0.587,0.114, 0.299,0.587,0.114],
  protanopia:   [0.567,0.433,0,     0.558,0.442,0,     0,    0.242,0.758],
  deuteranopia: [0.625,0.375,0,     0.700,0.300,0,     0,    0.300,0.700],
  tritanopia:   [0.950,0.050,0,     0,    0.433,0.567,  0,    0.475,0.525],
};

function applyMatrix(d, m) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    d[i]   = Math.min(255, m[0]*r + m[1]*g + m[2]*b);
    d[i+1] = Math.min(255, m[3]*r + m[4]*g + m[5]*b);
    d[i+2] = Math.min(255, m[6]*r + m[7]*g + m[8]*b);
  }
}

const FILTERS = {
  grayscale:    d => applyMatrix(d, MATRICES.grayscale),
  protanopia:   d => applyMatrix(d, MATRICES.protanopia),
  deuteranopia: d => applyMatrix(d, MATRICES.deuteranopia),
  tritanopia:   d => applyMatrix(d, MATRICES.tritanopia),
  binarize: d => {
    applyMatrix(d, MATRICES.grayscale);
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] > 180 ? 255 : 0;
      d[i] = d[i+1] = d[i+2] = v;
    }
  },
  invert: d => {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255-d[i]; d[i+1] = 255-d[i+1]; d[i+2] = 255-d[i+2];
    }
  },
};

function makeSim(bgColor, filterKey) {
  if (!logoImage?.complete || !logoImage.naturalWidth) return '';
  const MAX = 150;
  const scale = MAX / Math.max(logoImage.naturalWidth, logoImage.naturalHeight);
  const w = Math.max(1, Math.round(logoImage.naturalWidth * scale));
  const h = Math.max(1, Math.round(logoImage.naturalHeight * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bgColor || '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(logoImage, 0, 0, w, h);
  if (filterKey && FILTERS[filterKey]) {
    const id = ctx.getImageData(0, 0, w, h);
    FILTERS[filterKey](id.data);
    ctx.putImageData(id, 0, 0);
  }
  return cv.toDataURL();
}

function simGrid(items) {
  if (!logoImage?.complete) return '';
  const cells = items.map(({ label, bg, filter }) => {
    const url = makeSim(bg || '#fff', filter || null);
    return url ? `<div class="sim-item"><img src="${url}" alt="${label}" class="sim-img"><div class="sim-label">${label}</div></div>` : '';
  }).join('');
  return cells ? `<div class="sim-grid">${cells}</div>` : '';
}

function sizeGrid() {
  if (!logoImage?.complete) return '';
  const sizes = [128, 64, 32, 16];
  const cells = sizes.map(size => {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    const r = Math.min(size / logoImage.naturalWidth, size / logoImage.naturalHeight);
    const dw = Math.round(logoImage.naturalWidth * r);
    const dh = Math.round(logoImage.naturalHeight * r);
    ctx.drawImage(logoImage, Math.round((size-dw)/2), Math.round((size-dh)/2), dw, dh);
    const display = Math.max(size, 64);
    return `<div class="sim-item"><img src="${cv.toDataURL()}" class="sim-img size-thumb" style="width:${display}px;height:${display}px"><div class="sim-label">${size}×${size}px</div></div>`;
  }).join('');
  return `<div class="sim-grid">${cells}</div>`;
}

// ── Analysis ───────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (runBtn.disabled) return;
  hideError();
  setLoading(true);
  setStatus('Analysing logo…');

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

    // Consume Anthropic SSE stream, accumulate text_delta events into full JSON
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }

    if (!fullText) throw new Error('No response received from AI');
    const jsonStr = fullText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    const analysis = JSON.parse(jsonStr);
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
      h += sizeGrid();
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
      h += simGrid([
        { label: 'Normal vision',  bg: '#fff', filter: null },
        { label: 'Deuteranopia',   bg: '#fff', filter: 'deuteranopia' },
        { label: 'Protanopia',     bg: '#fff', filter: 'protanopia' },
        { label: 'Tritanopia',     bg: '#fff', filter: 'tritanopia' },
        { label: 'Achromatopsia',  bg: '#fff', filter: 'grayscale' },
      ]);
      break;

    case 'monochrome':
      h += subGrid([
        test.faxPerformance          ? { label: 'Fax / thermal print',          value: cap(test.faxPerformance),          cls: test.faxPerformance } : null,
        test.regulatorySubmissionRisk? { label: 'Regulatory submission risk',    value: cap(test.regulatorySubmissionRisk),cls: test.regulatorySubmissionRisk } : null,
      ].filter(Boolean));
      h += simGrid([
        { label: 'Colour',    bg: '#fff', filter: null },
        { label: 'Greyscale', bg: '#fff', filter: 'grayscale' },
        { label: 'Positive',  bg: '#fff', filter: 'binarize' },
        { label: 'Negative',  bg: '#fff', filter: 'invert' },
      ]);
      break;

    case 'contrast':
      h += subGrid([
        test.wcagLevel               ? { label: 'WCAG level',       value: test.wcagLevel,                    cls: test.wcagLevel === 'below-AA' ? 'fail' : test.wcagLevel === 'AA' ? 'warn' : 'pass' } : null,
        test.darkBackgroundPerformance?{ label: 'Dark background',   value: cap(test.darkBackgroundPerformance),cls: test.darkBackgroundPerformance } : null,
      ].filter(Boolean));
      h += simGrid([
        { label: 'White',      bg: '#ffffff', filter: null },
        { label: 'Light grey', bg: '#cccccc', filter: null },
        { label: 'Dark grey',  bg: '#555555', filter: null },
        { label: 'Black',      bg: '#000000', filter: null },
      ]);
      break;

    case 'fdaGuidance':
      if (test.regulations?.length)
        h += `<div class="recs"><div class="recs-title">Regulations referenced</div><ul>${test.regulations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
      break;
  }

  if (test.recommendations?.length)
    h += `<div class="recs"><div class="recs-title">Recommendations</div><ul>${test.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  else if (test.recommendation)
    h += `<div class="recs"><div class="recs-title">Recommendation</div><p class="detail-text">${esc(test.recommendation)}</p></div>`;

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
