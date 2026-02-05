// static/js/modal.js
// Универсальная модалка с деталями аниме

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('anime-modal');
    if (!modal) {
        console.warn('Модальное окно #anime-modal не найдено на странице');
        return;
    }

    const closeBtn = modal.querySelector('.modal-close-btn');
    const poster = document.getElementById('modal-poster');
    const titleMain = document.getElementById('modal-title-main');
    const titleEn = document.getElementById('modal-title-en');
    const titleJp = document.getElementById('modal-title-jp');
    const scoreEl = document.getElementById('modal-score');
    const yearEl = document.getElementById('modal-year');
    const episodesEl = document.getElementById('modal-episodes');
    const typeEl = document.getElementById('modal-type');
    const synopsisEl = document.getElementById('modal-synopsis-text');

    // ─── Функции ───
    function showModal() {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function hideModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function fillModal(data) {
        poster.src = data.image || '/static/images/no-image.png';
        poster.alt = data.title || 'Аниме';

        titleMain.textContent = data.title || '—';
        titleEn.textContent = data.title_en ? `EN: ${data.title_en}` : '';
        titleJp.textContent = data.title_jp ? `JP: ${data.title_jp}` : '';

        scoreEl.textContent    = data.score ? `⭐ ${data.score}` : '⭐ —';
        yearEl.textContent     = data.year || '—';
        episodesEl.textContent = data.episodes ? `${data.episodes} эп.` : '— эп.';
        typeEl.textContent     = data.type || '—';

        synopsisEl.textContent = data.synopsis || 'Описание отсутствует';

        // ─── Динамическое создание ссылок (для массива!) ───
        const watchLinksContainer = modal.querySelector('.watch-links');
        if (!watchLinksContainer) return;

        watchLinksContainer.innerHTML = '';  // Очищаем

        // data.links — это массив [{url, label}, ...]
        (data.links || []).forEach(linkInfo => {
            const a = document.createElement('a');
            a.className = 'btn-link';
            a.href = linkInfo.url || '#';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = linkInfo.label || 'Ссылка';

            // Если ссылка пустая — делаем её неактивной
            if (!linkInfo.url || linkInfo.url === '#') {
                a.style.opacity = '0.5';
                a.style.pointerEvents = 'none';
            }

            watchLinksContainer.appendChild(a);
        });

        // Если ссылок совсем нет
        if (watchLinksContainer.children.length === 0) {
            watchLinksContainer.innerHTML = '<p style="color: var(--text-secondary);">Ссылки недоступны</p>';
        }
    }

    async function openAnimeModal(malId) {
        try {
            const resp = await fetch(`/api/anime/${malId}`);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            const data = await resp.json();

            if (data.error) {
                alert('Не удалось загрузить данные об аниме');
                return;
            }

            fillModal(data);
            showModal();
        } catch (err) {
            console.error('Ошибка при открытии модалки:', err);
            alert('Не удалось загрузить информацию');
        }
    }

    // ─── Глобальный обработчик кликов ───
    document.addEventListener('click', e => {
        if (
            e.target.closest(
                'button, a, input, select, textarea, .btn-add, .btn-delete'
            )
        ) {
            return;
        }

        const card = e.target.closest('.card, .anime-card, .list-card-wide, .list-card');
        if (!card) return;

        let malId = card.dataset.malId ||
            card.dataset.id ||
            card.dataset.animeId ||
            card.dataset.malId;

        if (!malId && card.dataset.anime) {
            try {
                const animeObj = JSON.parse(decodeURIComponent(card.dataset.anime));
                malId = animeObj.mal_id || animeObj.malId;
            } catch (err) {
                console.warn('Не удалось распарсить data-anime', err);
            }
        }

        if (!malId) return;

        e.preventDefault();
        openAnimeModal(malId);
    });

    // ─── Закрытие модалки ───
    if (closeBtn) {
        closeBtn.addEventListener('click', hideModal);
    }

    modal.addEventListener('click', e => {
        if (e.target === modal) hideModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            hideModal();
        }
    });
});