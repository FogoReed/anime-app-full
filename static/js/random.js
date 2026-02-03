// Глобальные переменные
let allowNSFW;

// Функция загрузки жанров
async function loadGenres() {
    const genresList = document.querySelector('.genres-list');
    if (!genresList) {
        console.error('Элемент .genres-list не найден!');
        return;
    }
    
    try {
        console.log('Загружаю жанры...');
        const resp = await fetch('/api/genres');
        const data = await resp.json();
        
        if (data.genres && data.genres.length > 0) {
            const displayGenres = data.genres;
            
            genresList.innerHTML = displayGenres.map(genre => `
                <label>
                    <input type="checkbox" value="${genre.mal_id}">
                    <span>${genre.name}</span>
                </label>
            `).join('');
            
            console.log(`Загружено ${displayGenres.length} жанров`);
        } else {
            console.error('Жанры не получены от сервера');
            genresList.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-secondary);">Не удалось загрузить жанры</p>';
        }
    } catch (err) {
        console.error('Ошибка загрузки жанров:', err);
        genresList.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-secondary);">Ошибка загрузки жанров</p>';
    }
}

// Функция инициализации NSFW настроек
function initNSFW() {
    const isLoggedIn = document.body.dataset.userLoggedIn === 'true';
    const hasNsfwLocal = localStorage.getItem('nsfw_choice') !== null;
    
    console.log('Инициализация NSFW:', {
        isLoggedIn,
        hasNsfwLocal,
        dataNsfw: document.body.getAttribute('data-nsfw')
    });
    
    if (isLoggedIn) {
        // Для авторизованных пользователей берем настройки с сервера
        allowNSFW = document.body.getAttribute('data-nsfw') === 'true';
        console.log('Авторизованный пользователь, NSFW:', allowNSFW);
    } else if (hasNsfwLocal) {
        // Для неавторизованных с сохраненным выбором
        allowNSFW = localStorage.getItem('nsfw_choice') === 'true';
        console.log('Неавторизованный с выбором, NSFW:', allowNSFW);
    } else {
        // По умолчанию для новых пользователей
        allowNSFW = false;
        console.log('Новый пользователь, NSFW по умолчанию:', allowNSFW);
    }
}

// Добавьте эту функцию в начало random.js
async function initializeRandomPage() {
    console.log('Инициализируем random.js');

    // Инициализация NSFW
    initNSFW();
    
    console.log('Итоговое значение allowNSFW:', allowNSFW);

    // Загружаем список аниме пользователя
    await window.userState.loadUserAnimeIds();

    // --- Элементы страницы ---
    const resultsDiv = document.getElementById('results-random');
    const loading = document.getElementById('loading-random');
    const errorDiv = document.getElementById('error-random');
    const filtersDiv = document.getElementById('filters');
    const toggleFiltersBtn = document.getElementById('toggle-filters');
    const randomAgainBtn = document.getElementById('random-again');

    console.log('Найденные элементы:', {
        resultsDiv,
        loading,
        errorDiv,
        filtersDiv,
        toggleFiltersBtn,
        randomAgainBtn
    });

    // --- Функции рендера и загрузки ---
    function renderAnime(anime) {
        const year = anime.start_date ? anime.start_date.slice(0, 4) : anime.year;
        const animeData = {
            mal_id: anime.mal_id,
            title: anime.title,
            image: anime.image,
            type: anime.type,
            episodes: anime.episodes,
            year: year || '—',
            synopsis: anime.synopsis
        };
        const animeDataStr = encodeURIComponent(JSON.stringify(animeData));
        return `
            <div class="card" data-anime="${animeDataStr}">
                <img src="${anime.image || '/static/images/no-image.png'}" alt="${anime.title}" onerror="this.src='/static/images/no-image.png'">
                <div class="card-info">
                    <div class="card-title">${anime.title}</div>
                    <div class="card-meta">${anime.type} • ${year || '—'} • ${anime.episodes} эп. • ⭐ ${anime.score || '—'}</div>
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

    function renderCurrentAnimeList() {
        if (resultsDiv) {
            resultsDiv.innerHTML = currentAnimeList.map(renderAnime).join('');
            console.log(`Отрендерено ${currentAnimeList.length} аниме`);
        }
    }

    function showLoading() {
        if (loading) {
            loading.classList.remove('hidden');
            console.log('Показываем загрузку');
        }
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (errorDiv) errorDiv.classList.add('hidden');
    }

    function hideLoading() {
        if (loading) {
            loading.classList.add('hidden');
            console.log('Скрываем загрузку');
        }
    }

    function showError(msg) {
        if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.classList.remove('hidden');
            console.error('Ошибка:', msg);
        }
    }

    // --- Фильтры ---
    if (toggleFiltersBtn && filtersDiv) {
        toggleFiltersBtn.addEventListener('click', () => {
            const isHidden = filtersDiv.style.maxHeight === '0px' || filtersDiv.style.maxHeight === '';
            
            if (isHidden) {
                filtersDiv.style.maxHeight = '2000px';
                filtersDiv.style.opacity = '1';
                filtersDiv.style.paddingTop = '20px';
                filtersDiv.style.paddingBottom = '20px';
                toggleFiltersBtn.textContent = 'Скрыть фильтры ▲';
                console.log('Показываем фильтры');
            } else {
                filtersDiv.style.maxHeight = '0px';
                filtersDiv.style.opacity = '0';
                filtersDiv.style.paddingTop = '0';
                filtersDiv.style.paddingBottom = '0';
                toggleFiltersBtn.textContent = 'Показать фильтры ▼';
                console.log('Скрываем фильтры');
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
            console.log('Фильтры очищены');
        });
    }

    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', async () => {
            console.log('Применяем фильтры...');
            console.log('Текущее allowNSFW:', allowNSFW);
            console.log('SFW параметр для запроса:', allowNSFW ? 'false' : 'true');
            
            showLoading();
            try {
                const type = document.getElementById('filter-type')?.value || '';
                const status = document.getElementById('filter-status')?.value || '';
                const rating = document.getElementById('filter-rating')?.value || '';
                const minYear = document.getElementById('filter-min-year')?.value || '';
                const maxYear = document.getElementById('filter-max-year')?.value || '';
                
                // Собираем выбранные жанры
                const genreCheckboxes = document.querySelectorAll('.genres-list input[type="checkbox"]:checked');
                const genres = Array.from(genreCheckboxes).map(cb => cb.value).join(',');
                
                console.log('Параметры фильтров:', { type, status, rating, minYear, maxYear, genres });

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
                
                console.log('Запрашиваю:', `/api/random_anime_filtered?${params}`);
                const resp = await fetch(`/api/random_anime_filtered?${params}`);
                const data = await resp.json();
                
                console.log('Получены данные:', data);

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
                    
                    // Показываем кнопку "Ещё разок"
                    if (randomAgainBtn) {
                        randomAgainBtn.style.display = 'inline-block';
                    }
                } else {
                    if (resultsDiv) resultsDiv.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">По таким фильтрам ничего не найдено</p>';
                }

            } catch (err) {
                console.error('Ошибка:', err);
                showError('Ошибка при загрузке: ' + err.message);
            } finally {
                hideLoading();
            }
        });
    }

    // --- Случайное аниме ---
    const randomBtn = document.getElementById('random-btn');
    if (randomBtn) {
        randomBtn.addEventListener('click', async () => {
            console.log('Запрашиваю случайные аниме...');
            console.log('Текущее allowNSFW:', allowNSFW);
            console.log('SFW параметр для запроса:', allowNSFW ? 'false' : 'true');
            
            showLoading();
            try {
                const resp = await fetch(`/api/random_anime_filtered?limit=20&sfw=${allowNSFW ? 'false' : 'true'}`);
                const data = await resp.json();
                console.log('Получены данные:', data);
                
                if (!data.data || data.data.length === 0) {
                    return showError('Не удалось получить аниме. Попробуйте позже.');
                }
                
                currentAnimeList = data.data;
                renderCurrentAnimeList();
                
                // Показываем кнопку "Ещё разок"
                if (randomAgainBtn) {
                    randomAgainBtn.style.display = 'inline-block';
                }
                
            } catch (err) {
                console.error(err);
                showError('Ошибка соединения с сервером');
            } finally {
                hideLoading();
            }
        });
    }

    // Кнопка "Ещё разок"
    if (randomAgainBtn) {
        randomAgainBtn.addEventListener('click', () => {
            if (randomBtn) {
                randomBtn.click();
            }
        });
    }

    // --- NSFW модалка (только для неавторизованных пользователей) ---
    const nsfwModal = document.getElementById('nsfw-modal');
    if (nsfwModal) {
        const rememberCheckbox = document.getElementById('remember-choice');
        const hasChosenLocal = localStorage.getItem('nsfw_choice') !== null;
        const isLoggedIn = document.body.dataset.userLoggedIn === 'true';

        console.log('Проверка NSFW модалки:', {
            hasChosenLocal,
            isLoggedIn,
            localStorageValue: localStorage.getItem('nsfw_choice'),
            dataNsfw: document.body.getAttribute('data-nsfw')
        });

        if (!isLoggedIn && !hasChosenLocal) {
            console.log('Показываем модалку NSFW для неавторизованного пользователя');
            nsfwModal.classList.add('show');
            
            document.getElementById('nsfw-yes')?.addEventListener('click', () => {
                allowNSFW = true;
                if (rememberCheckbox?.checked) {
                    localStorage.setItem('nsfw_choice', 'true');
                }
                nsfwModal.classList.remove('show');
                console.log('Пользователь разрешил NSFW, новое allowNSFW:', allowNSFW);
            });
            
            document.getElementById('nsfw-no')?.addEventListener('click', () => {
                allowNSFW = false;
                if (rememberCheckbox?.checked) {
                    localStorage.setItem('nsfw_choice', 'false');
                }
                nsfwModal.classList.remove('show');
                console.log('Пользователь запретил NSFW, новое allowNSFW:', allowNSFW);
            });
        }
    }

    // --- Кнопки навигации ---
    const settingsBtn = document.getElementById('btn-settings');
    if (settingsBtn) settingsBtn.addEventListener('click', () => window.location.href = '/settings');

    const myListBtn = document.getElementById('btn-my-list');
    if (myListBtn) myListBtn.addEventListener('click', () => window.location.href = '/my-list');

    // --- Кнопки добавления аниме в список ---
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-add');
        if (!btn) return;
        const card = btn.closest('.card');
        if (!card) return;
        
        try {
            const anime = JSON.parse(decodeURIComponent(card.dataset.anime));
            btn.disabled = true;
            
            const resp = await fetch('/api/toggle_list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(anime)
            });
            const data = await resp.json();
            
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
        } catch (err) {
            console.error('Ошибка добавления в список:', err);
            alert('Ошибка при добавлении в список');
        } finally {
            btn.disabled = false;
        }
    });

    // --- Загрузка жанров при старте ---
    console.log('Загружаю жанры...');
    loadGenres();

}

// Замените текущий обработчик:
document.addEventListener('DOMContentLoaded', () => {
    initializeRandomPage();
});