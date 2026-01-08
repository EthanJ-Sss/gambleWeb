/**
 * Shared Utility Functions
 */

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format profit with sign and color class
function formatProfit(profit) {
    if (profit > 0) {
        return `<span class="positive">+${formatNumber(profit)}</span>`;
    } else if (profit < 0) {
        return `<span class="negative">${formatNumber(profit)}</span>`;
    }
    return `<span>±0</span>`;
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Get rank medal
function getRankMedal(rank) {
    switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '';
    }
}

// Get status text in Chinese
function getStatusText(status) {
    const statusMap = {
        'online': '在线',
        'offline': '离线',
        'left': '已退出',
        'idle': '空闲',
        'betting': '下注中',
        'locked': '已封盘',
        'settling': '结算中',
        'open': '接受下注',
        'created': '已创建',
        'settled': '已结算',
        'active': '活跃',
        'closed': '已关闭'
    };
    return statusMap[status] || status;
}

// Calculate progress percentage
function calculateProgress(current, total) {
    if (total === 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Store data in localStorage
function storeLocal(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Failed to store in localStorage:', e);
    }
}

// Get data from localStorage
function getLocal(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
        console.error('Failed to get from localStorage:', e);
        return defaultValue;
    }
}
