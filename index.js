import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── Auth Supabase ──────────────────────────────────────────
const AUTH_URL = 'https://ecbtdsnjauaztotitfqo.supabase.co';
const AUTH_KEY = 'sb_publishable_o6M4Yt9SunEuS2qw5rp3QQ_diM-vSev';
const authSupabase = createClient(AUTH_URL, AUTH_KEY);
let supabase = null;

// ── Auth state ─────────────────────────────────────────────
const authBackdrop = document.getElementById('auth-backdrop');
const authStep1    = document.getElementById('auth-step1');
const authStep2    = document.getElementById('auth-step2');
const authStep3    = document.getElementById('auth-step3');
const authEmail    = document.getElementById('auth-email');
const authSendBtn  = document.getElementById('auth-send-btn');
const authVerifyBtn= document.getElementById('auth-verify-btn');
const authSaveBtn  = document.getElementById('auth-save-btn');
const authBackBtn  = document.getElementById('auth-back-btn');
const authSbUrl    = document.getElementById('auth-sb-url');
const authSbKey    = document.getElementById('auth-sb-key');
const otpInputs    = [...document.querySelectorAll('.otp-digit')];

function showAuthError(step, msg) {
  const el = document.getElementById(`auth-error-${step}`);
  el.textContent = msg; el.classList.add('visible');
}
function clearAuthError(step) {
  const el = document.getElementById(`auth-error-${step}`);
  el.textContent = ''; el.classList.remove('visible');
}
function goToStep(n) {
  authStep1.style.display = n === 1 ? 'flex' : 'none';
  authStep2.style.display = n === 2 ? 'flex' : 'none';
  authStep3.style.display = n === 3 ? 'flex' : 'none';
  [1,2,3].forEach(i => { if (i !== n) clearAuthError(i); });
}

authSendBtn.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  if (!email) { showAuthError(1, 'Please enter your email.'); return; }
  clearAuthError(1);
  authSendBtn.disabled = true; authSendBtn.textContent = 'Sending…';
  const { error } = await authSupabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  authSendBtn.disabled = false; authSendBtn.textContent = 'Continue';
  if (error) { showAuthError(1, error.message); return; }
  authStep2.querySelector('strong').textContent = email;
  goToStep(2); otpInputs[0].focus();
});
authEmail.addEventListener('keydown', e => { if (e.key === 'Enter') authSendBtn.click(); });

otpInputs.forEach((input, i) => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
    if (input.value && i < otpInputs.length - 1) otpInputs[i + 1].focus();
    if (otpInputs.every(inp => inp.value)) authVerifyBtn.click();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !input.value && i > 0) otpInputs[i - 1].focus();
  });
  input.addEventListener('paste', e => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 8);
    pasted.split('').forEach((ch, idx) => { if (otpInputs[idx]) otpInputs[idx].value = ch; });
    const next = Math.min(pasted.length, 5);
    otpInputs[next].focus();
    if (pasted.length === 8) authVerifyBtn.click();
  });
});

authVerifyBtn.addEventListener('click', async () => {
  const code = otpInputs.map(i => i.value).join('');
  if (code.length < 6) { showAuthError(2, 'Please enter the full 6-digit code.'); return; }
  clearAuthError(2);
  authVerifyBtn.disabled = true; authVerifyBtn.textContent = 'Verifying…';
  const { error } = await authSupabase.auth.verifyOtp({
    email: authEmail.value.trim(), token: code, type: 'email'
  });
  authVerifyBtn.disabled = false; authVerifyBtn.textContent = 'Verify';
  if (error) { showAuthError(2, 'Invalid or expired code. Try again.'); return; }
  await loadUserCredentials();
});
authBackBtn.addEventListener('click', () => { otpInputs.forEach(i => i.value = ''); goToStep(1); });

async function loadUserCredentials() {
  const cachedUrl = localStorage.getItem('forage_sb_url');
  const cachedKey = localStorage.getItem('forage_sb_key');
  if (cachedUrl && cachedKey) { initUserSupabase(cachedUrl, cachedKey); return; }
  const { data, error } = await authSupabase.from('profiles').select('supabase_url, supabase_key').single();
  if (!error && data?.supabase_url && data?.supabase_key) {
    localStorage.setItem('forage_sb_url', data.supabase_url);
    localStorage.setItem('forage_sb_key', data.supabase_key);
    initUserSupabase(data.supabase_url, data.supabase_key); return;
  }
  goToStep(3);
}

authSaveBtn.addEventListener('click', async () => {
  const url = authSbUrl.value.trim();
  const key = authSbKey.value.trim();
  if (!url || !key) { showAuthError(3, 'Both fields are required.'); return; }
  clearAuthError(3);
  authSaveBtn.disabled = true; authSaveBtn.textContent = 'Saving…';
  try {
    const testClient = createClient(url, key);
    const { error } = await testClient.from('images').select('id').limit(1);
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
  } catch (err) {
    showAuthError(3, 'Couldn\'t connect — double-check your URL and key.');
    authSaveBtn.disabled = false; authSaveBtn.textContent = 'Open my library'; return;
  }
  await authSupabase.from('profiles').upsert({
    id: (await authSupabase.auth.getUser()).data.user.id,
    supabase_url: url, supabase_key: key
  });
  localStorage.setItem('forage_sb_url', url);
  localStorage.setItem('forage_sb_key', key);
  authSaveBtn.disabled = false; authSaveBtn.textContent = 'Open my library';
  initUserSupabase(url, key);
});

function initUserSupabase(url, key) {
  supabase = createClient(url, key);
  authBackdrop.style.display = 'none';
  loadImages();
}
async function checkSession() {
  const { data: { session } } = await authSupabase.auth.getSession();
  if (session) { await loadUserCredentials(); } else { goToStep(1); }
}
async function signOut() {
  await authSupabase.auth.signOut();
  localStorage.removeItem('forage_sb_url');
  localStorage.removeItem('forage_sb_key');
  supabase = null;
  authBackdrop.style.display = 'flex';
  goToStep(1);
}
document.getElementById('signOutBtn').addEventListener('click', signOut);

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'error') {
  const el = document.getElementById('toast');
  el.className = '';
  el.textContent = (type === 'error' ? '⚠ ' : '✓ ') + message;
  el.classList.add(type, 'show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

// ── DOM refs ───────────────────────────────────────────────
const uploadBtn       = document.getElementById('uploadBtn');
const uploadBackdrop  = document.getElementById('upload-backdrop');
const dropZone        = document.getElementById('dropZone');
const fileInput       = document.getElementById('fileInput');
const pasteLinkBtn    = document.getElementById('pasteLinkBtn');
const urlField        = document.getElementById('urlField');
const step1           = document.getElementById('step1');
const step2           = document.getElementById('step2');
const previewImg      = document.getElementById('previewImg');
const notesField      = document.getElementById('notesField');
const tagPillsEl      = document.getElementById('tag-pills');
const saveBtn         = document.getElementById('saveBtn');
const grid            = document.getElementById('grid');
const tagList         = document.getElementById('tagList');
const navDot          = document.getElementById('navDot');
const navTagName      = document.getElementById('navTagName');
const collTitle       = document.getElementById('collection-title');
const quickAll        = document.getElementById('quickAll');
const quickFav        = document.getElementById('quickFav');
const emptyState      = document.getElementById('empty-state');
const tagSettingsBtn  = document.getElementById('tagSettingsBtn');
const detailFavBtn    = document.getElementById('detail-fav-btn');
const detailFavLabel  = document.getElementById('detail-fav-label');
const tagMgmtBackdrop = document.getElementById('tag-mgmt-backdrop');
const tagMgmtTitle    = document.getElementById('tag-mgmt-title');
const tagRenameInput  = document.getElementById('tag-rename-input');
const tagColorPalette = document.getElementById('tag-color-palette');
const tagMergeSelect  = document.getElementById('tag-merge-select');
const tagSaveBtn      = document.getElementById('tag-save-btn');
const tagDeleteBtn    = document.getElementById('tag-delete-btn');
const tagMgmtClose    = document.getElementById('tag-mgmt-close');
const detailBackdrop  = document.getElementById('detail-backdrop');
const detailImg       = document.getElementById('detail-img');
const detailSource    = document.getElementById('detail-source');
const detailDate      = document.getElementById('detail-date');
const detailNotes     = document.getElementById('detail-notes');
const detailTags      = document.getElementById('detail-tags');
const detailDownload  = document.getElementById('detail-download');
const detailDelete    = document.getElementById('detail-delete');

let imagesData    = [];
let activeTag     = 'all';
let pendingFile   = null;
let pendingIsURL  = false;
let selectedTags  = new Set();
let activeImageId = null;
let selectMode    = false;
let selectedIds   = new Set();

// ── Tag metadata (Supabase-backed) ─────────────────────────
let tagsCache = []; // { id, name, color, parent, sort_order }

async function loadTags() {
  const { data, error } = await supabase.from('tags').select('*').order('sort_order');
  if (!error) tagsCache = data || [];
}

async function upsertTag(name, fields = {}) {
  const existing = tagsCache.find(t => normalizeTag(t.name) === normalizeTag(name));
  if (existing) {
    const { error } = await supabase.from('tags').update(fields).eq('id', existing.id);
    if (!error) Object.assign(existing, fields);
  } else {
    const maxOrder = tagsCache.reduce((m, t) => Math.max(m, t.sort_order || 0), 0);
    const row = { name, color: fields.color || null, parent: fields.parent || null, sort_order: fields.sort_order ?? maxOrder + 1, ...fields };
    const { data, error } = await supabase.from('tags').insert([row]).select().single();
    if (!error && data) tagsCache.push(data);
  }
}

async function deleteTagMeta(name) {
  const existing = tagsCache.find(t => t.name === name);
  if (!existing) return;
  await supabase.from('tags').delete().eq('id', existing.id);
  tagsCache = tagsCache.filter(t => t.name !== name);
}

async function renameTagMeta(oldName, newName) {
  const existing = tagsCache.find(t => t.name === oldName);
  if (!existing) return;
  await supabase.from('tags').update({ name: newName }).eq('id', existing.id);
  // Update any children that reference old name as parent
  const children = tagsCache.filter(t => t.parent === oldName);
  for (const child of children) {
    await supabase.from('tags').update({ parent: newName }).eq('id', child.id);
    child.parent = newName;
  }
  existing.name = newName;
}

// Local color map for fast rendering (populated from tagsCache)
const tagColorMap = {};
let colorIdx = 0;
function colorFor(tag) {
  const meta = tagsCache.find(t => t.name === tag);
  if (meta?.color) { tagColorMap[tag] = meta.color; return meta.color; }
  if (!tagColorMap[tag]) { tagColorMap[tag] = TAG_COLORS[colorIdx % TAG_COLORS.length]; colorIdx++; }
  return tagColorMap[tag];
}

const TAG_COLORS = [
  '#3e7cde','#41df75','#dfaa40','#db43b7',
  '#d97c40','#da4241','#5d43de','#a4dbaa',
  '#b987d2','#323232','#328055','#806832',
  '#803255','#946022','#bbbbbb'
];

// ── Image helpers ──────────────────────────────────────────
function imgToDataURL(img, maxWidth = 600) {
  const scale = Math.min(maxWidth / img.width, 1);
  const c = document.createElement('canvas');
  c.width = img.width * scale; c.height = img.height * scale;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', 0.85);
}
function loadImgFromFile(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => res(img); img.onerror = rej; img.src = e.target.result;
    };
    reader.onerror = rej; reader.readAsDataURL(file);
  });
}
function loadImgFromURL(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img); img.onerror = rej; img.src = url;
  });
}

// ── Upload modal ───────────────────────────────────────────
function openUpload() { uploadBackdrop.classList.add('open'); showStep1(); }
function closeUpload() { uploadBackdrop.classList.remove('open'); setTimeout(resetModal, 320); }
function resetModal() {
  showStep1(); selectedTags.clear(); notesField.value = '';
  urlField.value = ''; urlField.classList.remove('visible', 'error');
  pendingFile = null; pendingIsURL = false;
}
function showStep1() {
  step1.classList.remove('gone');
  step2.classList.remove('visible'); step2.style.display = 'none';
}
function showStep2(displaySrc) {
  previewImg.style.opacity = '0'; previewImg.src = displaySrc;
  previewImg.onload = () => { previewImg.style.opacity = '1'; };
  renderTagPills();
  step1.classList.add('gone'); step2.style.display = 'flex';
  requestAnimationFrame(() => step2.classList.add('visible'));
}

function renderTagPills() {
  tagPillsEl.innerHTML = '';
  const allTags = new Set();
  imagesData.forEach(img => img.tags.forEach(t => allTags.add(t)));
  allTags.forEach(tag => {
    const color = colorFor(tag);
    const pill = document.createElement('div');
    pill.className = 'tag-pill' + (selectedTags.has(tag) ? ' selected' : '');
    pill.innerHTML = `<span class="dot" style="background:${color}"></span>${tag}`;
    pill.addEventListener('click', () => {
      selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag);
      pill.classList.toggle('selected');
    });
    tagPillsEl.appendChild(pill);
  });
  const input = document.createElement('input');
  input.type = 'text'; input.id = 'new-tag-input'; input.placeholder = '+ new tag';
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const typed = input.value.trim();
      const resolved = resolveTagName(typed);
      const exists = [...selectedTags].some(s => normalizeTag(s) === normalizeTag(typed));
      if (exists) { input.value = ''; return; }
      selectedTags.add(resolved); colorFor(resolved); input.value = '';
      const color = colorFor(resolved);
      const pill = document.createElement('div');
      pill.className = 'tag-pill selected';
      pill.innerHTML = `<span class="dot" style="background:${color}"></span>${resolved}`;
      pill.addEventListener('click', () => { selectedTags.delete(resolved); pill.remove(); });
      tagPillsEl.insertBefore(pill, input);
    }
  });
  tagPillsEl.appendChild(input);
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', async e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) await handleFile(file);
});
fileInput.addEventListener('change', async () => { if (fileInput.files[0]) await handleFile(fileInput.files[0]); });
async function handleFile(file) {
  pendingFile = file; pendingIsURL = false;
  const img = await loadImgFromFile(file);
  showStep2(imgToDataURL(img));
}

pasteLinkBtn.addEventListener('click', () => { urlField.classList.add('visible'); urlField.focus(); });
urlField.addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  const url = urlField.value.trim(); if (!url) return;
  pendingFile = url; pendingIsURL = true;
  try { await loadImgFromURL(url); showStep2(url); }
  catch { urlField.classList.add('error'); setTimeout(() => urlField.classList.remove('error'), 900); }
});

saveBtn.addEventListener('click', async () => {
  if (!pendingFile) return;
  saveBtn.disabled = true; saveBtn.textContent = 'Uploading…';
  const tags = (() => {
    const liveInput = document.getElementById('new-tag-input');
    if (liveInput && liveInput.value.trim()) selectedTags.add(resolveTagName(liveInput.value.trim()));
    return selectedTags.size > 0 ? [...selectedTags].map(resolveTagName) : ['Unlabeled'];
  })();
  const notes = notesField.value.trim();
  try {
    let thumbnail, url, source_url = '';
    if (pendingIsURL) {
      url = pendingFile; source_url = pendingFile;
      const img = await loadImgFromURL(url);
      thumbnail = imgToDataURL(img);
      const { error } = await supabase.from('images').insert([{ url, thumbnail, source_url, tags, notes }]);
      if (error) throw new Error(`DB insert failed: ${error.message}`);
      for (const t of tags) await upsertTag(t, { color: null });
    } else {
      const file = pendingFile;
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(fileName, file);
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
      const { data: publicUrlData } = supabase.storage.from('images').getPublicUrl(fileName);
      url = publicUrlData.publicUrl;
      thumbnail = imgToDataURL(await loadImgFromFile(file));
      const { error: insertError } = await supabase.from('images').insert([{ url, thumbnail, source_url, tags, notes }]);
      if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);
      for (const t of tags) await upsertTag(t, { color: null });
    }
    showToast('Image uploaded', 'success');
    closeUpload(); loadImages();
  } catch (err) {
    console.error('Save error', err);
    showToast(err.message || 'Something went wrong', 'error');
  }
  saveBtn.disabled = false; saveBtn.textContent = 'Upload';
});

// ── Load / render ──────────────────────────────────────────
async function loadImages() {
  await loadTags();
  const { data, error } = await supabase.from('images').select('*').order('created_at', { ascending: false });
  if (error) return console.error(error);
  imagesData = data;
  // Ensure any tags on images that aren't in tagsCache yet get a row
  const allImageTags = new Set(imagesData.flatMap(img => img.tags));
  const cachedNames = new Set(tagsCache.map(t => t.name));
  for (const name of allImageTags) {
    if (!cachedNames.has(name)) await upsertTag(name, { color: null });
  }
  updateSidebar(); renderGrid();
}

// Collapsed state for parent tags
const collapsedParents = new Set();

function updateSidebar() {
  const sort = localStorage.getItem('forage_tag_sort') || 'alpha';
  let tags = [...tagsCache];

  if (sort === 'alpha') {
    tags.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'count') {
    tags.sort((a, b) => {
      const countB = imagesData.filter(img => img.tags.includes(b.name)).length;
      const countA = imagesData.filter(img => img.tags.includes(a.name)).length;
      return countB - countA;
    });
  } else if (sort === 'date') {
    tags.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sort === 'recent') {
    tags.sort((a, b) => {
      const aImg = imagesData.find(img => img.tags.includes(a.name));
      const bImg = imagesData.find(img => img.tags.includes(b.name));
      return new Date(bImg?.created_at || 0) - new Date(aImg?.created_at || 0);
    });
  } else if (sort === 'custom') {
    tags.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  // Separate parents and orphans
  const parents = tags.filter(t => !t.parent);
  const childrenOf = name => tags.filter(t => t.parent === name);

  tagList.innerHTML = '';

  parents.forEach(tag => {
    const children = childrenOf(tag.name);
    const isCollapsed = collapsedParents.has(tag.name);
    const color = colorFor(tag.name);
    const count = imagesData.filter(img => img.tags.includes(tag.name)).length;
    const childCount = children.reduce((n, c) => n + imagesData.filter(img => img.tags.includes(c.name)).length, 0);
    const totalCount = count + childCount;

    const item = document.createElement('div');
    item.className = 'sidebar-item' + (activeTag === tag.name ? ' active' : '');
    item.dataset.tag = tag.name;
    if (sort === 'custom') item.setAttribute('draggable', 'true');

    item.innerHTML = `
      <div class="sidebar-item-left">
        ${children.length > 0
          ? `<button class="sidebar-collapse-btn" title="${isCollapsed ? 'Expand' : 'Collapse'}">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${isCollapsed ? '<polyline points="9 18 15 12 9 6"/>' : '<polyline points="6 9 12 15 18 9"/>'}
              </svg>
             </button>`
          : ''}
        <span class="dot" style="background:${color}"></span>
        <span>${tag.name}</span>
      </div>
      <span class="sidebar-item-count">${totalCount}</span>`;

    item.querySelector('.sidebar-item-left span:last-child, .sidebar-item-left span.dot + span')?.addEventListener('click', () => setTag(tag.name, color));
    item.addEventListener('click', e => {
      if (e.target.closest('.sidebar-collapse-btn')) return;
      setTag(tag.name, color);
    });

    if (children.length > 0) {
      item.querySelector('.sidebar-collapse-btn').addEventListener('click', e => {
        e.stopPropagation();
        collapsedParents.has(tag.name) ? collapsedParents.delete(tag.name) : collapsedParents.add(tag.name);
        updateSidebar();
      });
    }

    if (sort === 'custom') attachDragHandlers(item);
    tagList.appendChild(item);

    // Render children
    if (!isCollapsed) {
      children.forEach(child => {
        const childColor = colorFor(child.name);
        const childCount = imagesData.filter(img => img.tags.includes(child.name)).length;
        const childItem = document.createElement('div');
        childItem.className = 'sidebar-item child' + (activeTag === child.name ? ' active' : '');
        childItem.dataset.tag = child.name;
        if (sort === 'custom') childItem.setAttribute('draggable', 'true');
        childItem.innerHTML = `
          <div class="sidebar-item-left">
            <span class="dot" style="background:${childColor}"></span>
            <span>${child.name}</span>
          </div>
          <span class="sidebar-item-count">${childCount}</span>`;
        childItem.addEventListener('click', () => setTag(child.name, childColor));
        if (sort === 'custom') attachDragHandlers(childItem);
        tagList.appendChild(childItem);
      });
    }
  });

  quickAll.classList.toggle('active', activeTag === 'all');
}

let dragSrcTag = null;

function attachDragHandlers(item) {
  item.addEventListener('dragstart', e => {
    dragSrcTag = item.dataset.tag;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    document.querySelectorAll('.sidebar-item.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
  item.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.sidebar-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    item.classList.add('drag-over');
  });
  item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
  item.addEventListener('drop', async e => {
    e.preventDefault();
    item.classList.remove('drag-over');
    const targetTag = item.dataset.tag;
    if (!dragSrcTag || dragSrcTag === targetTag) return;

    const srcMeta = tagsCache.find(t => t.name === dragSrcTag);
    const tgtMeta = tagsCache.find(t => t.name === targetTag);
    if (!srcMeta || !tgtMeta) return;

    const siblings = [...tagList.querySelectorAll('.sidebar-item')]
      .map(el => el.dataset.tag)
      .filter(name => {
        const meta = tagsCache.find(t => t.name === name);
        return meta?.parent === srcMeta.parent;
      });

    const srcIdx = siblings.indexOf(dragSrcTag);
    const tgtIdx = siblings.indexOf(targetTag);
    if (srcIdx === -1 || tgtIdx === -1) return;

    siblings.splice(srcIdx, 1);
    siblings.splice(tgtIdx, 0, dragSrcTag);

    // Optimistic: update tagsCache sort_order immediately and re-render
    const snapshot = tagsCache.map(t => ({ id: t.id, sort_order: t.sort_order }));
    siblings.forEach((name, i) => {
      const meta = tagsCache.find(t => t.name === name);
      if (meta) meta.sort_order = i;
    });
    updateSidebar();

    // Persist in background, roll back on failure
    try {
      await Promise.all(siblings.map((name, i) => {
        const meta = tagsCache.find(t => t.name === name);
        return meta ? supabase.from('tags').update({ sort_order: i }).eq('id', meta.id) : Promise.resolve();
      }));
    } catch {
      snapshot.forEach(({ id, sort_order }) => {
        const meta = tagsCache.find(t => t.id === id);
        if (meta) meta.sort_order = sort_order;
      });
      updateSidebar();
      showToast('Could not save tag order', 'error');
    }
  });
}


function setTag(tag, color) {
  activeTag = tag;
  navTagName.textContent = tag === 'all' || tag === 'favorites' ? (tag === 'favorites' ? 'Favorites' : 'All') : tag;
  navDot.style.display = (tag === 'all' || tag === 'favorites') ? 'none' : 'inline-block';
  if (tag !== 'all' && tag !== 'favorites') navDot.style.background = color;
  collTitle.textContent = tag === 'all' ? 'All' : tag === 'favorites' ? 'Favorites' : tag;
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.toggle('active', el.dataset.tag === tag));
  quickAll.classList.toggle('active', tag === 'all');
  quickFav.classList.toggle('active', tag === 'favorites');
  tagSettingsBtn.classList.toggle('visible', tag !== 'all' && tag !== 'favorites');
  renderGrid();
}

function renderGrid() {
  grid.innerHTML = '';
  const filtered = activeTag === 'all'
    ? imagesData
    : activeTag === 'favorites'
    ? imagesData.filter(img => img.favorited)
    : (() => {
        const childNames = tagsCache.filter(t => t.parent === activeTag).map(t => t.name);
        const allActive = [activeTag, ...childNames];
        return imagesData.filter(img => img.tags.some(t => allActive.includes(t)));
      })();
  emptyState.classList.toggle('visible', filtered.length === 0);
  filtered.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'image-card';
    div.style.animationDelay = `${Math.min(i * 25, 180)}ms`;
    div.innerHTML = `
      <img src="${img.thumbnail || img.url}" alt="" loading="lazy">
      <button class="fav-star ${img.favorited === true ? 'active' : ''}" data-id="${img.id}" title="${img.favorited ? 'Remove from favorites' : 'Add to favorites'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
      <div class="select-check"></div>`;
    div.querySelector('.fav-star').addEventListener('click', async e => {
      e.stopPropagation();
      const newFav = !img.favorited;
      const { error } = await supabase.from('images').update({ favorited: newFav }).eq('id', img.id);
      if (error) { showToast('Could not update favorite', 'error'); return; }
      img.favorited = newFav;
      const star = div.querySelector('.fav-star');
      star.classList.toggle('active', newFav);
      star.title = newFav ? 'Remove from favorites' : 'Add to favorites';
      if (activeTag === 'favorites') renderGrid();
    });
    div.addEventListener('click', () => {
      if (selectMode) { toggleCardSelected(div, img.id); return; }
      openDetail(img);
    });
    grid.appendChild(div);
  });
}

/* Select */
function enterSelectMode() {
  selectMode = true;
  selectedIds.clear();
  document.getElementById('selectBtn').classList.add('active');
  document.querySelectorAll('.image-card').forEach(card => card.classList.add('selectable'));
  updateBulkBar();
}

function exitSelectMode() {
  selectMode = false;
  selectedIds.clear();
  document.getElementById('selectBtn').classList.remove('active');
  document.querySelectorAll('.image-card').forEach(card => {
    card.classList.remove('selectable', 'selected');
  });
  document.getElementById('bulk-bar').classList.remove('visible');
}

function toggleCardSelected(card, id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    card.classList.remove('selected');
  } else {
    selectedIds.add(id);
    card.classList.add('selected');
  }
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = selectedIds.size;
  document.getElementById('bulk-count').textContent =
    count === 0 ? 'No images selected' : `${count} selected`;
  bar.classList.toggle('visible', true);
}

// ── Detail modal ───────────────────────────────────────────
function openDetail(img) {
  activeImageId = img.id;
  detailImg.style.opacity = '0';
  detailImg.src = img.url || img.thumbnail;
  detailImg.onload = () => { detailImg.style.opacity = '1'; };

  detailSource.innerHTML = '';
  if (img.source_url) {
    let domain = '';
    try { domain = new URL(img.source_url).hostname.replace('www.', ''); } catch {}
    detailSource.innerHTML = `via <a href="${img.source_url}" target="_blank" rel="noopener">${domain}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg></a>`;
  }

  if (img.created_at) {
    const d = new Date(img.created_at);
    detailDate.textContent = `Added ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  } else { detailDate.textContent = ''; }

  const liveNotes = document.getElementById('detail-notes');
  if (img.notes && img.notes.trim()) {
    liveNotes.textContent = img.notes;
    liveNotes.classList.remove('empty');
  } else {
    liveNotes.textContent = '';
    liveNotes.classList.add('empty');
  }
  const newNotes = liveNotes.cloneNode(true);
  liveNotes.parentNode.replaceChild(newNotes, liveNotes);
  const notesSaveBtnFresh = document.getElementById('detail-notes-save');
  newNotes.addEventListener('focus', () => {
    if (newNotes.classList.contains('empty')) { newNotes.textContent = ''; newNotes.classList.remove('empty'); }
  });
  newNotes.addEventListener('input', () => { notesSaveBtnFresh.classList.add('visible'); });
  newNotes.addEventListener('blur', () => {
    if (!newNotes.textContent.trim()) { newNotes.textContent = ''; newNotes.classList.add('empty'); }
  });
  notesSaveBtnFresh.addEventListener('click', async () => {
    const newNote = newNotes.textContent.trim();
    const { error } = await supabase.from('images').update({ notes: newNote }).eq('id', activeImageId);
    if (error) { showToast('Could not save note', 'error'); return; }
    const img = imagesData.find(i => i.id === activeImageId);
    if (img) img.notes = newNote;
    notesSaveBtnFresh.classList.remove('visible');
    showToast('Note saved', 'success');
  });

  const isFav = img.favorited === true;
  detailFavBtn.classList.toggle('active', isFav);
  detailFavLabel.textContent = isFav ? 'Remove from favorites' : 'Add to favorites';
  renderDetailTags(img.tags || []);
  detailDownload.dataset.src = img.url || img.thumbnail;
  detailDownload.dataset.filename = `forage-${img.id || Date.now()}.jpg`;
  detailBackdrop.classList.add('open');
}

function renderDetailTags(tags) {
  detailTags.innerHTML = '';
  tags.forEach(tag => {
    const color = colorFor(tag);
    const el = document.createElement('span');
    el.className = 'detail-tag';
    el.innerHTML = `<span class="dot" style="background:${color}"></span>${tag}<span class="remove-tag" title="Remove tag">✕</span>`;
    el.querySelector('.remove-tag').addEventListener('click', async () => {
      const newTags = tags.filter(t => t !== tag);
      const { error } = await supabase.from('images').update({ tags: newTags }).eq('id', activeImageId);
      if (error) { showToast('Could not remove tag', 'error'); return; }
      const img = imagesData.find(i => i.id === activeImageId);
      if (img) img.tags = newTags;
      renderDetailTags(newTags); updateSidebar();
    });
    detailTags.appendChild(el);
  });
  const input = document.createElement('input');
  input.type = 'text'; input.id = 'detail-tag-input'; input.placeholder = '+ add tag';
  input.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    const val = resolveTagName(input.value.trim());
    if (!val || tags.some(t => normalizeTag(t) === normalizeTag(val))) { input.value = ''; return; }
    const newTags = [...tags, val];
    const { error } = await supabase.from('images').update({ tags: newTags }).eq('id', activeImageId);
    if (error) { showToast('Could not add tag', 'error'); return; }
    colorFor(val);
    const img = imagesData.find(i => i.id === activeImageId);
    if (img) img.tags = newTags;
    renderDetailTags(newTags); updateSidebar();
  });
  detailTags.appendChild(input);
  input.focus();
}

function closeDetail() {
  detailBackdrop.classList.remove('open');
  detailDelete.disabled = false; detailDelete.textContent = '✕ Delete image';
  setTimeout(() => { detailImg.src = ''; activeImageId = null; }, 380);
}
detailBackdrop.addEventListener('click', e => { if (e.target === detailBackdrop) closeDetail(); });

detailDownload.addEventListener('click', async e => {
  e.preventDefault();
  const src = detailDownload.dataset.src;
  const filename = detailDownload.dataset.filename || 'forage-image.jpg';
  if (!src) return;
  if (src.startsWith('data:')) {
    const a = document.createElement('a'); a.href = src; a.download = filename; a.click(); return;
  }
  try {
    detailDownload.textContent = '↓ Downloading…';
    const res = await fetch(src);
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download error', err);
    showToast('Download failed — try right-clicking the image instead', 'error');
  } finally { detailDownload.textContent = '↓ Download image'; }
});

detailDelete.addEventListener('click', async () => {
  if (!activeImageId) return;
  detailDelete.disabled = true; detailDelete.textContent = 'Deleting…';
  const img = imagesData.find(i => i.id === activeImageId);
  if (img && img.url) {
    try {
      const storageMarker = '/storage/v1/object/public/images/';
      const idx = img.url.indexOf(storageMarker);
      if (idx !== -1) {
        const filePath = img.url.slice(idx + storageMarker.length);
        const { error: storageError } = await supabase.storage.from('images').remove([filePath]);
        if (storageError) console.warn('Storage delete failed:', storageError.message);
      }
    } catch (e) { console.warn('Storage delete error:', e); }
  }
  const { error } = await supabase.from('images').delete().eq('id', activeImageId);
  if (error) {
    showToast('Delete failed: ' + error.message, 'error');
    detailDelete.disabled = false; detailDelete.textContent = '✕ Delete image';
  } else {
    showToast('Image deleted', 'success'); closeDetail(); loadImages();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDetail(); closeUpload(); closeTagMgmt(); closeSettings(); exitSelectMode(); }
});

detailFavBtn.addEventListener('click', async () => {
  if (!activeImageId) return;
  const img = imagesData.find(i => i.id === activeImageId);
  if (!img) return;
  const newFav = !img.favorited;
  const { error } = await supabase.from('images').update({ favorited: newFav }).eq('id', activeImageId);
  if (error) { showToast('Could not update favorite', 'error'); return; }
  img.favorited = newFav;
  detailFavBtn.classList.toggle('active', newFav);
  detailFavLabel.textContent = newFav ? 'Remove from favorites' : 'Add to favorites';
  renderGrid();
});

// ── Tag management modal ───────────────────────────────────
let mgmtTag = null;
let mgmtSelectedColor = null;

function openTagMgmt(tag) {
  mgmtTag = tag; mgmtSelectedColor = colorFor(tag);
  tagMgmtTitle.textContent = `"${tag}"`;
  tagRenameInput.value = tag;

  tagColorPalette.innerHTML = '';
  TAG_COLORS.forEach(hex => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (hex === mgmtSelectedColor ? ' selected' : '');
    sw.style.background = hex;
    sw.addEventListener('click', () => {
      mgmtSelectedColor = hex;
      tagColorPalette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
    });
    tagColorPalette.appendChild(sw);
  });

  // Parent picker — exclude self and own children to prevent cycles
  const parentSelect = document.getElementById('tag-parent-select');
  const currentMeta = tagsCache.find(t => t.name === tag);
  const childNames = tagsCache.filter(t => t.parent === tag).map(t => t.name);
  parentSelect.innerHTML = '<option value="">— no parent —</option>';
  tagsCache
    .filter(t => t.name !== tag && !childNames.includes(t.name))
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name; opt.textContent = t.name;
      if (currentMeta?.parent === t.name) opt.selected = true;
      parentSelect.appendChild(opt);
    });

  // Merge select
  tagMergeSelect.innerHTML = '<option value="">— keep as separate tag —</option>';
  tagsCache
    .filter(t => t.name !== tag)
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name; opt.textContent = t.name;
      tagMergeSelect.appendChild(opt);
    });

  tagMgmtBackdrop.classList.add('open');
}
function closeTagMgmt() { tagMgmtBackdrop.classList.remove('open'); }

tagMgmtClose.addEventListener('click', closeTagMgmt);
tagMgmtBackdrop.addEventListener('click', e => { if (e.target === tagMgmtBackdrop) closeTagMgmt(); });
tagSettingsBtn.addEventListener('click', () => {
  if (activeTag && activeTag !== 'all' && activeTag !== 'favorites') openTagMgmt(activeTag);
});

tagSaveBtn.addEventListener('click', async () => {
  const newName = tagRenameInput.value.trim();
  const mergeTarget = tagMergeSelect.value;
  const newParent = document.getElementById('tag-parent-select').value || null;
  if (!newName) return;
  tagSaveBtn.disabled = true; tagSaveBtn.textContent = 'Saving…';

  if (mergeTarget) {
    const affected = imagesData.filter(img => img.tags.includes(mgmtTag));
    for (const img of affected) {
      const newTags = [...new Set(img.tags.map(t => t === mgmtTag ? mergeTarget : t))];
      await supabase.from('images').update({ tags: newTags }).eq('id', img.id);
      img.tags = newTags;
    }
    await deleteTagMeta(mgmtTag);
    if (activeTag === mgmtTag) setTag('all', '');
    showToast(`Merged into "${mergeTarget}"`, 'success');
  } else {
    if (newName !== mgmtTag) {
      const affected = imagesData.filter(img => img.tags.includes(mgmtTag));
      for (const img of affected) {
        const newTags = img.tags.map(t => t === mgmtTag ? newName : t);
        await supabase.from('images').update({ tags: newTags }).eq('id', img.id);
        img.tags = newTags;
      }
      await renameTagMeta(mgmtTag, newName);
      const wasActive = activeTag === mgmtTag;
      mgmtTag = newName;
      if (wasActive) setTag(newName, mgmtSelectedColor);
    }
    await upsertTag(mgmtTag, { color: mgmtSelectedColor, parent: newParent });
    tagColorMap[mgmtTag] = mgmtSelectedColor;
    if (activeTag === mgmtTag) navDot.style.background = mgmtSelectedColor;
    showToast('Tag updated', 'success');
  }

  tagSaveBtn.disabled = false; tagSaveBtn.textContent = 'Save changes';
  closeTagMgmt(); await loadTags(); updateSidebar(); renderGrid();
});

tagDeleteBtn.addEventListener('click', async () => {
  if (!confirm(`Remove the tag "${mgmtTag}" from all images? Images won't be deleted.`)) return;
  tagDeleteBtn.disabled = true; tagDeleteBtn.textContent = 'Deleting…';
  const affected = imagesData.filter(img => img.tags.includes(mgmtTag));
  for (const img of affected) {
    const newTags = img.tags.filter(t => t !== mgmtTag);
    await supabase.from('images').update({ tags: newTags }).eq('id', img.id);
    img.tags = newTags;
  }
  await deleteTagMeta(mgmtTag);
  if (activeTag === mgmtTag) setTag('all', '');
  tagDeleteBtn.disabled = false; tagDeleteBtn.textContent = 'Delete tag';
  closeTagMgmt(); updateSidebar(); renderGrid();
  showToast(`Tag "${mgmtTag}" deleted`, 'success');
});

// ── Selection ──────────────────────────────────────────────
document.getElementById('selectBtn').addEventListener('click', () => {
  selectMode ? exitSelectMode() : enterSelectMode();
});

document.getElementById('bulk-cancel-btn').addEventListener('click', exitSelectMode);

document.getElementById('bulk-delete-btn').addEventListener('click', async () => {
  if (selectedIds.size === 0) return;
  if (!confirm(`Delete ${selectedIds.size} image${selectedIds.size > 1 ? 's' : ''}? This can't be undone.`)) return;

  const ids = [...selectedIds];
  document.getElementById('bulk-delete-btn').textContent = 'Deleting…';

  for (const id of ids) {
    const img = imagesData.find(i => i.id === id);
    if (img?.url) {
      try {
        const storageMarker = '/storage/v1/object/public/images/';
        const idx = img.url.indexOf(storageMarker);
        if (idx !== -1) {
          const filePath = img.url.slice(idx + storageMarker.length);
          await supabase.storage.from('images').remove([filePath]);
        }
      } catch {}
    }
    await supabase.from('images').delete().eq('id', id);
  }

  showToast(`Deleted ${ids.length} image${ids.length > 1 ? 's' : ''}`, 'success');
  exitSelectMode();
  loadImages();
});

document.getElementById('bulk-tag-btn').addEventListener('click', () => {
  if (selectedIds.size === 0) return;
  openBulkTagModal();
});

document.getElementById('bulk-tag-close').addEventListener('click', closeBulkTagModal);
document.getElementById('bulk-tag-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('bulk-tag-backdrop')) closeBulkTagModal();
});

function openBulkTagModal() {
  const count = selectedIds.size;
document.getElementById('bulk-tag-count').textContent = count;
document.getElementById('bulk-tag-plural').textContent = count === 1 ? '' : 's';

  // Build tag lists from tagsCache
  const addPills  = document.getElementById('bulk-add-pills');
  const remPills  = document.getElementById('bulk-remove-pills');
  addPills.innerHTML = '';
  remPills.innerHTML = '';

  const tagsToAdd    = new Set();
  const tagsToRemove = new Set();

  // Add pills — all known tags
  tagsCache.forEach(t => {
    const color = colorFor(t.name);
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.innerHTML = `<span class="dot" style="background:${color}"></span>${t.name}`;
    pill.addEventListener('click', () => {
      if (tagsToAdd.has(t.name)) { tagsToAdd.delete(t.name); pill.classList.remove('selected'); }
      else { tagsToAdd.add(t.name); pill.classList.add('selected'); }
    });
    addPills.appendChild(pill);
  });

  // New tag input for add
  const newInput = document.createElement('input');
  newInput.type = 'text'; newInput.placeholder = '+ new tag';
  newInput.className = 'tag-pill';
  newInput.style.cssText = 'background:var(--surface);border:1px dashed var(--border);outline:none;width:90px;cursor:text;';
  newInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !newInput.value.trim()) return;
    e.preventDefault();
    const val = resolveTagName(newInput.value.trim());
    if (!tagsToAdd.has(val)) {
      tagsToAdd.add(val);
      const color = colorFor(val);
      const p = document.createElement('div');
      p.className = 'tag-pill selected';
      p.innerHTML = `<span class="dot" style="background:${color}"></span>${val}`;
      p.addEventListener('click', () => { tagsToAdd.delete(val); p.remove(); });
      addPills.insertBefore(p, newInput);
    }
    newInput.value = '';
  });
  addPills.appendChild(newInput);

  // Remove pills — only tags that appear on at least one selected image
  const selectedImages = imagesData.filter(img => selectedIds.has(img.id));
  const presentTags = new Set(selectedImages.flatMap(img => img.tags));
  presentTags.forEach(name => {
    const color = colorFor(name);
    const pill = document.createElement('div');
    pill.className = 'tag-pill';
    pill.innerHTML = `<span class="dot" style="background:${color}"></span>${name}`;
    pill.addEventListener('click', () => {
      if (tagsToRemove.has(name)) { tagsToRemove.delete(name); pill.classList.remove('selected'); }
      else { tagsToRemove.add(name); pill.classList.add('selected'); }
    });
    remPills.appendChild(pill);
  });

  document.getElementById('bulk-tag-backdrop').classList.add('open');

  document.getElementById('bulk-tag-save-btn').onclick = async () => {
    if (tagsToAdd.size === 0 && tagsToRemove.size === 0) { closeBulkTagModal(); return; }
    document.getElementById('bulk-tag-save-btn').textContent = 'Applying…';

    const selectedImages = imagesData.filter(img => selectedIds.has(img.id));
    for (const img of selectedImages) {
      const newTags = [...new Set([
        ...img.tags.filter(t => !tagsToRemove.has(t)),
        ...tagsToAdd
      ])];
      await supabase.from('images').update({ tags: newTags }).eq('id', img.id);
      img.tags = newTags;
    }

    // Ensure new tags exist in tagsCache
    for (const name of tagsToAdd) await upsertTag(name, { color: null });

    showToast('Tags updated', 'success');
    closeBulkTagModal();
    exitSelectMode();
    await loadTags();
    updateSidebar();
    renderGrid();
  };
}

function closeBulkTagModal() {
  document.getElementById('bulk-tag-backdrop').classList.remove('open');
}

// ── Init ───────────────────────────────────────────────────
uploadBtn.addEventListener('click', openUpload);
uploadBackdrop.addEventListener('click', e => { if (e.target === uploadBackdrop) closeUpload(); });
quickAll.addEventListener('click', () => setTag('all', ''));
quickFav.addEventListener('click', () => setTag('favorites', ''));
window.addEventListener('DOMContentLoaded', checkSession);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ── Settings ───────────────────────────────────────────────
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsClose    = document.getElementById('settings-close');
const colSlider        = document.getElementById('col-slider');
const colValue         = document.getElementById('col-value');
const scaleSlider      = document.getElementById('scale-slider');
const scaleValue       = document.getElementById('scale-value');
const modeBtns         = document.querySelectorAll('.mode-btn');

function openSettings() { settingsBackdrop.classList.add('open'); }
function closeSettings() { settingsBackdrop.classList.remove('open'); }
document.getElementById('settingsBtn').addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', e => { if (e.target === settingsBackdrop) closeSettings(); });

const savedCols  = localStorage.getItem('forage_columns') || '4';
const savedScale = localStorage.getItem('forage_scale')   || '100';
const savedMode  = localStorage.getItem('forage_mode')    || 'system';

function applyColumns(n) {
  document.getElementById('grid').style.columns = n;
  colSlider.value = n; colValue.textContent = n;
}

function applyScale(n) {
  const wrapper = document.getElementById('body');
  const nav = document.getElementById('nav');
  const scale = n / 100;
  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = 'top left';
  wrapper.style.width = `${100 / scale}%`;
  wrapper.style.height = `${100 / scale}%`;
  nav.style.transform = `scale(${scale})`;
  nav.style.transformOrigin = 'top left';
  nav.style.width = `${100 / scale}%`;
  scaleSlider.value = n; scaleValue.textContent = n + '%';
}

function applyMode(mode) {
  modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  let isDark;
  if (mode === 'dark') { document.body.classList.add('dark'); isDark = true; }
  else if (mode === 'light') { document.body.classList.remove('dark'); isDark = false; }
  else { isDark = window.matchMedia('(prefers-color-scheme: dark)').matches; document.body.classList.toggle('dark', isDark); }
  const logo = document.getElementById('logo');
  logo.src = isDark
    ? 'https://github.com/Tideworks-Studio/forage/blob/main/assets/wreath_dark.png?raw=true'
    : 'https://github.com/Tideworks-Studio/forage/blob/main/assets/wreath-logo.png?raw=true';
}

applyColumns(savedCols); applyScale(savedScale); applyMode(savedMode);

colSlider.addEventListener('input', () => { applyColumns(colSlider.value); localStorage.setItem('forage_columns', colSlider.value); });
scaleSlider.addEventListener('input', () => { applyScale(scaleSlider.value); localStorage.setItem('forage_scale', scaleSlider.value); });
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => { applyMode(btn.dataset.mode); localStorage.setItem('forage_mode', btn.dataset.mode); });
});

const tagSortSelect = document.getElementById('tag-sort-select');
const savedSort = localStorage.getItem('forage_tag_sort') || 'alpha';
tagSortSelect.value = savedSort;
tagSortSelect.addEventListener('change', () => {
  localStorage.setItem('forage_tag_sort', tagSortSelect.value);
  updateSidebar();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (localStorage.getItem('forage_mode') === 'system') applyMode('system');
});

// Tag Normalization //
function normalizeTag(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function resolveTagName(input) {
  const normalizedInput = normalizeTag(input);
  const existing = tagsCache.find(t => normalizeTag(t.name) === normalizedInput);
  return existing ? existing.name : input;
}
