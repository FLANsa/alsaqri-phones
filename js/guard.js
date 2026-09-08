/**
 * Page Access Guard System
 * Controls access to pages based on Firebase Auth session + roles
 *
 * الحماية الحقيقية = جلسة Firebase فعلياً (وليس localStorage).
 * localStorage (current_user) يُستخدم لدور الواجهة فقط (القائمة والتمييز).
 */

// بريدا الحسابين الوحيدين المسموح لهما
var GUARD_ADMIN_EMAIL = 'admin@alsaqri.store';
var GUARD_USER_EMAIL = 'user@alsaqri.store';

/**
 * Get current user role from localStorage
 * @returns {string} 'admin' | 'user' | 'guest'
 */
function getCurrentRole() {
    try {
        const user = JSON.parse(localStorage.getItem('current_user') || 'null');
        if (!user) return 'guest';
        // Check both is_admin and role fields for compatibility
        if (user.is_admin === true || user.role === 'admin') {
            return 'admin';
        }
        return 'user';
    } catch (error) {
        console.error('Error getting user role:', error);
        return 'guest';
    }
}

/**
 * Derive UI role from the Firebase session email and store it.
 * @param {object} fbUser - Firebase user
 */
function syncRoleFromSession(fbUser) {
    const email = (fbUser && fbUser.email ? fbUser.email : '').toLowerCase();
    const role = email === GUARD_ADMIN_EMAIL ? 'admin' : 'user';
    const sessionData = {
        username: email.split('@')[0],
        name: role === 'admin' ? 'مدير النظام' : 'موظف المبيعات',
        role: role,
        uid: fbUser ? fbUser.uid : null,
        loginTime: new Date().toISOString()
    };
    localStorage.setItem('current_user', JSON.stringify(sessionData));
    return sessionData;
}

/**
 * Check if user has required role for current page
 * @param {string} requiredRole - Required role ('admin', 'user', or 'guest')
 * @returns {boolean} True if user has access
 */
function hasAccess(requiredRole) {
    const currentRole = getCurrentRole();

    // Admin has access to everything
    if (currentRole === 'admin') return true;

    // User has access to user and guest pages
    if (currentRole === 'user' && (requiredRole === 'user' || requiredRole === 'guest')) return true;

    // Guest only has access to guest pages
    if (currentRole === 'guest' && requiredRole === 'guest') return true;

    return false;
}

/**
 * Redirect user to appropriate dashboard based on role
 */
function redirectToDashboard() {
    const role = getCurrentRole();

    if (role === 'admin') {
        window.location.href = 'dashboard.html';
    } else if (role === 'user') {
        window.location.href = 'limited_dashboard.html';
    } else {
        window.location.href = 'login.html';
    }
}

/**
 * Wait until the Firebase config module has loaded (window.firebaseAuth set)
 */
function waitForFirebaseAuth(callback, maxTries) {
    if (window.firebaseAuth) {
        callback(window.firebaseAuth);
        return;
    }
    if (maxTries <= 0) {
        // فشل تحميل Firebase (شبكة/CDN) — لا نحوّل لتجنب حلقة؛ الصفحة لن تعمل أصلاً
        console.error('⛔ guard.js: Firebase لم يُحمَّل — تعذر التحقق من الجلسة');
        return;
    }
    setTimeout(function () { waitForFirebaseAuth(callback, maxTries - 1); }, 100);
}

/**
 * Initialize page access control
 */
function initPageGuard() {
    // Get required role from meta tag (default: any signed-in user)
    const metaRole = document.querySelector('meta[name="requires-role"]');
    const requiredRole = metaRole ? metaRole.getAttribute('content') : 'user';

    waitForFirebaseAuth(function (auth) {
        // onAuthStateChanged: متاح كدالة instance في modular SDK
        auth.onAuthStateChanged(function (fbUser) {
            if (!fbUser) {
                // لا جلسة Firebase = خروج/متصفح جديد — نمسح بقايا localStorage القديمة
                localStorage.removeItem('current_user');
                window.location.href = 'login.html';
                return;
            }

            // دور الواجهة يشتق دائماً من جلسة Firebase الحالية، لا من قيمة محلية قديمة.
            syncRoleFromSession(fbUser);

            // Check if user has access
            if (!hasAccess(requiredRole)) {
                redirectToDashboard();
                return;
            }
        });
    }, 80);
}

// Initialize guard when DOM is loaded (exactly once)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageGuard);
} else {
    initPageGuard();
}
