const API = '/contacts';

let allContacts = [];
let activeId = null;
let pendingDelete = null;

const listEl = document.getElementById('contact-list');
const mainEl = document.getElementById('main-panel');
const searchInput = document.getElementById('search-input');
const btnNew = document.getElementById('btn-new');

const mergeOverlay = document.getElementById('merge-overlay');
const mergePrimaryName = document.getElementById('merge-primary-name');
const mergeSearchInput = document.getElementById('merge-search');
const mergeListEl = document.getElementById('merge-list');
const mergeCancelBtn = document.getElementById('merge-cancel');

const deleteOverlay = document.getElementById('delete-overlay');
const deleteMsg = document.getElementById('delete-msg');
const deleteCancelBtn = document.getElementById('delete-cancel');
const deleteConfirmBtn = document.getElementById('delete-confirm');

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Request failed');
  return data;
}

const get  = (p)    => request('GET',    p);
const post = (p, b) => request('POST',   p, b);
const put  = (p, b) => request('PUT',    p, b);
const del  = (p)    => request('DELETE', p);

let toastTimer;
function toast(msg, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

function initials(c) {
  return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase() || '?';
}

function renderList(contacts) {
  if (!contacts.length) {
    listEl.innerHTML = '<li class="empty-state">No contacts found</li>';
    return;
  }

  const groups = {};
  contacts.forEach(c => {
    const letter = (c.last_name?.[0] || c.first_name?.[0] || '#').toUpperCase();
    (groups[letter] ??= []).push(c);
  });

  const fragment = document.createDocumentFragment();
  Object.keys(groups).sort().forEach(letter => {
    const label = document.createElement('li');
    label.className = 'group-label';
    label.textContent = letter;
    fragment.appendChild(label);

    groups[letter].forEach(c => {
      const li = document.createElement('li');
      li.className = 'item' + (c.id === activeId ? ' active' : '');
      li.dataset.id = c.id;
      li.innerHTML = `
        <div class="avatar">${initials(c)}</div>
        <div class="item-info">
          <div class="item-name">${esc(c.first_name)} ${esc(c.last_name)}</div>
          <div class="item-sub">${esc(c.phones[0]?.number || c.email || '—')}</div>
        </div>`;
      li.addEventListener('click', () => selectContact(c.id));
      fragment.appendChild(li);
    });
  });

  listEl.innerHTML = '';
  listEl.appendChild(fragment);
}

function setActive(id) {
  activeId = id;
  listEl.querySelectorAll('.item').forEach(li => {
    li.classList.toggle('active', li.dataset.id === id);
  });
}

async function loadAll() {
  allContacts = await get(API);
  renderList(allContacts);
}

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const q = searchInput.value.trim();
    if (!q) { renderList(allContacts); return; }
    const results = await get(`${API}/search?q=${encodeURIComponent(q)}`);
    renderList(results);
  }, 250);
});

async function selectContact(id) {
  setActive(id);
  const c = await get(`${API}/${id}`);
  renderDetail(c);
}

function renderDetail(c) {
  mainEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-header">
      <div class="avatar-lg">${initials(c)}</div>
      <div>
        <div class="card-title">${esc(c.first_name)} ${esc(c.last_name)}</div>
        <div class="card-sub">${c.phones.length} phone${c.phones.length !== 1 ? 's' : ''}${c.email ? ' · ' + esc(c.email) : ''}</div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>First name</label>
        <input id="d-first" type="text" value="${esc(c.first_name)}" />
      </div>
      <div class="form-group">
        <label>Last name</label>
        <input id="d-last" type="text" value="${esc(c.last_name)}" />
      </div>
    </div>

    <div class="form-group" style="margin-bottom:16px">
      <label>Email</label>
      <input id="d-email" type="text" value="${esc(c.email || '')}" placeholder="email@example.com" />
    </div>

    <div class="section-label">Phone numbers</div>
    <ul class="phone-list" id="d-phones"></ul>
    <button class="btn-add-phone" id="d-add-phone">+ Add phone number</button>

    <div class="action-bar">
      <button class="btn btn-primary" id="d-save">Save</button>
      <button class="btn btn-merge" id="d-merge">Merge with…</button>
      <button class="btn btn-danger" id="d-delete">Delete</button>
    </div>`;

  mainEl.appendChild(card);

  const phoneList = card.querySelector('#d-phones');
  (c.phones.length ? c.phones : [{ number: '', label: 'mobile' }])
    .forEach(p => addPhoneRow(phoneList, p.number, p.label));

  card.querySelector('#d-add-phone').addEventListener('click', () =>
    addPhoneRow(phoneList, '', 'mobile'));

  card.querySelector('#d-save').addEventListener('click', async () => {
    const phones = collectPhones(phoneList);
    try {
      const updated = await put(`${API}/${c.id}`, {
        first_name: card.querySelector('#d-first').value.trim(),
        last_name: card.querySelector('#d-last').value.trim(),
        email: card.querySelector('#d-email').value.trim() || null,
        phones,
      });
      await loadAll();
      setActive(updated.id);
      renderDetail(updated);
      toast('Contact saved');
    } catch (e) { toast(e.message, true); }
  });

  card.querySelector('#d-delete').addEventListener('click', () => confirmDelete(c));
  card.querySelector('#d-merge').addEventListener('click', () => openMergePicker(c));
}

function renderNewForm() {
  setActive(null);
  mainEl.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-header">
      <div class="avatar-lg" style="background:#7a7f99">+</div>
      <div>
        <div class="card-title">New Contact</div>
        <div class="card-sub">Fill in the details below</div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label>First name *</label>
        <input id="n-first" type="text" placeholder="Alice" />
      </div>
      <div class="form-group">
        <label>Last name *</label>
        <input id="n-last" type="text" placeholder="Smith" />
      </div>
    </div>

    <div class="form-group" style="margin-bottom:16px">
      <label>Email</label>
      <input id="n-email" type="text" placeholder="alice@example.com" />
    </div>

    <div class="section-label">Phone numbers</div>
    <ul class="phone-list" id="n-phones"></ul>
    <button class="btn-add-phone" id="n-add-phone">+ Add phone number</button>

    <div class="action-bar">
      <button class="btn btn-primary" id="n-save">Create Contact</button>
      <button class="btn btn-ghost" id="n-cancel">Cancel</button>
    </div>`;

  mainEl.appendChild(card);

  const phoneList = card.querySelector('#n-phones');
  addPhoneRow(phoneList, '', 'mobile');

  card.querySelector('#n-add-phone').addEventListener('click', () =>
    addPhoneRow(phoneList, '', 'mobile'));

  card.querySelector('#n-cancel').addEventListener('click', () => {
    mainEl.innerHTML = '<div class="placeholder"><div class="placeholder-icon">&#128100;</div><p>Select a contact or create a new one</p></div>';
  });

  card.querySelector('#n-save').addEventListener('click', async () => {
    const first = card.querySelector('#n-first').value.trim();
    const last = card.querySelector('#n-last').value.trim();
    if (!first || !last) { toast('First and last name are required', true); return; }
    const phones = collectPhones(phoneList);
    try {
      const created = await post(API + '/', {
        first_name: first,
        last_name: last,
        email: card.querySelector('#n-email').value.trim() || null,
        phones,
      });
      await loadAll();
      setActive(created.id);
      renderDetail(created);
      toast('Contact created');
    } catch (e) { toast(e.message, true); }
  });
}

function addPhoneRow(listEl, number = '', label = 'mobile') {
  const li = document.createElement('li');
  li.className = 'phone-row';
  li.innerHTML = `
    <input type="text" value="${esc(number)}" placeholder="555-1234" />
    <select>
      ${['mobile', 'home', 'work', 'other'].map(l =>
        `<option value="${l}"${l === label ? ' selected' : ''}>${l}</option>`
      ).join('')}
    </select>
    <button class="btn-remove" title="Remove">&#10005;</button>`;
  li.querySelector('.btn-remove').addEventListener('click', () => {
    if (listEl.children.length > 1) li.remove();
  });
  listEl.appendChild(li);
}

function collectPhones(listEl) {
  return Array.from(listEl.querySelectorAll('.phone-row'))
    .map(row => ({
      number: row.querySelector('input').value.trim(),
      label: row.querySelector('select').value,
    }))
    .filter(p => p.number);
}

function confirmDelete(c) {
  pendingDelete = c;
  deleteMsg.textContent = `"${c.first_name} ${c.last_name}" will be permanently removed.`;
  deleteOverlay.classList.remove('hidden');
}

deleteCancelBtn.addEventListener('click', () => {
  deleteOverlay.classList.add('hidden');
  pendingDelete = null;
});

deleteConfirmBtn.addEventListener('click', async () => {
  if (!pendingDelete) return;
  try {
    await del(`${API}/${pendingDelete.id}`);
    deleteOverlay.classList.add('hidden');
    pendingDelete = null;
    activeId = null;
    mainEl.innerHTML = '<div class="placeholder"><div class="placeholder-icon">&#128100;</div><p>Select a contact or create a new one</p></div>';
    await loadAll();
    toast('Contact deleted');
  } catch (e) { toast(e.message, true); }
});

let mergeSourceId = null;

function openMergePicker(primary) {
  mergeSourceId = primary.id;
  mergePrimaryName.textContent = `${primary.first_name} ${primary.last_name}`;
  mergeSearchInput.value = '';
  renderMergeList('');
  mergeOverlay.classList.remove('hidden');
  mergeSearchInput.focus();
}

function renderMergeList(q) {
  const candidates = allContacts.filter(c => {
    if (c.id === mergeSourceId) return false;
    if (!q) return true;
    const hay = `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phones.map(p => p.number).join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  mergeListEl.innerHTML = '';
  if (!candidates.length) {
    mergeListEl.innerHTML = '<li class="empty">No other contacts found</li>';
    return;
  }
  candidates.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.first_name} ${c.last_name}${c.email ? ' — ' + c.email : ''}`;
    li.addEventListener('click', () => doMerge(c));
    mergeListEl.appendChild(li);
  });
}

mergeSearchInput.addEventListener('input', () =>
  renderMergeList(mergeSearchInput.value.trim()));

mergeCancelBtn.addEventListener('click', () => {
  mergeOverlay.classList.add('hidden');
  mergeSourceId = null;
});

async function doMerge(secondary) {
  try {
    const merged = await post(`${API}/merge`, {
      primary_id: mergeSourceId,
      secondary_id: secondary.id,
    });
    mergeOverlay.classList.add('hidden');
    await loadAll();
    setActive(merged.id);
    renderDetail(merged);
    toast(`Merged into ${merged.first_name} ${merged.last_name}`);
  } catch (e) { toast(e.message, true); }
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

btnNew.addEventListener('click', renderNewForm);

mergeOverlay.addEventListener('click', e => {
  if (e.target === mergeOverlay) { mergeOverlay.classList.add('hidden'); mergeSourceId = null; }
});

deleteOverlay.addEventListener('click', e => {
  if (e.target === deleteOverlay) { deleteOverlay.classList.add('hidden'); pendingDelete = null; }
});

loadAll();
