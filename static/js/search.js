// static/js/search.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
let currentMode = 'search';
let currentEndpoint = '/api/search_anime';
let currentPage = 1;
let searchTimer = null;

// Элементы DOM
const modeInput = document.getElementById('current-mode');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const searchControls = document.getElementById('search-controls'); // Изменено с sortControls
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const paginationDiv = document.getElementById('pagination');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const emptyState = document.getElementById('empty-state');
const loadingText = document.getElementById('loading-text');

// NSFW настройки
const allowNSFW = 
    document.body.dataset.nsfw === 'true' ||
    localStorage.getItem('nsfw_choice') === 'true';

// Добавьте эту функцию в начало search.js
async function initializeSearchPage() {
    // Загружаем список аниме пользователя
    await window.userState.loadUserAnimeIds();
    
    // Установка начального текста загрузки
    if (loadingText) {
        loadingText.textContent = 'Ищем аниме...';
    }
    
    // Обработчики для тегов режимов
    setupModeTags();
    
    // Обработчик поиска
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }
    
    // Обработчик сортировки
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            if (currentMode === 'search' && searchInput.value.trim()) {
                currentPage = 1;
                performSearch();
            }
        });
    }
    
    // Обработчики пагинации
    if (prevBtn) prevBtn.addEventListener('click', goPrevPage);
    if (nextBtn) nextBtn.addEventListener('click', goNextPage);
}

// Замените существующий DOMContentLoaded обработчик:
document.addEventListener('DOMContentLoaded', () => {
    initializeSearchPage();
});

// ===== ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ =====

function setupModeTags() {
    document.querySelectorAll('.mode-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            // Снимаем активность со всех тегов
            document.querySelectorAll('.mode-tag').forEach(t => 
                t.classList.remove('active'));
            
            // Активируем выбранный
            tag.classList.add('active');
            
            // Обновляем режим
            currentMode = tag.dataset.mode;
            currentEndpoint = tag.dataset.endpoint;
            currentPage = 1;
            
            // Обновляем скрытое поле
            if (modeInput) modeInput.value = currentMode;
            
            // Показываем/скрываем сортировку и поисковую строку
            updateUIForMode();
            
            // Загружаем данные
            loadDataForCurrentMode();
        });
    });
}

function updateUIForMode() {
    if (!searchControls || !searchInput) return;
    
    if (currentMode === 'search') {
        // Режим поиска: показываем все
        searchControls.style.display = 'block';
        searchInput.style.display = 'block';
        searchInput.disabled = false;
        searchInput.focus();
        searchInput.placeholder = 'Введи название аниме (рус/eng/jp)...';
    } else {
        // Режимы рейтингов: скрываем поисковые контролы
        searchControls.style.display = 'none';
        searchInput.value = '';
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====

async function loadDataForCurrentMode() {
    showLoading();
    clearError();
    
    try {
        const sfwParam = allowNSFW ? 'false' : 'true';
        let url = `${currentEndpoint}?page=${currentPage}&limit=12&sfw=${sfwParam}`;
        
        console.log(`Загрузка данных: ${url}, режим: ${currentMode}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        renderResults(data.data || []);
        updatePagination(data.pagination);
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Ошибка соединения с сервером');
    } finally {
        hideLoading();
    }
}

// ===== ПОИСК (только для режима search) =====

function handleSearchInput(e) {
    if (currentMode !== 'search') return;
    
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentPage = 1;
        performSearch();
    }, 350);
}

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        clearResults();
        return;
    }
    
    showLoading();
    clearError();
    
    try {
        const sfwParam = allowNSFW ? 'false' : 'true';
        const sortBy = sortSelect.value;
        
        let url = `/api/search_anime?q=${encodeURIComponent(query)}&page=${currentPage}&limit=12&sfw=${sfwParam}`;
        
        // Добавляем сортировку только если выбрана
        if (sortBy && sortBy !== 'score') {
            url += `&order_by=${sortBy}&sort=desc`;
        }
        
        console.log(`Поиск: ${url}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
            showError(data.error);
            return;
        }
        
        renderResults(data.data || []);
        updatePagination(data.pagination);
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showError('Ошибка соединения с сервером');
    } finally {
        hideLoading();
    }
}

// ===== РЕНДЕРИНГ И UI =====

function renderResults(animeList) {
    if (!resultsDiv) return;
    
    if (animeList.length === 0) {
        resultsDiv.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (paginationDiv) paginationDiv.classList.add('hidden');
        return;
    }
    
    resultsDiv.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    resultsDiv.innerHTML = animeList.map(anime => renderAnimeCard(anime)).join('');
    
    // Добавляем обработчики для кнопок добавления в список
    setupAddToListHandlers();
}

function renderAnimeCard(anime) {
    const year = anime.start_date ? anime.start_date.slice(0, 4) : '—';
    const animeData = {
        mal_id: anime.mal_id,
        title: anime.title,
        image: anime.image,
        type: anime.type,
        episodes: anime.episodes,
        year,
        synopsis: anime.synopsis,
        score: anime.score,
        popularity: anime.popularity
    };
    const animeDataStr = encodeURIComponent(JSON.stringify(animeData));
    
    const score = anime.score ? anime.score.toFixed(1) : '—';
    const popularity = anime.popularity ? `#${anime.popularity}` : '—';
    
    return `
        <div class="card" data-anime="${animeDataStr}">
            <div class="card-image">
                <img src="${anime.image}" alt="${anime.title}" loading="lazy">
                <div class="card-badges">
                    <span class="badge badge-type">${anime.type}</span>
                    <span class="badge badge-year">${year}</span>
                </div>
            </div>
            <div class="card-info">
                <div class="card-title">${anime.title}</div>
                <div class="card-stats">
                    <div class="stat">
                        <span class="stat-icon">⭐</span>
                        <span class="stat-value">${score}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">👥</span>
                        <span class="stat-value">${popularity}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">🎬</span>
                        <span class="stat-value">${anime.episodes || '?'} эп.</span>
                    </div>
                </div>
                <div class="card-synopsis">${anime.synopsis}</div>
                ${document.body.dataset.userLoggedIn === 'true' ? `
                    <button class="btn-add ${window.userState.hasAnime(anime.mal_id) ? 'added' : ''}">
                        <span class="btn-icon">${window.userState.hasAnime(anime.mal_id) ? '✔' : '➕'}</span>
                        ${window.userState.hasAnime(anime.mal_id) ? 'В списке' : 'В список'}
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function setupAddToListHandlers() {
    document.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-add');
            if (!btn) return;
            
            const card = btn.closest('.card');
            if (!card) return;
            
            const anime = JSON.parse(decodeURIComponent(card.dataset.anime));
            
            btn.disabled = true;
            try {
                const response = await fetch('/api/toggle_list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(anime)
                });
                const data = await response.json();
                
                if (data.status === 'added') {
                    // Обновляем локальное состояние
                    window.userState.addAnime(anime.mal_id);
                    btn.innerHTML = '<span class="btn-icon">✔</span> В списке';
                    btn.classList.add('added');
                } else if (data.status === 'removed') {
                    // Обновляем локальное состояние
                    window.userState.removeAnime(anime.mal_id);
                    btn.innerHTML = '<span class="btn-icon">➕</span> В список';
                    btn.classList.remove('added');
                }
            } catch (error) {
                console.error('Ошибка добавления в список:', error);
                alert('Не удалось добавить в список');
            } finally {
                btn.disabled = false;
            }
        });
    });
}

function updatePagination(pagination) {
    if (!paginationDiv || !prevBtn || !nextBtn || !pageInfo) return;
    
    const hasNextPage = pagination?.has_next_page || false;
    
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = !hasNextPage;
    pageInfo.textContent = `Страница ${currentPage}`;
    
    paginationDiv.classList.remove('hidden');
}

function goPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadDataForCurrentMode();
    }
}

function goNextPage() {
    currentPage++;
    loadDataForCurrentMode();
}

function clearResults() {
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.add('hidden');
    }
    if (paginationDiv) paginationDiv.classList.add('hidden');
    if (emptyState) emptyState.classList.add('hidden');
}

function showLoading() {
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    clearResults();
}

function hideLoading() {
    if (loadingDiv) loadingDiv.classList.add('hidden');
}

function showError(message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

function clearError() {
    if (errorDiv) errorDiv.classList.add('hidden');
}