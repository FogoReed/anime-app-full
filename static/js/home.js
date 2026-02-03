// static/js/home.js - НОВАЯ ВЕРСИЯ
document.addEventListener('DOMContentLoaded', () => {
    // Запускаем инициализацию
    initializeHomePage();
});

// Создаем отдельную асинхронную функцию
async function initializeHomePage() {
    // Инициализация NSFW
    initNSFW();
    
    // Загружаем список аниме пользователя
    await window.userState.loadUserAnimeIds();
    
    // Загружаем все три блока параллельно
    loadPopularAnime();
    loadTopAnime();
    loadAiringAnime();
    
    // Обработчики для кнопок добавления
    setupAddToCartHandlers();
}

// ===== ФУНКЦИИ ДЛЯ КАЖДОГО БЛОКА =====

async function loadPopularAnime() {
    const grid = document.getElementById('popular-grid');
    const loading = document.getElementById('loading-popular');
    const error = document.getElementById('error-popular');
    
    showLoading(loading, grid, error);
    
    try {
        const response = await fetch('/api/popular_anime?limit=12');
        const data = await response.json();
        
        if (data.error) {
            showError(error, data.error);
            return;
        }
        
        renderAnimeGrid('popular-grid', data.data);
    } catch (err) {
        showError(error, 'Ошибка загрузки популярных аниме');
        console.error(err);
    } finally {
        hideLoading(loading);
    }
}

async function loadTopAnime() {
    const grid = document.getElementById('top-grid');
    const loading = document.getElementById('loading-top');
    const error = document.getElementById('error-top');
    
    showLoading(loading, grid, error);
    
    try {
        const response = await fetch('/api/top_anime?limit=12');
        const data = await response.json();
        
        if (data.error) {
            showError(error, data.error);
            return;
        }
        
        renderAnimeGrid('top-grid', data.data);
    } catch (err) {
        showError(error, 'Ошибка загрузки топ аниме');
        console.error(err);
    } finally {
        hideLoading(loading);
    }
}

async function loadAiringAnime() {
    const grid = document.getElementById('airing-grid');
    const loading = document.getElementById('loading-airing');
    const error = document.getElementById('error-airing');
    
    showLoading(loading, grid, error);
    
    try {
        const response = await fetch('/api/airing_anime?limit=12');
        const data = await response.json();
        
        if (data.error) {
            showError(error, data.error);
            return;
        }
        
        renderAnimeGrid('airing-grid', data.data);
    } catch (err) {
        showError(error, 'Ошибка загрузки новинок');
        console.error(err);
    } finally {
        hideLoading(loading);
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function showLoading(loadingElement, gridElement, errorElement) {
    if (loadingElement) loadingElement.style.display = 'block';
    if (gridElement) gridElement.innerHTML = '';
    if (errorElement) errorElement.classList.add('hidden');
}

function hideLoading(loadingElement) {
    if (loadingElement) loadingElement.style.display = 'none';
}

function showError(errorElement, message) {
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function renderAnimeGrid(gridId, animeList) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    
    grid.innerHTML = animeList.map(anime => renderAnimeCard(anime)).join('');
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

function setupAddToCartHandlers() {
    document.addEventListener('click', async (e) => {
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
}

function initNSFW() {
    const nsfwModal = document.getElementById('nsfw-modal');
    if (nsfwModal) {
        const rememberCheckbox = document.getElementById('remember-choice');
        const hasChosenLocal = localStorage.getItem('nsfw_choice') !== null;
        const isLoggedIn = document.body.getAttribute('data-user-logged-in') === 'true';

        if (!isLoggedIn && !hasChosenLocal) {
            nsfwModal.classList.add('show');
            document.getElementById('nsfw-yes')?.addEventListener('click', () => {
                if (rememberCheckbox?.checked) localStorage.setItem('nsfw_choice', 'true');
                nsfwModal.classList.remove('show');
            });
            document.getElementById('nsfw-no')?.addEventListener('click', () => {
                if (rememberCheckbox?.checked) localStorage.setItem('nsfw_choice', 'false');
                nsfwModal.classList.remove('show');
            });
        }
    }
}