/**
 * Navigation Helper - Easy Application Script
 * Phone Store Demo - Apply dynamic navigation to any page
 */

/**
 * Apply dynamic navigation to a page
 * @param {string} pageName - Page identifier for active state
 */
function applyDynamicNavigation(pageName = '') {
    // Find the navigation container
    const navbar = document.querySelector('.navbar-nav.me-auto');
    
    if (navbar) {
        // Replace hardcoded navigation with dynamic one
        navbar.innerHTML = '<!-- Navigation will be populated by navigation.js -->';
        
        // Add navigation script if not already present
        if (!document.querySelector('script[src="js/navigation.js"]')) {
            const script = document.createElement('script');
            script.src = 'js/navigation.js';
            document.head.appendChild(script);
            
            // Initialize navigation when script loads
            script.onload = function() {
                if (typeof initNavigation === 'function') {
                    initNavigation(pageName);
                }
            };
        } else {
            // Script already exists, just initialize
            if (typeof initNavigation === 'function') {
                initNavigation(pageName);
            }
        }
    }
}

// Make function available globally
window.applyDynamicNavigation = applyDynamicNavigation;
