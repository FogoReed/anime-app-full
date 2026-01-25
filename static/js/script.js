let currentPage = 1;
let currentQuery = '';
let debounceTimer;
let allowNSFW = localStorage.getItem('nsfw_choice') === 'true';
let currentAnimeList = [];

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

// Тема
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const newTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

// Toggle фильтров
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

// Очистка фильтров
document.getElementById('clear-filters').addEventListener('click', () => {
    document.querySelectorAll('#filters select').forEach(el => el.value = '');
    document.querySelectorAll('#filters input[type="number"]').forEach(el => el.value = '');
    document.querySelectorAll('#filters input[type="checkbox"]').forEach(el => el.checked = false);
    document.getElementById('found-count').classList.add('hidden');
    document.getElementById('found-count').textContent = '';
});

// Live search + сортировка
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchAnime(e.target.value.trim(), 1);
    }, 400);
});

document.getElementById('sort-select').addEventListener('change', () => {
    if (!currentAnimeList.length) return;

    const sortBy = document.getElementById('sort-select').value;

    currentAnimeList.sort((a, b) => {
        if (sortBy === 'start_date') {
            return new Date(b.start_date || 0) - new Date(a.start_date || 0);
        }

        return (Number(b[sortBy]) || 0) - (Number(a[sortBy]) || 0);
    });

    renderCurrentAnimeList();
});

async function searchAnime(query, page = 1) {
    if (!query.trim()) {
        resultsDiv.innerHTML = '';
        pagination.classList.add('hidden');
        return;
    }

    showLoading();
    try {
        const sort = document.getElementById('sort-select').value;
        const resp = await fetch(
            `/api/search_anime?q=${encodeURIComponent(query)}&page=${page}&limit=12&order_by=${sort}&sort=desc`
        );
        const data = await resp.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentAnimeList = data.data;
        renderCurrentAnimeList();

        currentQuery = query;
        currentPage = page;

        const hasNext = data.pagination?.has_next_page || false;
        prevBtn.disabled = page === 1;
        nextBtn.disabled = !hasNext;
        pageInfo.textContent = `Страница ${page}`;
        pagination.classList.toggle('hidden', data.data.length === 0);

    } catch (e) {
        showError('Нет соединения');
    } finally {
        hideLoading();
    }
}


function renderCurrentAnimeList() {
    resultsDiv.innerHTML = currentAnimeList.map(renderAnime).join('');
}

// Несколько случайных аниме + количество
document.getElementById('apply-filters').addEventListener('click', async () => {
    showLoading();

    try {
        const type = document.getElementById('filter-type').value;
        const status = document.getElementById('filter-status').value;
        const rating = document.getElementById('filter-rating').value;
        const minYear = document.getElementById('filter-min-year').value;
        const maxYear = document.getElementById('filter-max-year').value;

        const genres = Array.from(
            document.querySelectorAll('.genres-list input[type="checkbox"]:checked')
        ).map(cb => cb.value).join(',');

        const params = new URLSearchParams({
            type,
            status,
            rating,
            min_year: minYear,
            max_year: maxYear,
            genres,
            limit: 20,
            sfw: allowNSFW ? 'false' : 'true'
        });

        const resp = await fetch(`/api/random_anime_filtered?${params}`);
        const data = await resp.json();

        const foundCountEl = document.getElementById('found-count');

        if (data.total > 0) {
            foundCountEl.textContent = `Найдено ≈ ${data.total.toLocaleString()} тайтлов по выбранным фильтрам`;
            foundCountEl.classList.remove('hidden');
        } else {
            foundCountEl.textContent = 'По таким фильтрам ничего не найдено';
            foundCountEl.classList.remove('hidden');
        }

        // Показываем аниме только если есть хоть один результат на этой странице
        if (data.data && data.data.length > 0) {
            currentAnimeList = data.data;
            renderCurrentAnimeList();
        } else {
            // Не скрываем найденное количество, просто не рендерим карточки
            resultsDiv.innerHTML = '';
        }

        pagination.classList.add('hidden');

    } catch (e) {
        console.error(e);
        showError('Ошибка при загрузке');
    } finally {
        hideLoading();
    }
});

function showLoading() {
    loading.classList.remove('hidden');
    resultsDiv.innerHTML = '';
    errorDiv.classList.add('hidden');
    pagination.classList.add('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
}

function renderAnime(anime) {
    const year = anime.start_date
        ? anime.start_date.slice(0, 4)
        : '—';

    return `
        <div class="card">
            <img src="${anime.image}" alt="${anime.title}">
            <div class="card-info">
                <div class="card-title">${anime.title}</div>
                <div class="card-meta">
                    ${anime.type} • ${year} • ${anime.episodes} эп. • ⭐ ${anime.score}
                </div>
                <div class="card-synopsis">${anime.synopsis}</div>
            </div>
        </div>
    `;
}

// Live search с debounce
document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        searchAnime(e.target.value.trim(), 1);
    }, 400);
});

// Кнопка случайного аниме (БЕЗ фильтров)
document.getElementById('random-btn').addEventListener('click', async () => {
    showLoading();

    try {
        const resp = await fetch('/api/random_anime_filtered?limit=20&sfw=' + (allowNSFW ? 'false' : 'true'));
        const data = await resp.json();

        if (!data.data || data.data.length === 0) {
            showError('Не удалось получить аниме');
            return;
        }

        currentAnimeList = data.data;
        renderCurrentAnimeList();

        pagination.classList.add('hidden');

    } catch (e) {
        console.error(e);
        showError('Ошибка соединения');
    } finally {
        hideLoading();
    }
});

// Показ модального окна NSFW при первом посещении
document.addEventListener('DOMContentLoaded', () => {
    const nsfwModal = document.getElementById('nsfw-modal');
    const rememberCheckbox = document.getElementById('remember-choice');
    const hasChosen = localStorage.getItem('nsfw_choice') !== null;

    // Если выбор уже сохранён — используем его
    if (hasChosen) {
        allowNSFW = localStorage.getItem('nsfw_choice') === 'true';
        console.log("Загружено из памяти:", allowNSFW ? "18+ разрешён" : "18+ запрещён");
        return;
    }

    // Если выбора нет — показываем модалку
    nsfwModal.classList.add('show');

    document.getElementById('nsfw-yes').addEventListener('click', () => {
        allowNSFW = true;
        if (rememberCheckbox.checked) {
            localStorage.setItem('nsfw_choice', 'true');
        }
        nsfwModal.classList.remove('show');
    });

    document.getElementById('nsfw-no').addEventListener('click', () => {
        allowNSFW = false;
        if (rememberCheckbox.checked) {
            localStorage.setItem('nsfw_choice', 'false');
        }
        nsfwModal.classList.remove('show');
    });
});

// Пагинация
prevBtn.addEventListener('click', () => searchAnime(currentQuery, currentPage - 1));
nextBtn.addEventListener('click', () => searchAnime(currentQuery, currentPage + 1));