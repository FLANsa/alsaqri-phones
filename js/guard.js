/**
 * Page Access Guard System
 * Controls access to pages based on user roles
 */

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
 * Initialize page access control
 */
function initPageGuard() {
    // Get required role from meta tag
    const metaRole = document.querySelector('meta[name="requires-role"]');
    const requiredRole = metaRole ? metaRole.getAttribute('content') : 'guest';
    
    console.log('🔒 Page Guard Debug:');
    console.log('- Required role:', requiredRole);
    console.log('- Current role:', getCurrentRole());
    console.log('- Has access:', hasAccess(requiredRole));
    
    // Check if user has access
    if (!hasAccess(requiredRole)) {
        console.log('❌ Access denied - redirecting...');
        redirectToDashboard();
        return;
    }
    
    console.log('✅ Access granted');
}

// Initialize guard when DOM is loaded
document.addEventListener('DOMContentLoaded', initPageGuard);

// Also run immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageGuard);
} else {
    initPageGuard();
}
