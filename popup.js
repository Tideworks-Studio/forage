// popup.js
// Supabase loaded via local supabase.min.js — window.supabase is available

const SUPABASE_URL = 'https://ltvkoanqbeiirvyicbjn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ywskaxwK_8IEzW4eUQKtUA_isbNrKUS';
// supabase client — initialized in init() after UMD bundle sets window.supabase
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return _supabase;
}

// ── State ───────────────────────────────────────────────────────
let imageUrl   = null;
let pageUrl    = null;
let isFav      = false;
let selectedTags = new Set();
let allTags    = []; // { tag, color } pairs

// ── Tag color palette (matches main app) ────────────────────────
const TAG_COLORS = [
  '#3e7cde','#41df75','#dfaa40','#db43b7',
  '#d97c40','#da4241','#5d43de','#a4dbaa',
  '#b987d2','#323232','#328055','#806832',
  '#803255','#946022','#bbbbbb'
];
const tagColorMap = {};
let colorIdx = 0;
function colorFor(tag) {
  if (!tagColorMap[tag]) {
    tagColorMap[tag] = TAG_COLORS[colorIdx % TAG_COLORS.length];
    colorIdx++;
  }
  return tagColorMap[tag];
}

// ── DOM refs ────────────────────────────────────────────────────
const step1      = document.getElementById('step1');
const step2      = document.getElementById('step2');
const previewImg = document.getElementById('previewImg');
const sourceDom  = document.getElementById('source-domain');
const notesField = document.getElementById('notesField');
const tagPillsEl = document.getElementById('tag-pills');
const saveBtn    = document.getElementById('saveBtn');
const cancelBtn  = document.getElementById('cancelBtn');
const favBtn     = document.getElementById('favBtn');
const toast      = document.getElementById('toast');

// ── Toast ───────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'error') {
  toast.className = '';
  toast.textContent = (type === 'error' ? '⚠ ' : '✓ ') + msg;
  toast.classList.add(type, 'show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Favorite toggle ─────────────────────────────────────────────
favBtn.addEventListener('click', () => {
  isFav = !isFav;
  favBtn.classList.toggle('active', isFav);
});

// ── Render tag pills ────────────────────────────────────────────
function renderTagPills() {
  tagPillsEl.innerHTML = '';

  allTags.forEach(({ tag, color }) => {
    const pill = document.createElement('div');
    pill.className = 'tag-pill' + (selectedTags.has(tag) ? ' selected' : '');
    pill.innerHTML = `<span class="dot" style="background:${color}"></span>${tag}`;
    pill.addEventListener('click', () => {
      selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag);
      pill.classList.toggle('selected');
    });
    tagPillsEl.appendChild(pill);
  });

  // New tag input
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'new-tag-input';
  input.placeholder = '+ new tag';
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const val = input.value.trim();
    if (!val) return;
    if (!allTags.find(t => t.tag === val)) {
      allTags.push({ tag: val, color: colorFor(val) });
    }
    selectedTags.add(val);
    input.value = '';
    renderTagPills();
    // re-focus new input after re-render
    const newInput = document.getElementById('new-tag-input');
    if (newInput) newInput.focus();
  });
  tagPillsEl.appendChild(input);
}

// ── Load existing tags from Supabase ────────────────────────────
async function loadTags() {
  try {
    const { data, error } = await getSupabase()
      .from('images')
      .select('tags');

    if (error) throw error;

    const tagSet = new Set();
    data.forEach(row => (row.tags || []).forEach(t => tagSet.add(t)));

    allTags = [...tagSet].map(tag => ({ tag, color: colorFor(tag) }));
    renderTagPills();
  } catch (err) {
    console.error('Failed to load tags', err);
    tagPillsEl.innerHTML = '<div class="tag-pills-loading">Could not load tags</div>';
    // Still render just the new-tag input
    renderTagPills();
  }
}

// ── Save to Supabase ────────────────────────────────────────────
async function saveImage() {
  const tags  = selectedTags.size > 0 ? [...selectedTags] : ['Unlabeled'];
  const notes = notesField.value.trim();

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    // Generate thumbnail from image URL via canvas
    let thumbnail = null;
    try {
      thumbnail = await makeThumbnail(imageUrl);
    } catch {
      // If cross-origin blocks canvas, fall back to storing URL only
      thumbnail = imageUrl;
    }

    const { error } = await getSupabase().from('images').insert([{
      url: imageUrl,
      thumbnail,
      source_url: pageUrl,
      tags,
      notes,
      favorited: isFav
    }]);

    if (error) throw error;

    showToast('Saved to Forage', 'success');
    // Clear pending state
    await chrome.storage.local.remove(['pendingImageUrl', 'pendingPageUrl']);
    setTimeout(() => window.close(), 1200);
  } catch (err) {
    console.error('Save error', err);
    showToast(err.message || 'Something went wrong', 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to Forage';
  }
}

// ── Thumbnail helper ────────────────────────────────────────────
function makeThumbnail(url, maxWidth = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/webp', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Init ────────────────────────────────────────────────────────
async function init() {
  // Read pending image/page URL set by background.js
  const stored = await chrome.storage.local.get(['pendingImageUrl', 'pendingPageUrl']);

  imageUrl = stored.pendingImageUrl || null;
  pageUrl  = stored.pendingPageUrl  || null;

  if (!imageUrl) {
    // No pending image — show idle state
    step1.style.display = 'flex';
    step2.classList.add('hidden');
    return;
  }

  // Show form
  step1.style.display = 'none';
  step2.classList.remove('hidden');

  // Preview image
  previewImg.style.opacity = '0';
  previewImg.src = imageUrl;
  previewImg.onload  = () => { previewImg.style.opacity = '1'; };
  previewImg.onerror = () => { previewImg.style.opacity = '0.3'; };

  // Source domain
  if (pageUrl) {
    try {
      sourceDom.textContent = 'via ' + new URL(pageUrl).hostname.replace('www.', '');
    } catch { sourceDom.textContent = ''; }
  }

  // Load tags
  await loadTags();
}

// ── Event listeners ─────────────────────────────────────────────
saveBtn.addEventListener('click', saveImage);
cancelBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['pendingImageUrl', 'pendingPageUrl']);
  window.close();
});

document.addEventListener('DOMContentLoaded', init);