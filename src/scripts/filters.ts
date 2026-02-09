/**
 * Client-side filtering for pre-rendered card lists and writing lists.
 * Works by showing/hiding existing DOM elements.
 */

export function initCardFilters(container: HTMLElement) {
  const cards = Array.from(container.querySelectorAll('.card')) as HTMLElement[];
  if (cards.length === 0) return;

  // Collect all unique tags
  const allTags = [...new Set(
    cards.flatMap(card => {
      try { return JSON.parse(card.dataset.tags || '[]'); }
      catch { return []; }
    })
  )].sort() as string[];

  if (allTags.length === 0) return;

  // Build filter bar
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
  container.parentNode!.insertBefore(filterBar, container);

  const activeTags = new Set<string>();
  let searchQuery = '';
  const toggle = filterBar.querySelector('.filter-dropdown__toggle')!;
  const menu = filterBar.querySelector('.filter-dropdown__menu')!;
  const activeBadges = filterBar.querySelector('.filter-active-tags')!;

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
        const tag = (btn as HTMLElement).dataset.tag!;
        activeTags.delete(tag);
        const cb = menu.querySelector(`input[value="${tag}"]`) as HTMLInputElement;
        if (cb) cb.checked = false;
        updateActiveBadges();
        filterAndRender();
      });
    });
  }

  function filterAndRender() {
    let anyVisible = false;
    cards.forEach(card => {
      const cardTags: string[] = (() => {
        try { return JSON.parse(card.dataset.tags || '[]'); }
        catch { return []; }
      })();
      const title = (card.dataset.title || '').toLowerCase();
      const description = (card.dataset.description || '').toLowerCase();
      const context = (card.dataset.context || '').toLowerCase();

      const matchesTags = activeTags.size === 0 ||
        [...activeTags].every(t => cardTags.includes(t));
      const matchesSearch = !searchQuery ||
        title.includes(searchQuery) ||
        description.includes(searchQuery) ||
        context.includes(searchQuery) ||
        cardTags.some(t => t.toLowerCase().includes(searchQuery));

      const visible = matchesTags && matchesSearch;
      card.style.display = visible ? '' : 'none';
      if (visible) anyVisible = true;
    });

    // Show/hide empty message
    let emptyMsg = container.querySelector('.filter-empty') as HTMLElement;
    if (!anyVisible) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('p');
        emptyMsg.className = 'filter-empty';
        emptyMsg.textContent = 'No results found.';
        container.appendChild(emptyMsg);
      }
      emptyMsg.style.display = '';
    } else if (emptyMsg) {
      emptyMsg.style.display = 'none';
    }
  }

  toggle.addEventListener('click', () => menu.classList.toggle('open'));

  document.addEventListener('click', (e) => {
    if (!filterBar.querySelector('.filter-dropdown')!.contains(e.target as Node)) {
      menu.classList.remove('open');
    }
  });

  menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const input = cb as HTMLInputElement;
      if (input.checked) activeTags.add(input.value);
      else activeTags.delete(input.value);
      updateActiveBadges();
      filterAndRender();
    });
  });

  filterBar.querySelector('.filter-search')!.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
    filterAndRender();
  });
}

export function initWritingFilters(container: HTMLElement) {
  const items = Array.from(container.querySelectorAll('.writing-item')) as HTMLElement[];
  if (items.length === 0) return;

  const allTypes = [...new Set(items.map(i => i.dataset.type).filter(Boolean))] as string[];

  const filterBar = document.createElement('div');
  filterBar.className = 'writing-filters';
  filterBar.innerHTML = `
    <input type="text" class="filter-search" placeholder="Search...">
    ${allTypes.length > 1 ? `
      <button class="writing-filter active" data-type="">All</button>
      ${allTypes.map(t => `<button class="writing-filter" data-type="${t}">${t}</button>`).join('')}
    ` : ''}
  `;
  container.parentNode!.insertBefore(filterBar, container);

  let activeType = '';
  let searchQuery = '';

  function filterAndRender() {
    let anyVisible = false;
    items.forEach(item => {
      const type = item.dataset.type || '';
      const title = (item.dataset.title || '').toLowerCase();
      const date = (item.dataset.date || '').toLowerCase();

      const matchesType = !activeType || type === activeType;
      const matchesSearch = !searchQuery ||
        title.includes(searchQuery) ||
        date.includes(searchQuery) ||
        type.toLowerCase().includes(searchQuery);

      const visible = matchesType && matchesSearch;
      item.style.display = visible ? '' : 'none';
      if (visible) anyVisible = true;
    });

    let emptyMsg = container.querySelector('.filter-empty') as HTMLElement;
    if (!anyVisible) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('p');
        emptyMsg.className = 'filter-empty';
        emptyMsg.textContent = 'No writings found.';
        container.appendChild(emptyMsg);
      }
      emptyMsg.style.display = '';
    } else if (emptyMsg) {
      emptyMsg.style.display = 'none';
    }
  }

  filterBar.querySelectorAll('.writing-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      filterBar.querySelector('.writing-filter.active')?.classList.remove('active');
      btn.classList.add('active');
      activeType = (btn as HTMLElement).dataset.type || '';
      filterAndRender();
    });
  });

  filterBar.querySelector('.filter-search')!.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
    filterAndRender();
  });
}
