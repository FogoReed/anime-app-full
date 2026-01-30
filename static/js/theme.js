// theme.js - Управление темой сайта
(function() {
    'use strict';
    
    // Устанавливаем тему СРАЗУ
    function initializeTheme() {
        // Проверяем сохраненную тему
        const savedTheme = localStorage.getItem('theme');
        let theme;
        
        if (savedTheme) {
            theme = savedTheme;
        } else {
            // Используем системную тему
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            theme = prefersDark ? 'dark' : 'light';
        }
        
        // Устанавливаем тему на html элемент
        document.documentElement.setAttribute('data-theme', theme);
        
        // Обновляем иконку переключателя темы
        updateThemeIcon(theme);
        
        console.log('Тема установлена:', theme);
        return theme;
    }
    
    // Обновление иконки темы
    function updateThemeIcon(theme) {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
        }
    }
    
    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (!currentTheme) {
            initializeTheme();
        } else {
            updateThemeIcon(currentTheme);
        }
        
        // Обработчик переключения темы
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', function() {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                // Мгновенно меняем тему
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                updateThemeIcon(newTheme);
                
                console.log('Тема изменена на:', newTheme);
            });
        }
    });
    
    // Также запускаем инициализацию сразу для ранней установки темы
    // Это сработает если атрибут data-theme еще не установлен
    if (!document.documentElement.hasAttribute('data-theme')) {
        initializeTheme();
    }
})();