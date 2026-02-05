import datetime
import requests
import time
import random

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from config import Config
from models import db, User, UserAnime

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- User loader для Flask-Login ---
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Создаем таблицы при старте
with app.app_context():
    db.create_all()

# --- Регистрация ---
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if User.query.filter_by(username=username).first():
            flash("Имя уже занято", "danger")
            return redirect(url_for('register'))

        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        user = User(username=username, password=hashed_pw)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        flash("Регистрация успешна!", "success")
        return redirect(url_for('index'))

    return render_template('register.html')

# --- Логин ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()
        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            flash("Вход успешен!", "success")
            return redirect(url_for('index'))
        flash("Неверное имя или пароль", "danger")

    return render_template('login.html')

# --- Логаут ---
@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash("Вы вышли", "info")
    return redirect(url_for('index'))

JIKAN_BASE = "https://api.jikan.moe/v4"
LAST_REQUEST_TIME = 0  # Защита от rate limit Jikan (3 req/sec)

def rate_limited_get(url, params=None, retries=3):
    global LAST_REQUEST_TIME
    # Jikan: минимум 0.34 сек между запросами
    elapsed = time.time() - LAST_REQUEST_TIME
    if elapsed < 0.34:
        time.sleep(0.34 - elapsed)
    
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=10)
            LAST_REQUEST_TIME = time.time()
            if resp.status_code == 429:  # Rate limit
                time.sleep(2 ** attempt)
                continue
            return resp
        except requests.exceptions.RequestException:
            if attempt == retries - 1:
                raise
            time.sleep(1)
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search_anime')
def search_anime():
    # ПАРАМЕТРЫ
    query = request.args.get('q', '').strip()
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 12)), 25)
    order_by = request.args.get('order_by', 'score')
    sort = request.args.get('sort', 'desc')
    sfw_param = request.args.get('sfw', 'true')
    
    # УБРАТЬ ВЕСЬ БЛОК ОБРАБОТКИ quick-tags!
    # НАЧИНАЕМ СРАЗУ С ПРОВЕРКИ query
    
    if not query:
        return jsonify({'data': [], 'pagination': {'has_next_page': False}})
    
    try:
        params = {
            'q': query,
            'page': page,
            'limit': limit
        }
        # Можно добавить сортировку ТОЛЬКО для поиска
        if order_by and order_by != 'score':
            params['order_by'] = order_by
            params['sort'] = sort
            
        if sfw_param == 'true':
            params['sfw'] = 'true'
            
        resp = rate_limited_get(f"{JIKAN_BASE}/anime", params)
        return process_search_response(resp)
    except Exception as e:
        app.logger.error(f"Error in search_anime: {str(e)}")
        return jsonify({'error': 'Произошла ошибка, попробуй ещё раз'}), 500

def process_search_response(resp):
    """Обработка ответа от Jikan API"""
    if resp is None or resp.status_code != 200:
        return jsonify({'error': 'Сервис временно недоступен, попробуй позже'}), 503

    json_data = resp.json()
    anime_list = json_data.get('data', [])
    
    results = []
    for a in anime_list:
        # Получаем жанры
        genres = []
        if 'genres' in a:
            genres = [genre['name'] for genre in a['genres']]
        if 'explicit_genres' in a:
            genres.extend([genre['name'] for genre in a['explicit_genres']])
            
        results.append({
            'mal_id': a['mal_id'],
            'title': a.get('title_english') or a['title'],
            'image': a['images']['jpg']['large_image_url'],
            'score': a.get('score'),
            'popularity': a.get('popularity') or 0,
            'members': a.get('members') or 0,
            'favorites': a.get('favorites') or 0,
            'start_date': a.get('aired', {}).get('from'),
            'year': a.get('year') or 'N/A',
            'type': a.get('type', 'TV'),
            'episodes': a.get('episodes') or '?',
            'synopsis': (a.get('synopsis') or 'Нет описания')[:200] + '...',
            'genres': genres[:3]
        })

    return jsonify({
        'data': results,
        'pagination': json_data.get('pagination', {})
    })

@app.route('/api/random_anime_filtered')
def random_anime_filtered():
    try:
        # Параметры запроса
        params = {}
        
        # Собираем параметры из запроса
        type_filter = request.args.get('type')
        status_filter = request.args.get('status')
        rating_filter = request.args.get('rating')
        genres_filter = request.args.get('genres')
        min_year = request.args.get('min_year')
        max_year = request.args.get('max_year')
        limit = int(request.args.get('limit', 20))
        
        # SFW/NSFW обработка
        sfw_param = request.args.get('sfw', 'true')
        
        # Строим query string для Jikan API
        query_parts = []
        
        if type_filter:
            query_parts.append(f'type={type_filter}')
        if status_filter:
            query_parts.append(f'status={status_filter}')
        if rating_filter:
            # Jikan использует рейтинг как есть
            query_parts.append(f'rating={rating_filter}')
        
        # Жанры - Jikan API принимает genre_ids как параметр
        if genres_filter:
            # genres_filter это строка типа "1,2,3"
            query_parts.append(f'genres={genres_filter}')
        
        # Годы - используем start_date и end_date
        if min_year:
            query_parts.append(f'start_date={min_year}-01-01')
        if max_year:
            query_parts.append(f'end_date={max_year}-12-31')
        
        # SFW параметр
        if sfw_param == 'true':
            query_parts.append('sfw=true')
        
        # Лимит и страница
        query_parts.append(f'limit={min(limit, 25)}')
        
        # Выбираем случайную страницу (Jikan имеет примерно 20 страниц с 25 элементами)
        random_page = random.randint(1, 20)
        query_parts.append(f'page={random_page}')
        
        # Случайный порядок сортировки для разнообразия
        order_options = ['title', 'score', 'popularity', 'favorites', 'scored_by', 'rank']
        sort_options = ['asc', 'desc']
        
        query_parts.append(f'order_by={random.choice(order_options)}')
        query_parts.append(f'sort={random.choice(sort_options)}')
        
        # Формируем URL
        query_string = '&'.join(query_parts)
        url = f"{JIKAN_BASE}/anime?{query_string}"
        
        print(f"Запрос к Jikan: {url}")  # Для отладки
        
        resp = rate_limited_get(url)
        
        if resp is None or resp.status_code != 200:
            return jsonify({'error': 'Jikan API временно недоступен'}), 503
            
        json_data = resp.json()
        anime_list = json_data.get('data', [])
        
        if not anime_list:
            return jsonify({'total': 0, 'data': []})
        
        # Перемешиваем и ограничиваем количество
        random.shuffle(anime_list)
        selected = anime_list[:limit]
        
        # Форматируем результат
        result = []
        for a in selected:
            # Получаем жанры
            genres = []
            if 'genres' in a:
                genres = [genre['name'] for genre in a['genres']]
            if 'explicit_genres' in a:
                genres.extend([genre['name'] for genre in a['explicit_genres']])
            
            # Дата выхода
            start_date = a.get('aired', {}).get('from')
            year = None
            if start_date:
                try:
                    year = int(start_date[:4]) if start_date else None
                except:
                    year = None
            
            result.append({
                'mal_id': a['mal_id'],
                'title': a.get('title_english') or a['title'] or 'Без названия',
                'image': a['images']['jpg'].get('large_image_url') or a['images']['jpg'].get('image_url') or '',
                'score': a.get('score') or 0,
                'popularity': a.get('popularity') or 0,
                'members': a.get('members') or 0,
                'favorites': a.get('favorites') or 0,
                'start_date': start_date,
                'year': year or a.get('year') or '—',
                'type': a.get('type', 'TV'),
                'episodes': a.get('episodes') or '?',
                'synopsis': (a.get('synopsis') or 'Нет описания')[:250] + '...',
                'genres': genres[:5]
            })
        
        # Получаем общее количество (делаем упрощенный запрос)
        count_url = f"{JIKAN_BASE}/anime?{query_string.split('&page=')[0]}"
        count_resp = rate_limited_get(count_url)
        
        total = len(result)  # По умолчанию
        if count_resp and count_resp.status_code == 200:
            count_data = count_resp.json()
            pagination = count_data.get('pagination', {})
            if 'items' in pagination and 'total' in pagination['items']:
                total = pagination['items']['total']
            elif 'last_visible_page' in pagination:
                total = pagination['last_visible_page'] * 25  # Приблизительно
        
        return jsonify({
            'total': total,
            'data': result
        })

    except Exception as e:
        app.logger.error(f"Error in random_anime_filtered: {str(e)}")
        return jsonify({'error': f'Произошла ошибка: {str(e)}'}), 500
    
@app.route('/api/set_nsfw', methods=['POST'])
@login_required
def set_nsfw():
    data = request.get_json()
    current_user.nsfw_allowed = bool(data.get('nsfw', False))
    db.session.commit()
    return jsonify({'success': True})

@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    if request.method == 'POST':
        # Сохраняем настройки
        current_user.nsfw_allowed = bool(request.form.get('nsfw_allowed'))
        current_user.private_account = bool(request.form.get('private_account'))
        current_user.tag = request.form.get('tag', '')
        db.session.commit()
        flash("Настройки сохранены!", "success")
        return redirect(url_for('settings'))

    return render_template('settings.html', user=current_user)

@app.route('/my-list')
@login_required
def my_list():
    items = UserAnime.query.filter_by(user_id=current_user.id).all()

    anime_list = []
    for item in items:
        anime_list.append({
            'id': item.id,
            'mal_id': item.mal_id,
            'title': item.title,
            'image': item.image,
            'type': item.type,
            'episodes': item.episodes,
            'year': item.year,
            'synopsis': item.synopsis,
            'status': item.status,
            'score': item.score,
            'comment': item.comment,
            'is_private': item.is_private
        })

    return render_template('my_list.html', anime_list=anime_list)

@app.route('/api/add_to_list', methods=['POST'])
@login_required
def add_to_list():
    data = request.get_json()
    mal_id = data.get('mal_id')

    if not mal_id:
        return jsonify({'error': 'mal_id is required'}), 400

    # Проверка — уже есть в списке?
    exists = UserAnime.query.filter_by(
        user_id=current_user.id,
        mal_id=mal_id
    ).first()

    if exists:
        return jsonify({'message': 'already_added'}), 200

    anime = UserAnime(
        user_id=current_user.id,
        mal_id=mal_id,
        status='planned'
    )

    db.session.add(anime)
    db.session.commit()

    return jsonify({'success': True})

@app.route('/api/delete_from_list', methods=['POST'])
@login_required
def delete_from_list():
    data = request.get_json()
    anime_id = data.get('id')

    anime = UserAnime.query.filter_by(
        id=anime_id,
        user_id=current_user.id
    ).first_or_404()

    db.session.delete(anime)
    db.session.commit()

    return jsonify({'success': True})

@app.route('/api/update_status', methods=['POST'])
@login_required
def update_status():
    data = request.get_json()
    print("DATA:", data)
    anime_id = data.get('id')
    status = data.get('status')
    anime = UserAnime.query.filter_by(id=anime_id, user_id=current_user.id).first()
    if not anime:
        return jsonify({'success': False, 'error': 'Anime not found'}), 404
    anime.status = status
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/update_score', methods=['POST'])
@login_required
def update_score():
    data = request.get_json()
    anime_id = data.get('id')
    score = data.get('score')

    anime = UserAnime.query.filter_by(
        id=anime_id,
        user_id=current_user.id
    ).first_or_404()

    anime.score = score if score else None
    db.session.commit()

    return jsonify({'success': True})

@app.route('/api/toggle_list', methods=['POST'])
@login_required
def toggle_list():
    data = request.get_json()
    mal_id = data.get('mal_id')

    anime = UserAnime.query.filter_by(
        user_id=current_user.id,
        mal_id=mal_id
    ).first()

    if anime:
        db.session.delete(anime)
        db.session.commit()
        return jsonify({'status': 'removed'})

    anime = UserAnime(
        user_id=current_user.id,
        mal_id=mal_id,
        title=data.get('title'),
        image=data.get('image'),
        type=data.get('type'),
        episodes=data.get('episodes'),
        year=data.get('year'),
        synopsis=data.get('synopsis'),
        status='planned'
    )

    db.session.add(anime)
    db.session.commit()
    return jsonify({'status': 'added'})

@app.route('/api/update_private', methods=['POST'])
@login_required
def update_private():
    data = request.get_json()
    anime_id = data.get('id')
    is_private = bool(data.get('is_private'))

    anime = UserAnime.query.filter_by(id=anime_id, user_id=current_user.id).first_or_404()
    anime.is_private = is_private
    db.session.commit()

    return jsonify({'success': True})

@app.route('/api/update_comment', methods=['POST'])
@login_required
def update_comment():
    data = request.get_json()
    anime_id = data.get('id')
    comment = data.get('comment', '').strip()

    anime = UserAnime.query.filter_by(
        id=anime_id,
        user_id=current_user.id
    ).first_or_404()

    anime.comment = comment
    db.session.commit()

    return jsonify({'success': True})

# --- Обработчики ошибок ---
@app.errorhandler(400)
def bad_request(error):
    return render_template('400.html'), 400

@app.errorhandler(401)
def unauthorized(error):
    return render_template('401.html'), 401

@app.errorhandler(403)
def forbidden(error):
    return render_template('403.html'), 403

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(429)
def too_many_requests(error):
    return render_template('429.html'), 429

@app.errorhandler(500)
def internal_server_error(error):
    return render_template('500.html'), 500

@app.errorhandler(502)
def bad_gateway(error):
    return render_template('502.html'), 502

@app.errorhandler(503)
def service_unavailable(error):
    return render_template('503.html'), 503

@app.errorhandler(504)
def gateway_timeout(error):
    return render_template('504.html'), 504

# /* =========================================
#    TEST ERRORING ROUTES
#    ========================================= */

# Тестовые маршруты для проверки страниц ошибок (только в режиме отладки)
if app.config.get('DEBUG'):
    @app.route('/test/400')
    def test_400():
        from werkzeug.exceptions import BadRequest
        raise BadRequest()
    
    @app.route('/test/401')
    def test_401():
        from werkzeug.exceptions import Unauthorized
        raise Unauthorized()
    
    @app.route('/test/403')
    def test_403():
        from werkzeug.exceptions import Forbidden
        raise Forbidden()
    
    @app.route('/test/404')
    def test_404():
        from werkzeug.exceptions import NotFound
        raise NotFound()
    
    @app.route('/test/429')
    def test_429():
        from werkzeug.exceptions import TooManyRequests
        raise TooManyRequests()
    
    @app.route('/test/500')
    def test_500():
        # Искусственно вызываем ошибку 500
        1 / 0
    
    @app.route('/test/502')
    def test_502():
        from werkzeug.exceptions import BadGateway
        raise BadGateway()
    
    @app.route('/test/503')
    def test_503():
        from werkzeug.exceptions import ServiceUnavailable
        raise ServiceUnavailable()
    
    @app.route('/test/504')
    def test_504():
        from werkzeug.exceptions import GatewayTimeout
        raise GatewayTimeout()
    
    @app.route('/test/errors')
    def test_errors():
        return render_template('test_errors.html')
    
# /* =========================================
#    TEST ERRORING ROUTES
#    ========================================= */

# Добавляем эти маршруты после существующих

@app.route('/search')
def search_page():
    return render_template('search.html')

@app.route('/random')
def random_page():
    return render_template('random.html')

# ===== НОВЫЕ ЭНДПОИНТЫ ДЛЯ РЕЙТИНГОВ =====

@app.route('/api/top_anime')
def top_anime():
    """Строго по рейтингу (MAL score)"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 12)), 25)
    sfw_param = request.args.get('sfw', 'true')
    
    params = {
        'page': page,
        'limit': limit
    }
    if sfw_param == 'true':
        params['sfw'] = 'true'
    
    resp = rate_limited_get(f"{JIKAN_BASE}/top/anime", params)
    return process_search_response(resp)

@app.route('/api/popular_anime')
def popular_anime():
    """Строго по популярности (MAL ranking)"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 12)), 25)
    sfw_param = request.args.get('sfw', 'true')
    
    params = {
        'page': page,
        'limit': limit,
        'filter': 'bypopularity'
    }
    if sfw_param == 'true':
        params['sfw'] = 'true'
    
    resp = rate_limited_get(f"{JIKAN_BASE}/top/anime", params)
    return process_search_response(resp)

@app.route('/api/airing_anime')
def airing_anime():
    """Строго новинки (выходящие сейчас)"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 12)), 25)
    sfw_param = request.args.get('sfw', 'true')
    
    params = {
        'page': page,
        'limit': limit,
        'filter': 'airing'
    }
    if sfw_param == 'true':
        params['sfw'] = 'true'
    
    resp = rate_limited_get(f"{JIKAN_BASE}/top/anime", params)
    return process_search_response(resp)

@app.route('/api/classic_anime')
def classic_anime():
    """Классика (до 2000 года с высоким рейтингом)"""
    page = int(request.args.get('page', 1))
    limit = min(int(request.args.get('limit', 12)), 25)
    sfw_param = request.args.get('sfw', 'true')
    
    # Фильтруем по дате и сортируем по рейтингу
    params = {
        'page': page,
        'limit': limit,
        'order_by': 'score',
        'sort': 'desc',
        'end_date': '2000-12-31',
        'min_score': 7.0
    }
    if sfw_param == 'true':
        params['sfw'] = 'true'
    
    resp = rate_limited_get(f"{JIKAN_BASE}/anime", params)
    return process_search_response(resp)

@app.route('/api/genres')
def get_genres():
    """Получить список всех жанров"""
    try:
        # Получаем жанры из Jikan API
        resp = rate_limited_get(f"{JIKAN_BASE}/genres/anime")
        if resp and resp.status_code == 200:
            data = resp.json()
            genres = data.get('data', [])
            return jsonify({'genres': genres})
        else:
            # Fallback список жанров
            genres = [
                {'mal_id': 1, 'name': 'Action'},
                {'mal_id': 2, 'name': 'Adventure'},
                {'mal_id': 4, 'name': 'Comedy'},
                {'mal_id': 8, 'name': 'Drama'},
                {'mal_id': 10, 'name': 'Fantasy'},
                {'mal_id': 14, 'name': 'Horror'},
                {'mal_id': 7, 'name': 'Mystery'},
                {'mal_id': 22, 'name': 'Romance'},
                {'mal_id': 24, 'name': 'Sci-Fi'},
                {'mal_id': 36, 'name': 'Slice of Life'},
                {'mal_id': 30, 'name': 'Sports'},
                {'mal_id': 37, 'name': 'Supernatural'},
                {'mal_id': 41, 'name': 'Suspense'},
                {'mal_id': 9, 'name': 'Ecchi'},
                {'mal_id': 12, 'name': 'Hentai'},
                {'mal_id': 27, 'name': 'Shounen'},
                {'mal_id': 25, 'name': 'Shoujo'},
                {'mal_id': 42, 'name': 'Seinen'},
                {'mal_id': 43, 'name': 'Josei'},
                {'mal_id': 5, 'name': 'Avant Garde'},
                {'mal_id': 28, 'name': 'Boys Love'},
                {'mal_id': 26, 'name': 'Girls Love'},
                {'mal_id': 3, 'name': 'Racing'},
                {'mal_id': 6, 'name': 'Mythology'},
                {'mal_id': 13, 'name': 'Historical'},
                {'mal_id': 15, 'name': 'Kids'},
                {'mal_id': 16, 'name': 'Martial Arts'},
                {'mal_id': 17, 'name': 'Mecha'},
                {'mal_id': 18, 'name': 'Music'},
                {'mal_id': 19, 'name': 'Parody'},
                {'mal_id': 20, 'name': 'Samurai'},
                {'mal_id': 21, 'name': 'School'},
                {'mal_id': 23, 'name': 'Space'},
                {'mal_id': 29, 'name': 'Super Power'},
                {'mal_id': 31, 'name': 'Vampire'},
                {'mal_id': 32, 'name': 'Yaoi'},
                {'mal_id': 33, 'name': 'Yuri'},
                {'mal_id': 34, 'name': 'Harem'},
                {'mal_id': 35, 'name': 'Slice of Life'},
                {'mal_id': 38, 'name': 'Military'},
                {'mal_id': 39, 'name': 'Police'},
                {'mal_id': 40, 'name': 'Psychological'},
                {'mal_id': 44, 'name': 'Award Winning'},
                {'mal_id': 45, 'name': 'Gourmet'},
                {'mal_id': 46, 'name': 'Work Life'},
                {'mal_id': 47, 'name': 'Erotica'},
            ]
            return jsonify({'genres': genres})
    except Exception as e:
        app.logger.error(f"Error getting genres: {str(e)}")
        # Возвращаем базовый список в случае ошибки
        genres = [
            {'mal_id': 1, 'name': 'Action'},
            {'mal_id': 4, 'name': 'Comedy'},
            {'mal_id': 8, 'name': 'Drama'},
            {'mal_id': 10, 'name': 'Fantasy'},
            {'mal_id': 22, 'name': 'Romance'},
            {'mal_id': 24, 'name': 'Sci-Fi'},
        ]
        return jsonify({'genres': genres})

@app.route('/api/my_anime_ids')
@login_required
def my_anime_ids():
    """Получить список anime_id, которые уже есть у пользователя"""
    try:
        # Получаем все записи пользователя из UserAnime
        user_anime = UserAnime.query.filter_by(user_id=current_user.id).all()
        
        # Собираем только mal_id
        ids = [anime.mal_id for anime in user_anime]
        
        return jsonify({
            'success': True,
            'ids': ids
        })
    except Exception as e:
        app.logger.error(f"Error in my_anime_ids: {str(e)}")
        return jsonify({'error': 'Ошибка получения списка аниме'}), 500
    
from urllib.parse import quote_plus

@app.route('/api/anime/<int:mal_id>')
def get_anime_details(mal_id):
    try:
        url = f"{JIKAN_BASE}/anime/{mal_id}/full"
        resp = rate_limited_get(url)
        
        if resp is None or resp.status_code != 200:
            return jsonify({"error": "Не удалось загрузить данные"}), 503
            
        data = resp.json()["data"]
        
        # Основные поля
        title_ru   = data.get("title_russian") or data["title"]
        title_en   = data.get("title_english") or data["title"]
        title_jp   = data["title_japanese"] or data["title"]
        title_main = title_ru or title_en or title_jp
        
        synopsis = (data.get("synopsis") or "Описание отсутствует").replace("[Written by MAL Rewrite]", "").strip()
        
        image = (
            data["images"]["jpg"].get("large_image_url") or
            data["images"]["jpg"].get("image_url") or
            ""
        )
        
        year = data.get("year") or (
            data.get("aired", {}).get("from", "")[:4] if data.get("aired", {}).get("from") else "—"
        )
        
        # Проверяем, хентай ли это
        genres = [g['name'].lower() for g in data.get('genres', []) + data.get('explicit_genres', [])]
        is_hentai = 'hentai' in genres or 'erotica' in genres
        
        # Поисковая строка для сайтов
        q = quote_plus(title_main)
        
        # Формируем СПИСОК ссылок в нужном порядке
        links_list = []
        
        # 1. MyAnimeList — всегда первая
        links_list.append({
            "url": f"https://myanimelist.net/anime/{mal_id}",
            "label": "MyAnimeList"
        })
        
        # 2. AnimeGo — если не хентай
        if not is_hentai:
            links_list.append({
                "url": f"https://animego.org/search/anime?q={q}",
                "label": "AnimeGo (поиск)"
            })
        
        # 3. AnimeLIB — если не хентай
        if not is_hentai:
            links_list.append({
                "url": f"https://anilib.me/ru/catalog?q={q}",
                "label": "AnimeLIB (поиск)"
            })
        
        # 4. HDRezka — если не хентай
        if not is_hentai:
            links_list.append({
                "url": f"https://hdrezka.ag/search/?do=search&subaction=search&q={q}",
                "label": "HDRezka (поиск)"
            })
        
        # 5. Shikimori — всегда последняя
        shiki_label = "Shikimori (поиск)" if not is_hentai else "Shikimori (поиск, требуется регистрация)"
        links_list.append({
            "url": f"https://shikimori.one/animes?search={q}",
            "label": shiki_label
        })

        # 6. watchhentai.net — ТОЛЬКО для хентая
        # 6. watchhentai.net — ТОЛЬКО для хентая
        if is_hentai:
            # Поиск по основному названию (title_main)
            links_list.append({
                "url": f"https://watchhentai.net/?s={q}",
                "label": "WatchHentai (поиск)"
            })

            # Дополнительная ссылка — поиск по английскому названию (title_en)
            if title_en and title_en != title_main:
                q_en = quote_plus(title_en)
                links_list.append({
                    "url": f"https://watchhentai.net/?s={q_en}",
                    "label": "WatchHentai (поиск EN)"
                })
        
        return jsonify({
            "mal_id":     mal_id,
            "title":      title_main,
            "title_en":   title_en,
            "title_jp":   title_jp,
            "title_ru":   title_ru,
            "image":      image,
            "score":      data.get("score") or "—",
            "year":       year,
            "episodes":   data.get("episodes") or "—",
            "type":       data.get("type", "—"),
            "status":     data.get("status", "—"),
            "synopsis":   synopsis,
            "links":      links_list   # ← возвращаем именно список!
        })
        
    except Exception as e:
        app.logger.error(f"Error in /api/anime/{mal_id}: {str(e)}")
        return jsonify({"error": "Внутренняя ошибка сервера"}), 500

if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'])