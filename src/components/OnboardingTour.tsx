import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLocation } from 'react-router-dom';

export function OnboardingTour() {
    const location = useLocation();

    useEffect(() => {
        // Only run on dashboard
        if (location.pathname !== '/admin') return;

        const hasSeenTour = localStorage.getItem('hasSeenTour');
        if (hasSeenTour) return;

        const driverObj = driver({
            showProgress: true,
            steps: [
                {
                    element: 'h1',
                    popover: {
                        title: 'Добро пожаловать!',
                        description: 'Это новая админ-панель для управления подписками GPT. Давайте быстро пробежимся по функционалу.'
                    }
                },
                {
                    element: '[data-tour="kpis"]',
                    popover: {
                        title: 'Ключевые показатели',
                        description: 'Здесь отображается статистика в реальном времени: ключи, подписки, SLA и ошибки.'
                    }
                },
                {
                    element: '[data-tour="quicklinks"]',
                    popover: {
                        title: 'Быстрые ссылки',
                        description: 'Быстрый доступ к управлению ключами, пользователями и статистике.'
                    }
                },
                {
                    element: '[data-tour="activity"]',
                    popover: {
                        title: 'Лента активности',
                        description: 'Последние действия системы и пользователей.'
                    }
                },
                {
                    element: '[data-tour="search-btn"]',
                    popover: {
                        title: 'Глобальный поиск',
                        description: 'Нажмите Cmd+K (или эту кнопку), чтобы найти подписку, ключ или лог.'
                    }
                },
                {
                    element: '[data-tour="theme-toggle"]',
                    popover: {
                        title: 'Тема оформления',
                        description: 'Переключение между светлой и тёмной темой.',
                        side: 'left'
                    }
                }
            ],
            onDestroyStarted: () => {
                if (!driverObj.hasNextStep() || confirm('Завершить тур?')) {
                    driverObj.destroy();
                    localStorage.setItem('hasSeenTour', 'true');
                }
            },
        });

        // Small delay to ensure render
        setTimeout(() => {
            driverObj.drive();
        }, 1000);

    }, [location.pathname]);

    return null;
}
