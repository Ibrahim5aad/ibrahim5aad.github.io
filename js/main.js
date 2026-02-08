// Mobile nav toggle
const navToggle = document.querySelector('.nav__toggle');
const navLinks = document.querySelector('.nav__links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

// Active nav link
const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav__links a').forEach(link => {
  if (link.getAttribute('href') === currentPage) link.classList.add('active');
});

// Lightbox
const lightbox = document.querySelector('.lightbox');
const lightboxImg = document.querySelector('.lightbox img');
const lightboxClose = document.querySelector('.lightbox__close');

function openLightbox(src, alt) {
  if (lightbox && lightboxImg) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('active');
  }
}

if (lightbox) {
  lightbox.addEventListener('click', () => {
    lightbox.classList.remove('active');
  });
}

if (lightboxClose) {
  lightboxClose.addEventListener('click', (e) => {
    e.stopPropagation();
    lightbox.classList.remove('active');
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lightbox) {
    lightbox.classList.remove('active');
  }
});

// ---- Album rendering ----
function renderAlbums(container, albums) {
  container.innerHTML = `<div class="albums__grid">
    ${albums.map((album, i) => `
      <div class="album-cover" data-index="${i}">
        <div class="album-cover__img">
          <img src="${album.cover}" alt="${album.title}" loading="lazy" onerror="this.style.display='none'">
          <div class="album-cover__placeholder">${album.photos.length} photos</div>
        </div>
        <h3 class="album-cover__title">${album.title}</h3>
        ${album.description ? `<p class="album-cover__desc">${album.description}</p>` : ''}
      </div>
    `).join('')}
  </div>`;

  const expandedEl = document.createElement('div');
  expandedEl.className = 'album-expanded';
  expandedEl.style.display = 'none';
  container.appendChild(expandedEl);

  const gridEl = container.querySelector('.albums__grid');

  function openAlbum(index, scroll) {
    const album = albums[index];
    if (!album) return;
    gridEl.style.display = 'none';
    expandedEl.style.display = 'block';
    expandedEl.innerHTML = `
      <button class="album-expanded__back">&larr; All Albums</button>
      <h2 class="album-expanded__title">${album.title}</h2>
      ${album.description ? `<p class="album-expanded__desc">${album.description}</p>` : ''}
      <div class="gallery__grid">
        ${album.photos.map(photo => `
          <div class="gallery__item">
            <img src="${photo}" alt="${album.title}" loading="lazy" onerror="this.style.display='none'">
            <div class="gallery__placeholder">Photo</div>
          </div>
        `).join('')}
      </div>
    `;

    expandedEl.querySelector('.album-expanded__back').addEventListener('click', closeAlbum);

    expandedEl.querySelectorAll('.gallery__item').forEach(item => {
      item.addEventListener('click', () => {
        const img = item.querySelector('img');
        if (img && img.src) openLightbox(img.src, img.alt);
      });
    });

    if (scroll) window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
  }

  function closeAlbum() {
    expandedEl.style.display = 'none';
    gridEl.style.display = 'grid';
    history.pushState(null, '', location.pathname);
  }

  container.querySelectorAll('.album-cover').forEach(cover => {
    cover.addEventListener('click', () => {
      const index = parseInt(cover.dataset.index);
      const slug = albums[index].title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      history.pushState({ album: index }, '', `#${slug}`);
      openAlbum(index, true);
    });
  });

  window.addEventListener('popstate', () => {
    const hash = location.hash.slice(1);
    if (hash) {
      const index = albums.findIndex(a => a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === hash);
      if (index >= 0) openAlbum(index, false);
    } else {
      expandedEl.style.display = 'none';
      gridEl.style.display = 'grid';
    }
  });

  // Open album from URL hash on load
  const initHash = location.hash.slice(1);
  if (initHash) {
    const index = albums.findIndex(a => a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === initHash);
    if (index >= 0) openAlbum(index, false);
  }
}

// ---- Google Drive album source ----
async function driveListFiles(folderId, apiKey) {
  let all = [];
  let pageToken = '';
  do {
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&key=${apiKey}&fields=nextPageToken,files(id,name,mimeType)&pageSize=100&orderBy=name`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    all = all.concat(data.files || []);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return all;
}

document.querySelectorAll('.albums[data-drive-folder]').forEach(async container => {
  const folderId = container.dataset.driveFolder;
  const apiKey = container.dataset.driveKey;
  if (!apiKey || !folderId) return;

  showLoader(container);
  try {
    const rootContents = await driveListFiles(folderId, apiKey);
    const folders = rootContents
      .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
      .sort((a, b) => a.name.localeCompare(b.name));

    const albums = [];
    for (const folder of folders) {
      const files = await driveListFiles(folder.id, apiKey);
      const images = files
        .filter(f => f.mimeType.startsWith('image/'))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (images.length === 0) continue;

      const cdnBase = 'https://res.cloudinary.com/djwqx137d/image/fetch';
      const driveSrc = id => `https://lh3.googleusercontent.com/d/${id}`;
      const photoUrls = images.map(img => `${cdnBase}/w_1200,c_limit,f_auto,q_auto/${driveSrc(img.id)}`);

      // Per-album override: file named "cover.*" wins
      const coverFile = images.find(img => /^cover\b/i.test(img.name));
      let coverImg;
      if (coverFile) {
        coverImg = coverFile;
      } else {
        const coverMode = container.dataset.cover || 'first';
        const n = parseInt(coverMode);
        if (!isNaN(n)) coverImg = images[Math.min(n - 1, images.length - 1)] || images[0];
        else if (coverMode === 'last') coverImg = images[images.length - 1];
        else if (coverMode === 'random') coverImg = images[Math.floor(Math.random() * images.length)];
        else coverImg = images[0];
      }

      albums.push({
        title: folder.name,
        cover: `${cdnBase}/w_400,c_limit,f_auto,q_auto/${driveSrc(coverImg.id)}`,
        description: '',
        photos: photoUrls
      });
    }

    renderAlbums(container, albums);
  } catch (err) {
    console.error('Failed to load albums from Google Drive:', err);
  }
});

// ---- Data-driven writing rendering ----
function renderWritingItem(item) {
  const href = item.slug ? `writing.html?slug=${item.slug}` : item.link;
  const isExternal = !item.slug;
  return `
    <a class="writing-item" href="${href}"${isExternal ? ' target="_blank" rel="noopener"' : ''}>
      <div class="writing-item__meta">
        <span class="writing-item__date">${item.date}</span>
        ${item.type ? `<span class="writing-item__type">${item.type}</span>` : ''}
      </div>
      <h3 class="writing-item__title">${item.title}</h3>
      ${item.excerpt ? `<p class="writing-item__excerpt">${item.excerpt}</p>` : ''}
      <span class="writing-item__read">Read &rarr;</span>
    </a>
  `;
}

document.querySelectorAll('.writing-list[data-source]').forEach(container => {
  showLoader(container);
  fetch(container.dataset.source)
    .then(res => res.json())
    .then(items => {
      // Sort by date, newest first
      const months = { january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
      items.sort((a, b) => {
        const pa = (a.date || '').split(' '), pb = (b.date || '').split(' ');
        const da = new Date(parseInt(pa[1]) || 0, months[pa[0].toLowerCase()] || 0);
        const db = new Date(parseInt(pb[1]) || 0, months[pb[0].toLowerCase()] || 0);
        return db - da;
      });

      const allTypes = [...new Set(items.map(i => i.type).filter(Boolean))];

      const filterBar = document.createElement('div');
      filterBar.className = 'writing-filters';
      filterBar.innerHTML = `
        <input type="text" class="filter-search" placeholder="Search...">
        ${allTypes.length > 1 ? `
          <button class="writing-filter active" data-type="">All</button>
          ${allTypes.map(t => `<button class="writing-filter" data-type="${t}">${t}</button>`).join('')}
        ` : ''}
      `;
      container.parentNode.insertBefore(filterBar, container);

      let activeType = '';
      let searchQuery = '';

      function filterAndRender() {
        const filtered = items.filter(item => {
          const matchesType = !activeType || item.type === activeType;
          const matchesSearch = !searchQuery ||
            item.title.toLowerCase().includes(searchQuery) ||
            (item.date || '').toLowerCase().includes(searchQuery) ||
            (item.type || '').toLowerCase().includes(searchQuery);
          return matchesType && matchesSearch;
        });
        container.innerHTML = filtered.length
          ? filtered.map(renderWritingItem).join('')
          : '<p class="filter-empty">No writings found.</p>';
      }

      filterBar.querySelectorAll('.writing-filter').forEach(btn => {
        btn.addEventListener('click', () => {
          filterBar.querySelector('.writing-filter.active').classList.remove('active');
          btn.classList.add('active');
          activeType = btn.dataset.type;
          filterAndRender();
        });
      });

      filterBar.querySelector('.filter-search').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
      });

      container.innerHTML = items.map(renderWritingItem).join('');
    });
});

// ---- Writing page renderer ----
const writingPage = document.getElementById('writing-page');
if (writingPage) {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (slug) {
    showLoader(writingPage);
    fetch('data/writings.json')
      .then(res => res.json())
      .then(items => {
        const item = items.find(i => i.slug === slug);
        if (!item) {
          writingPage.innerHTML = '<p>Writing not found.</p>';
          return;
        }
        document.title = `${item.title} — Ibrahim Saad`;
        writingPage.innerHTML = `
          <header class="writing-page__header">
            ${item.type ? `<span class="writing-item__type">${item.type}</span>` : ''}
            <h1>${item.title}</h1>
            <time class="writing-page__date">${item.date}</time>
          </header>
          <div class="writing-page__body">
            ${item.content.map(p => `<p>${p}</p>`).join('')}
          </div>
        `;
      });
  }
}

// ---- Link label helper ----
function linkLabel(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('github.com')) {
      if (/\/pull\/\d+/.test(u.pathname)) return 'Pull Request';
      if (/\/issues\/\d+/.test(u.pathname)) return 'GitHub Issue';
      return 'GitHub Repo';
    }
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) return 'YouTube';
    if (u.hostname.includes('npmjs.com')) return 'npm Package';
    if (u.hostname.includes('nuget.org')) return 'NuGet Package';
    return 'Website';
  } catch { return 'View'; }
}

// ---- Data-driven card rendering ----
function renderCard(item) {
  const tags = (item.tags || [])
    .map(t => `<span class="card__tag">${t}</span>`)
    .join('');

  // Support both single link and links array
  const allLinks = item.links || (item.link ? [item.link] : []);
  const linksHtml = allLinks
    .map(url => `<a class="card__link" href="${url}" target="_blank" rel="noopener">${linkLabel(url)} &rarr;</a>`)
    .join('');

  const meta = item.context
    ? `<div class="card__meta">${item.context}</div>`
    : '';

  const year = item.year
    ? `<span class="card__year">${item.year}</span>`
    : '';

  const inProgress = item.inProgress
    ? `<span class="card__status">In Progress</span>`
    : '';

  return `
    <article class="card">
      <div class="card__header">
        <h3 class="card__title">${item.title}</h3>
        ${inProgress}
        ${year}
      </div>
      ${meta}
      <p class="card__description">${item.description}</p>
      ${tags ? `<div class="card__tags">${tags}</div>` : ''}
      ${linksHtml ? `<div class="card__links">${linksHtml}</div>` : ''}
    </article>
  `;
}

// Loading indicator helper
function showLoader(container) {
  container.innerHTML = '<div class="loader"><div class="loader__spinner"></div></div>';
}

// Load any card-list that has a data-source attribute
document.querySelectorAll('.card-list[data-source]').forEach(container => {
  showLoader(container);
  fetch(container.dataset.source)
    .then(res => res.json())
    .then(items => {
      // Collect all unique tags
      const allTags = [...new Set(items.flatMap(item => item.tags || []))].sort();

      // Build filter bar
      if (allTags.length > 0) {
        const filterBar = document.createElement('div');
        filterBar.className = 'filter-bar';
        filterBar.innerHTML = `
          <input type="text" class="filter-search" placeholder="Search...">
          <div class="filter-dropdown">
            <button class="filter-dropdown__toggle">Filter by tags</button>
            <div class="filter-dropdown__menu">
              ${allTags.map(tag => `
                <label class="filter-dropdown__item">
                  <input type="checkbox" value="${tag}">
                  <span>${tag}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="filter-active-tags"></div>
        `;
        container.parentNode.insertBefore(filterBar, container);

        // State
        const activeTags = new Set();
        let searchQuery = '';
        const toggle = filterBar.querySelector('.filter-dropdown__toggle');
        const menu = filterBar.querySelector('.filter-dropdown__menu');
        const activeBadges = filterBar.querySelector('.filter-active-tags');

        function updateActiveBadges() {
          if (activeTags.size === 0) {
            activeBadges.innerHTML = '';
            toggle.textContent = 'Filter by tags';
            return;
          }
          toggle.textContent = `Tags (${activeTags.size})`;
          activeBadges.innerHTML = [...activeTags].map(tag =>
            `<span class="filter-badge">${tag}<button data-tag="${tag}">&times;</button></span>`
          ).join('');
          activeBadges.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
              activeTags.delete(btn.dataset.tag);
              const cb = menu.querySelector(`input[value="${btn.dataset.tag}"]`);
              if (cb) cb.checked = false;
              updateActiveBadges();
              filterAndRender();
            });
          });
        }

        function filterAndRender() {
          const filtered = items.filter(item => {
            const matchesTags = activeTags.size === 0 ||
              [...activeTags].every(t => (item.tags || []).includes(t));
            const matchesSearch = !searchQuery ||
              item.title.toLowerCase().includes(searchQuery) ||
              item.description.toLowerCase().includes(searchQuery) ||
              (item.context || '').toLowerCase().includes(searchQuery) ||
              (item.tags || []).some(t => t.toLowerCase().includes(searchQuery));
            return matchesTags && matchesSearch;
          });
          container.innerHTML = filtered.length
            ? filtered.map(renderCard).join('')
            : '<p class="filter-empty">No results found.</p>';
        }

        // Toggle dropdown
        toggle.addEventListener('click', () => {
          menu.classList.toggle('open');
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
          if (!filterBar.querySelector('.filter-dropdown').contains(e.target)) {
            menu.classList.remove('open');
          }
        });

        // Checkbox change handler
        menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.addEventListener('change', () => {
            if (cb.checked) {
              activeTags.add(cb.value);
            } else {
              activeTags.delete(cb.value);
            }
            updateActiveBadges();
            filterAndRender();
          });
        });

        // Search input handler
        filterBar.querySelector('.filter-search').addEventListener('input', (e) => {
          searchQuery = e.target.value.toLowerCase().trim();
          filterAndRender();
        });
      }

      // Initial render
      container.innerHTML = items.map(renderCard).join('');
    });
});
