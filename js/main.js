let photos = [];
let currentIdx = null;

/* ── Like helpers (localStorage) ── */
function likeKey(id) { return 'pb_like_' + id; }

function getLike(id) {
  return JSON.parse(localStorage.getItem(likeKey(id)) || '{"c":0,"on":false}');
}

function toggleLike(id) {
  const d = getLike(id);
  d.on = !d.on;
  d.c = d.on ? d.c + 1 : Math.max(0, d.c - 1);
  localStorage.setItem(likeKey(id), JSON.stringify(d));
  return d;
}

/* ── Photo ID from content ── */
function photoId(photo, idx) {
  return photo.image
    ? photo.image.split('/').pop().replace(/\.[^.]+$/, '')
    : (photo.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'p' + idx;
}

/* ── Gallery render ── */
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!photos.length) {
    grid.innerHTML = '<div class="loading">No photos yet.</div>';
    return;
  }
  grid.innerHTML = photos.map((p, i) => {
    const id = photoId(p, i);
    const like = getLike(id);
    return `
      <div class="photo-card" data-idx="${i}" onclick="openModal(${i})">
        <img class="photo-card-image" src="${p.image}" alt="${esc(p.title)}" loading="lazy">
        <div class="photo-card-overlay">
          <h3 class="photo-card-title">${esc(p.title)}</h3>
          <p class="photo-card-desc">${esc(p.description || '')}</p>
        </div>
        <button class="card-like-btn${like.on ? ' liked' : ''}"
                onclick="handleCardLike(event,${i})" aria-label="Like">
          &#9829; <span class="like-num">${like.c}</span>
        </button>
      </div>`;
  }).join('');
}

function handleCardLike(e, idx) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const id = photoId(photos[idx], idx);
  const d = toggleLike(id);
  btn.classList.toggle('liked', d.on);
  btn.querySelector('.like-num').textContent = d.c;
  if (currentIdx === idx) syncModalLike(idx);
}

/* ── Modal ── */
function openModal(idx) {
  const p = photos[idx];
  currentIdx = idx;

  document.getElementById('modalImage').src = p.image;
  document.getElementById('modalImage').alt = p.title || '';
  document.getElementById('modalTitle').textContent = p.title || '';
  document.getElementById('modalDescription').textContent = p.description || '';
  document.getElementById('modalDate').textContent = p.date
    ? new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  document.getElementById('modalTags').innerHTML = (p.tags || [])
    .map(t => `<span class="tag">${esc(t)}</span>`).join('');

  syncModalLike(idx);
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function syncModalLike(idx) {
  const id = photoId(photos[idx], idx);
  const d = getLike(id);
  const btn = document.getElementById('modalLike');
  btn.classList.toggle('liked', d.on);
  document.getElementById('modalLikeCount').textContent = d.c;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  currentIdx = null;
}

/* ── Share ── */
async function handleShare() {
  if (currentIdx === null) return;
  const p = photos[currentIdx];
  const data = { title: p.title || 'Photo', text: p.description || '', url: location.href };
  if (navigator.share) {
    try { await navigator.share(data); } catch (e) { if (e.name !== 'AbortError') copyLink(); }
  } else { copyLink(); }
}

function copyLink() {
  navigator.clipboard.writeText(location.href).then(() => {
    const btn = document.getElementById('modalShare');
    const orig = btn.innerHTML;
    btn.textContent = 'Link copied!';
    setTimeout(() => btn.innerHTML = orig, 2200);
  });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Init ── */
async function init() {
  try {
    const siteRes = await fetch('/site.json');
    if (siteRes.ok) {
      const s = await siteRes.json();
      if (s.siteName) {
        document.title = s.siteName;
        document.getElementById('siteTitle').textContent = s.siteName;
        document.getElementById('heroTitle').textContent = s.siteName;
        document.getElementById('footerText').textContent =
          `\u00A9 ${new Date().getFullYear()} ${s.siteName}`;
      }
      if (s.tagline) document.getElementById('heroTagline').textContent = s.tagline;
      if (s.aboutTitle) document.getElementById('aboutTitle').textContent = s.aboutTitle;
      if (s.aboutBio) document.getElementById('aboutBio').textContent = s.aboutBio;
      if (s.aboutPhoto) {
        document.getElementById('aboutImageWrap').innerHTML =
          `<img src="${s.aboutPhoto}" alt="${esc(s.aboutTitle || 'About')}">`;
      }
      const links = [];
      if (s.instagram) links.push(`<a href="${s.instagram}" target="_blank" rel="noopener">Instagram</a>`);
      if (s.twitter) links.push(`<a href="${s.twitter}" target="_blank" rel="noopener">Twitter</a>`);
      if (s.website) links.push(`<a href="${s.website}" target="_blank" rel="noopener">Website</a>`);
      document.getElementById('socialLinks').innerHTML = links.join('');
    }
  } catch (_) {}

  try {
    const pRes = await fetch('/photos.json');
    if (pRes.ok) {
      const data = await pRes.json();
      photos = data.photos || [];
    }
  } catch (_) {}
  renderGallery();
}

/* ── Events ── */
document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('modalLike').addEventListener('click', () => {
    if (currentIdx === null) return;
    const id = photoId(photos[currentIdx], currentIdx);
    toggleLike(id);
    syncModalLike(currentIdx);
    // sync card
    const card = document.querySelector(`.photo-card[data-idx="${currentIdx}"] .card-like-btn`);
    if (card) {
      const d = getLike(id);
      card.classList.toggle('liked', d.on);
      card.querySelector('.like-num').textContent = d.c;
    }
  });

  document.getElementById('modalShare').addEventListener('click', handleShare);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Mobile nav
  const toggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  toggle?.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

  // Contact form AJAX
  const form = document.getElementById('contactForm');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    btn.textContent = 'Sending...';
    btn.disabled = true;
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString()
      });
      form.style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';
    } catch (_) {
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    }
  });
});
