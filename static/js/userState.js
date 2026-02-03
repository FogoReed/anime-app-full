// static/js/userState.js
window.userState = {
    animeIds: new Set(),
    
    async loadUserAnimeIds() {
        const isLoggedIn = document.body.dataset.userLoggedIn === 'true';
        
        if (!isLoggedIn) {
            console.log('Пользователь не авторизован, пропускаем загрузку списка');
            return;
        }
        
        try {
            console.log('Загружаем список anime_id пользователя...');
            const response = await fetch('/api/my_anime_ids');
            const data = await response.json();
            
            if (data.success && data.ids) {
                this.animeIds = new Set(data.ids);
                console.log(`Загружено ${data.ids.length} anime_id пользователя`);
            }
        } catch (error) {
            console.error('Ошибка загрузки списка аниме пользователя:', error);
        }
    },
    
    hasAnime(malId) {
        return this.animeIds.has(parseInt(malId));
    },
    
    addAnime(malId) {
        this.animeIds.add(parseInt(malId));
    },
    
    removeAnime(malId) {
        this.animeIds.delete(parseInt(malId));
    }
};