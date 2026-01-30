// Глобальные переменные
let currentPage = 1;
let currentQuery = '';
let debounceTimer;
let allowNSFW = localStorage.getItem('nsfw_choice') === 'true';
let currentAnimeList = [];

// --- DOMContentLoaded: все обращения к элементам здесь ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Элементы страницы ---
    const resultsDiv = document.getElementById('results');
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const filtersDiv = document.getElementById('filters');
    const toggleFiltersBtn = document.getElementById('toggle-filters');
    const themeToggle = document.getElementById('theme-toggle');

    console.log('resultsDiv:', resultsDiv);
    console.log('loading:', loading);
    console.log('errorDiv:', errorDiv);
    console.log('pagination:', pagination);
    console.log('prevBtn:', prevBtn);
    console.log('nextBtn:', nextBtn);
    console.log('pageInfo:', pageInfo);
    console.log('filtersDiv:', filtersDiv);
    console.log('toggleFiltersBtn:', toggleFiltersBtn);
    console.log('themeToggle:', themeToggle);

    // --- Функции рендера и загрузки ---
    function renderAnime(anime) {
        const year = anime.start_date ? anime.start_date.slice(0, 4) : '—';
        const animeData = {
            mal_id: anime.mal_id,
            title: anime.title,
            image: anime.image,
            type: anime.type,
            episodes: anime.episodes,
            year,
            synopsis: anime.synopsis
        };
        const animeDataStr = encodeURIComponent(JSON.stringify(animeData));
        return `
            <div class="card" data-anime="${animeDataStr}">
                <img src="${anime.image}" alt="${anime.title}">
                <div class="card-info">
                    <div class="card-title">${anime.title}</div>
                    <div class="card-meta">${anime.type} • ${year} • ${anime.episodes} эп. • ⭐ ${anime.score || '—'}</div>
                    <div class="card-synopsis">${anime.synopsis}</div>
                    ${document.body.dataset.userLoggedIn === 'true' ? `<button class="btn-add">➕ В список</button>` : ''}
                </div>
            </div>
        `;
    }

    function renderCurrentAnimeList() {
        if (resultsDiv) resultsDiv.innerHTML = currentAnimeList.map(renderAnime).join('');
    }

    function showLoading() {
        if (loading) loading.classList.remove('hidden');
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (errorDiv) errorDiv.classList.add('hidden');
        if (pagination) pagination.classList.add('hidden');
    }

    function hideLoading() {
        if (loading) loading.classList.add('hidden');
    }

    function showError(msg) {
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.classList.remove('hidden');
        }
    }

    async function searchAnime(query, page = 1) {
        console.log('searchAnime вызвана с query:', query, 'page:', page);
        
        if (!query.trim()) {
            if (resultsDiv) resultsDiv.innerHTML = '';
            if (pagination) pagination.classList.add('hidden');
            return;
        }

        showLoading();
        try {
            const sort = document.getElementById('sort-select')?.value || '';
            console.log('Запрашиваю:', `/api/search_anime?q=${encodeURIComponent(query)}&page=${page}&limit=12&order_by=${sort}&sort=desc`);
            
            const resp = await fetch(`/api/search_anime?q=${encodeURIComponent(query)}&page=${page}&limit=12&order_by=${sort}&sort=desc`);
            const data = await resp.json();
            console.log('Получены данные:', data);
            
            if (data.error) return showError(data.error);

            currentAnimeList = data.data || [];
            renderCurrentAnimeList();

            currentQuery = query;
            currentPage = page;

            // Обновляем состояние кнопок пагинации
            if (prevBtn) {
                prevBtn.disabled = page === 1;
                console.log('prevBtn disabled:', prevBtn.disabled);
            }
            if (nextBtn) {
                const hasNextPage = data.pagination?.has_next_page || false;
                nextBtn.disabled = !hasNextPage;
                console.log('nextBtn disabled:', nextBtn.disabled);
            }
            if (pageInfo) {
                pageInfo.textContent = `Страница ${page}`;
            }
            if (pagination) {
                pagination.classList.toggle('hidden', currentAnimeList.length === 0);
            }

        } catch (err) {
            console.error('Ошибка поиска:', err);
            showError('Нет соединения');
        } finally {
            hideLoading();
        }
    }

    // --- Фильтры ---
    if (toggleFiltersBtn && filtersDiv) {
        toggleFiltersBtn.addEventListener('click', () => {
            if (filtersDiv.style.maxHeight === '0px' || filtersDiv.style.maxHeight === '') {
                filtersDiv.style.maxHeight = '2000px';
                filtersDiv.style.opacity = '1';
                filtersDiv.style.paddingTop = '20px';
                filtersDiv.style.paddingBottom = '20px';
                toggleFiltersBtn.textContent = 'Скрыть фильтры ▲';
            } else {
                filtersDiv.style.maxHeight = '0px';
                filtersDiv.style.opacity = '0';
                filtersDiv.style.paddingTop = '0';
                filtersDiv.style.paddingBottom = '0';
                toggleFiltersBtn.textContent = 'Показать фильтры ▼';
            }
        });
    }

    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            document.querySelectorAll('#filters select').forEach(el => el.value = '');
            document.querySelectorAll('#filters input[type="number"]').forEach(el => el.value = '');
            document.querySelectorAll('#filters input[type="checkbox"]').forEach(el => el.checked = false);
            const foundCount = document.getElementById('found-count');
            if (foundCount) {
                foundCount.classList.add('hidden');
                foundCount.textContent = '';
            }
        });
    }

    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', async () => {
            showLoading();
            try {
                const type = document.getElementById('filter-type')?.value || '';
                const status = document.getElementById('filter-status')?.value || '';
                const rating = document.getElementById('filter-rating')?.value || '';
                const minYear = document.getElementById('filter-min-year')?.value || '';
                const maxYear = document.getElementById('filter-max-year')?.value || '';
                const genres = Array.from(document.querySelectorAll('.genres-list input[type="checkbox"]:checked')).map(cb => cb.value).join(',');

                const params = new URLSearchParams({ type, status, rating, min_year: minYear, max_year: maxYear, genres, limit: 20, sfw: allowNSFW ? 'false' : 'true' });
                const resp = await fetch(`/api/random_anime_filtered?${params}`);
                const data = await resp.json();

                const foundCountEl = document.getElementById('found-count');
                if (foundCountEl) {
                    if (data.total > 0) {
                        foundCountEl.textContent = `Найдено ≈ ${data.total.toLocaleString()} тайтлов по выбранным фильтрам`;
                        foundCountEl.classList.remove('hidden');
                    } else {
                        foundCountEl.textContent = 'По таким фильтрам ничего не найдено';
                        foundCountEl.classList.remove('hidden');
                    }
                }

                if (data.data && data.data.length > 0) {
                    currentAnimeList = data.data;
                    renderCurrentAnimeList();
                } else {
                    if (resultsDiv) resultsDiv.innerHTML = '';
                }

                if (pagination) pagination.classList.add('hidden');

            } catch (err) {
                console.error(err);
                showError('Ошибка при загрузке');
            } finally {
                hideLoading();
            }
        });
    }

    // --- Поиск и сортировка ---
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = e.target.value.trim();
                console.log('Запуск поиска для:', query);
                searchAnime(query, 1);
            }, 400);
        });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            if (!currentAnimeList.length) return;
            const sortBy = sortSelect.value;
            currentAnimeList.sort((a, b) => {
                if (sortBy === 'start_date') return new Date(b.start_date || 0) - new Date(a.start_date || 0);
                return (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0);
            });
            renderCurrentAnimeList();
        });
    }

    // --- Случайное аниме ---
    const randomBtn = document.getElementById('random-btn');
    if (randomBtn) {
        randomBtn.addEventListener('click', async () => {
            showLoading();
            try {
                const resp = await fetch(`/api/random_anime_filtered?limit=20&sfw=${allowNSFW ? 'false' : 'true'}`);
                const data = await resp.json();
                if (!data.data || data.data.length === 0) return showError('Не удалось получить аниме');
                currentAnimeList = data.data;
                renderCurrentAnimeList();
                if (pagination) pagination.classList.add('hidden');
            } catch (err) {
                console.error(err);
                showError('Ошибка соединения');
            } finally {
                hideLoading();
            }
        });
    }

    // --- Навигация по страницам ---
    console.log('Добавляю обработчики для кнопок пагинации');
    console.log('prevBtn:', prevBtn);
    console.log('nextBtn:', nextBtn);
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            console.log('Нажата кнопка "Назад", currentPage:', currentPage, 'currentQuery:', currentQuery);
            if (currentPage > 1 && currentQuery) {
                searchAnime(currentQuery, currentPage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            console.log('Нажата кнопка "Вперёд", currentPage:', currentPage, 'currentQuery:', currentQuery);
            if (currentQuery) {
                searchAnime(currentQuery, currentPage + 1);
            }
        });
    }

    // --- NSFW модалка ---
    const nsfwModal = document.getElementById('nsfw-modal');
    if (nsfwModal) {
        const rememberCheckbox = document.getElementById('remember-choice');
        const hasChosenLocal = localStorage.getItem('nsfw_choice') !== null;
        const isLoggedIn = document.body.getAttribute('data-nsfw') !== null;

        if (!isLoggedIn && !hasChosenLocal) {
            nsfwModal.classList.add('show');
            document.getElementById('nsfw-yes')?.addEventListener('click', () => {
                allowNSFW = true;
                if (rememberCheckbox?.checked) localStorage.setItem('nsfw_choice', 'true');
                nsfwModal.classList.remove('show');
            });
            document.getElementById('nsfw-no')?.addEventListener('click', () => {
                allowNSFW = false;
                if (rememberCheckbox?.checked) localStorage.setItem('nsfw_choice', 'false');
                nsfwModal.classList.remove('show');
            });
        } else if (hasChosenLocal) {
            allowNSFW = localStorage.getItem('nsfw_choice') === 'true';
            console.log("NSFW из localStorage:", allowNSFW ? "разрешён" : "запрещён");
        }
    }

    // --- Настройки 18+ ---
    const nsfwCheckbox = document.getElementById('nsfw-checkbox');
    if (nsfwCheckbox) {
        nsfwCheckbox.addEventListener('change', async (e) => {
            const checked = e.target.checked;
            const resp = await fetch('/api/set_nsfw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nsfw: checked })
            });
            const data = await resp.json();
            if (data.success) alert("Настройки 18+ обновлены!");
        });
    }

    // --- Кнопки навигации ---
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.addEventListener('click', () => window.location.href = '/settings');

    const myListBtn = document.getElementById('btn-my-list');
    if (myListBtn) myListBtn.addEventListener('click', () => window.location.href = '/my-list');

    // --- Список пользователя ---
    const listContainer = document.querySelector('.list-grid');
    if (listContainer) {
        console.log('Найдено карточек:', listContainer.querySelectorAll('.list-card-wide').length);

        // Изменение статуса, оценки, приватности
        listContainer.addEventListener('change', async (e) => {
            const card = e.target.closest('.list-card-wide');
            if (!card) return;

            const id = parseInt(card.dataset.animeId, 10);

            let endpoint = null;
            let payload = null;

            if (e.target.classList.contains('status-select')) {
                endpoint = '/api/update_status';
                payload = { id, status: e.target.value };

            } else if (e.target.classList.contains('score-select')) {
                endpoint = '/api/update_score';
                payload = {
                    id,
                    score: e.target.value ? parseInt(e.target.value, 10) : null
                };

            } else if (e.target.classList.contains('private-checkbox')) {
                endpoint = '/api/update_private';
                payload = { id, is_private: e.target.checked };

            } else if (e.target.classList.contains('comment-input')) {
                endpoint = '/api/update_comment';
                payload = { id, comment: e.target.value };

            } else {
                return;
            }

            try {
                const resp = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                if (!data.success) {
                    alert('Ошибка при обновлении');
                }
            } catch (err) {
                console.error(err);
                alert('Ошибка соединения с сервером');
            }
        });

        // Удаление
        listContainer.addEventListener('click', async (e) => {
            console.log('click event:', e.target);
            if (!e.target.classList.contains('btn-delete')) return;
            const card = e.target.closest('.list-card-wide');
            if (!card) return;
            const id = parseInt(card.dataset.animeId, 10);

            try {
                const resp = await fetch('/api/delete_from_list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const data = await resp.json();
                if (data.success) card.remove();
                else alert('Ошибка при удалении');
            } catch (err) {
                console.error(err);
                alert('Ошибка соединения с сервером');
            }
        });
    }

    // --- Кнопки добавления аниме в список ---
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-add');
        if (!btn) return;
        const card = btn.closest('.card');
        if (!card) return;
        const anime = JSON.parse(decodeURIComponent(card.dataset.anime));

        btn.disabled = true;
        try {
            const resp = await fetch('/api/toggle_list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(anime)
            });
            const data = await resp.json();
            if (data.status === 'added') {
                btn.textContent = '✔ В списке';
                btn.classList.add('added');
            } else if (data.status === 'removed') {
                btn.textContent = '➕ В список';
                btn.classList.remove('added');
            }
        } finally {
            btn.disabled = false;
        }
    });
}); // --- Конец DOMContentLoaded ---