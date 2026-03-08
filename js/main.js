/* ── State ── */
let photos   = [];
let currentIdx = null;   // modal open index
let carIdx   = 0;        // carousel current slide
let carView  = false;    // true = carousel mode

/* ── Helpers ── */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function photoId(photo, idx) {
  return photo.image
    ? photo.image.split('/').pop().replace(/\.[^.]+$/, '')
    : (photo.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'p' + idx;
}

/* ── Like helpers (localStorage) ── */
function likeKey(id) { return 'pb_like_' + id; }

function getLike(id) {
  return JSON.parse(localStorage.getItem(likeKey(id)) || '{"c":0,"on":false}');
}

function toggleLike(id) {
  const d = getLike(id);
  d.on = !d.on;
  d.c  = d.on ? d.c + 1 : Math.max(0, d.c - 1);
  localStorage.setItem(likeKey(id), JSON.stringify(d));
  return d;
}

/* ── Theme ── */
function initTheme() {
  const saved = localStorage.getItem('pb_theme') || 'dark';
  document.documentElement.dataset.theme = saved;
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('pb_theme', next);
}

/* ── View switching ── */
function showGrid() {
  carView = false;
  document.getElementById('galleryGrid').style.display = '';
  document.getElementById('carouselWrap').classList.remove('active');
  document.getElementById('btnGrid').classList.add('active');
  document.getElementById('btnCarousel').classList.remove('active');
  localStorage.setItem('pb_view', 'grid');
}

function showCarousel() {
  carView = true;
  document.getElementById('galleryGrid').style.display = 'none';
  document.getElementById('carouselWrap').classList.add('active');
  document.getElementById('btnGrid').classList.remove('active');
  document.getElementById('btnCarousel').classList.add('active');
  localStorage.setItem('pb_view', 'carousel');
  if (!document.getElementById('carouselStage').children.length) {
    renderCarousel();
  }
  goToSlide(carIdx, false);
}

/* ── Grid render ── */
function renderGallery() {
  const grid  = document.getElementById('galleryGrid');
  const count = document.getElementById('photoCount');
  if (!photos.length) {
    grid.innerHTML = '<div class="loading">No photos yet.</div>';
    if (count) count.textContent = '';
    return;
  }
  if (count) count.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;
  grid.innerHTML = photos.map((p, i) => {
    const id   = photoId(p, i);
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
  const id  = photoId(photos[idx], idx);
  const d   = toggleLike(id);
  btn.classList.toggle('liked', d.on);
  btn.querySelector('.like-num').textContent = d.c;
  if (currentIdx === idx) syncModalLike(idx);
  if (carView && carIdx === idx) syncCarInfo(idx);
}

/* ── Carousel render ── */
function renderCarousel() {
  const stage  = document.getElementById('carouselStage');
  const dots   = document.getElementById('carDots');
  const thumbs = document.getElementById('thumbStrip');
  const info   = document.getElementById('carInfo');

  if (!photos.length) {
    stage.innerHTML = '<div class="loading">No photos yet.</div>';
    dots.innerHTML = '';
    thumbs.innerHTML = '';
    info.innerHTML  = '';
    return;
  }

  // Slides
  stage.innerHTML = photos.map((p, i) => `
    <div class="car-slide">
      <img src="${p.image}" alt="${esc(p.title)}" loading="${i === 0 ? 'eager' : 'lazy'}">
    </div>`).join('');

  // Dots
  dots.innerHTML = photos.map((_, i) => `
    <button class="car-dot${i === carIdx ? ' active' : ''}"
            onclick="goToSlide(${i})" aria-label="Go to photo ${i + 1}"></button>`).join('');

  // Thumbnails
  thumbs.innerHTML = photos.map((p, i) => `
    <div class="thumb-item${i === carIdx ? ' active' : ''}" onclick="goToSlide(${i})">
      <img src="${p.image}" alt="${esc(p.title)}" loading="lazy">
    </div>`).join('');

  syncCarInfo(carIdx);
}

function goToSlide(n, animate) {
  if (!photos.length) return;
  carIdx = ((n % photos.length) + photos.length) % photos.length;
  const stage = document.getElementById('carouselStage');
  if (animate === false) {
    stage.style.transition = 'none';
    stage.style.transform  = `translateX(-${carIdx * 100}%)`;
    requestAnimationFrame(() => { stage.style.transition = ''; });
  } else {
    stage.style.transform = `translateX(-${carIdx * 100}%)`;
  }
  // dots
  document.querySelectorAll('.car-dot').forEach((d, i) => d.classList.toggle('active', i === carIdx));
  // thumbs
  document.querySelectorAll('.thumb-item').forEach((t, i) => {
    t.classList.toggle('active', i === carIdx);
    if (i === carIdx) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
  syncCarInfo(carIdx);
}

function syncCarInfo(idx) {
  const el = document.getElementById('carInfo');
  if (!photos.length || idx >= photos.length) { el.innerHTML = ''; return; }
  const p    = photos[idx];
  const id   = photoId(p, idx);
  const like = getLike(id);
  const dateStr = p.date
    ? new Date(p.date + 'T00:00:00').toLocaleDateString('en-US',
        { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const tagsHtml = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  el.innerHTML = `
    <div class="car-info-text">
      <h2 class="car-info-title">${esc(p.title || '')}</h2>
      ${p.description ? `<p class="car-info-desc">${esc(p.description)}</p>` : ''}
      ${tagsHtml    ? `<div class="car-info-tags">${tagsHtml}</div>` : ''}
      ${dateStr     ? `<p class="car-info-date">${dateStr}</p>` : ''}
    </div>
    <div class="car-info-meta">
      <button class="car-btn btn-like${like.on ? ' liked' : ''}" id="carLikeBtn" onclick="handleCarLike()">
        <span class="heart-icon">&#9829;</span><span id="carLikeCount">${like.c}</span>
      </button>
      <button class="car-btn btn-share" onclick="handleCarShare()">&#8682; Share</button>
    </div>`;
}

function handleCarLike() {
  const id = photoId(photos[carIdx], carIdx);
  const d  = toggleLike(id);
  const btn = document.getElementById('carLikeBtn');
  if (btn) { btn.classList.toggle('liked', d.on); document.getElementById('carLikeCount').textContent = d.c; }
  // sync grid card
  const card = document.querySelector(`.photo-card[data-idx="${carIdx}"] .card-like-btn`);
  if (card) { card.classList.toggle('liked', d.on); card.querySelector('.like-num').textContent = d.c; }
}

async function handleCarShare() {
  const p    = photos[carIdx];
  const data = { title: p.title || 'Photo', text: p.description || '', url: location.href };
  if (navigator.share) {
    try { await navigator.share(data); } catch (e) { if (e.name !== 'AbortError') copyLinkCar(); }
  } else { copyLinkCar(); }
}

function copyLinkCar() {
  navigator.clipboard.writeText(location.href).then(() => {
    const btn = document.querySelector('#carInfo .btn-share');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.textContent = 'Link copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2200);
  });
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
    ? new Date(p.date + 'T00:00:00').toLocaleDateString('en-US',
        { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  document.getElementById('modalTags').innerHTML = (p.tags || [])
    .map(t => `<span class="tag">${esc(t)}</span>`).join('');
  syncModalLike(idx);
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function syncModalLike(idx) {
  const id = photoId(photos[idx], idx);
  const d  = getLike(id);
  document.getElementById('modalLike').classList.toggle('liked', d.on);
  document.getElementById('modalLikeCount').textContent = d.c;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  currentIdx = null;
}

/* ── Share (modal) ── */
async function handleShare() {
  if (currentIdx === null) return;
  const p    = photos[currentIdx];
  const data = { title: p.title || 'Photo', text: p.description || '', url: location.href };
  if (navigator.share) {
    try { await navigator.share(data); } catch (e) { if (e.name !== 'AbortError') copyLink(); }
  } else { copyLink(); }
}

function copyLink() {
  navigator.clipboard.writeText(location.href).then(() => {
    const btn  = document.getElementById('modalShare');
    const orig = btn.innerHTML;
    btn.textContent = 'Link copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2200);
  });
}

/* ── Touch / swipe ── */
let touchStartX = 0;
function initSwipe() {
  const vp = document.querySelector('.carousel-viewport');
  if (!vp) return;
  vp.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  vp.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { dx < 0 ? goToSlide(carIdx + 1) : goToSlide(carIdx - 1); }
  }, { passive: true });
}

/* ── Init ── */
async function init() {
  initTheme();

  try {
    const siteRes = await fetch('/site.json');
    if (siteRes.ok) {
      const s = await siteRes.json();
      if (s.siteName) {
        document.title = s.siteName;
        document.getElementById('siteTitle').textContent  = s.siteName;
        document.getElementById('heroTitle').textContent  = s.siteName;
        document.getElementById('footerText').textContent =
          `\u00A9 ${new Date().getFullYear()} ${s.siteName}`;
      }
      if (s.tagline)    document.getElementById('heroTagline').textContent  = s.tagline;
      if (s.aboutTitle) document.getElementById('aboutTitle').textContent   = s.aboutTitle;
      if (s.aboutBio)   document.getElementById('aboutBio').textContent     = s.aboutBio;
      if (s.aboutPhoto) {
        document.getElementById('aboutImageWrap').innerHTML =
          `<img src="${s.aboutPhoto}" alt="${esc(s.aboutTitle || 'About')}">`;
      }
      const links = [];
      if (s.instagram) links.push(`<a href="${s.instagram}" target="_blank" rel="noopener">Instagram</a>`);
      if (s.twitter)   links.push(`<a href="${s.twitter}"   target="_blank" rel="noopener">Twitter</a>`);
      if (s.website)   links.push(`<a href="${s.website}"   target="_blank" rel="noopener">Website</a>`);
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

  // Restore view preference
  if (localStorage.getItem('pb_view') === 'carousel') {
    showCarousel();
  }
}

/* ── Events ── */
document.addEventListener('DOMContentLoaded', () => {
  init();
  initSwipe();

  // Theme
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

  // View
  document.getElementById('btnGrid')?.addEventListener('click', showGrid);
  document.getElementById('btnCarousel')?.addEventListener('click', showCarousel);

  // Carousel arrows
  document.getElementById('carPrev')?.addEventListener('click', () => goToSlide(carIdx - 1));
  document.getElementById('carNext')?.addEventListener('click', () => goToSlide(carIdx + 1));

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modalLike').addEventListener('click', () => {
    if (currentIdx === null) return;
    const id = photoId(photos[currentIdx], currentIdx);
    toggleLike(id);
    syncModalLike(currentIdx);
    const card = document.querySelector(`.photo-card[data-idx="${currentIdx}"] .card-like-btn`);
    if (card) {
      const d = getLike(id);
      card.classList.toggle('liked', d.on);
      card.querySelector('.like-num').textContent = d.c;
    }
  });
  document.getElementById('modalShare').addEventListener('click', handleShare);

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (carView) {
      if (e.key === 'ArrowLeft')  goToSlide(carIdx - 1);
      if (e.key === 'ArrowRight') goToSlide(carIdx + 1);
    }
  });

  // Mobile nav
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  navToggle?.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks?.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => navLinks.classList.remove('open'))
  );

  // Contact form (Netlify AJAX)
  const form = document.getElementById('contactForm');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    btn.textContent = 'Sending…';
    btn.disabled    = true;
    try {
      await fetch('/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams(new FormData(form)).toString()
      });
      form.style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';
    } catch (_) {
      btn.textContent = 'Error — try again';
      btn.disabled    = false;
    }
  });
});
