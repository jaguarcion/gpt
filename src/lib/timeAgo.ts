const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 2592000;

export function timeAgo(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);

    if (diff < 10) return 'только что';
    if (diff < MINUTE) return `${diff} сек назад`;
    if (diff < HOUR) {
        const m = Math.floor(diff / MINUTE);
        return `${m} мин назад`;
    }
    if (diff < DAY) {
        const h = Math.floor(diff / HOUR);
        return `${h} ч назад`;
    }
    if (diff < WEEK) {
        const days = Math.floor(diff / DAY);
        if (days === 1) return 'вчера';
        return `${days} дн назад`;
    }
    if (diff < MONTH) {
        const w = Math.floor(diff / WEEK);
        return `${w} нед назад`;
    }

    return d.toLocaleDateString('ru-RU');
}

export function fullDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
