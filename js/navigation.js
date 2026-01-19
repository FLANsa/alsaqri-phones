/**
 * Dynamic Navigation System
 * Phone Store Demo - Centralized navigation management
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
 * Generate navigation HTML based on user role
 * @param {string} role - User role
 * @param {string} currentPage - Current page name for active state
 * @returns {string} Navigation HTML
 */
function generateNavigation(role, currentPage = '') {
    if (role === 'guest') {
        return `
            <li class="nav-item">
                <a class="nav-link" href="login.html">تسجيل الدخول</a>
            </li>
        `;
    }

    // For regular users - الرئيسية, أعمال الصيانة, and تسجيل الخروج
    if (role === 'user') {
        return `
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'dashboard' ? 'active' : ''}" href="limited_dashboard.html">
                    <i class="fas fa-home"></i> الرئيسية
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'maintenance-jobs' ? 'active' : ''}" href="maintenance-jobs.html">
                    <i class="fas fa-wrench"></i> أعمال الصيانة
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="#" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> تسجيل الخروج
                </a>
            </li>
        `;
    }

    // For admin users - Exact structure as requested
    if (role === 'admin') {
        return `
            <li class="nav-item">
                <a class="nav-link ${currentPage === 'dashboard' ? 'active' : ''}" href="dashboard.html"><i class="fas fa-tachometer-alt"></i> لوحة التحكم</a>
            </li>

            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle ${currentPage.includes('inventory') || currentPage.includes('accessory') || currentPage === 'search' ? 'active' : ''}" href="#" id="inventoryDropdown" role="button" data-bs-toggle="dropdown">
                    <i class="fas fa-boxes"></i> إدارة المخزون
                </a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item ${currentPage === 'inventory_summary' ? 'active' : ''}" href="inventory_summary.html"><i class="fas fa-chart-bar"></i> ملخص المخزون</a></li>
                    <li><a class="dropdown-item ${currentPage === 'search' ? 'active' : ''}" href="search.html"><i class="fas fa-search"></i> البحث في المخزون</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item ${currentPage === 'add_accessory' ? 'active' : ''}" href="add_accessory.html"><i class="fas fa-plus"></i> إضافة أكسسوار</a></li>
                    <li><a class="dropdown-item ${currentPage === 'list_accessories' ? 'active' : ''}" href="list_accessories_simple.html"><i class="fas fa-box"></i> مخزون الأكسسوارات</a></li>
                </ul>
            </li>

            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle ${currentPage.includes('sale') ? 'active' : ''}" href="#" id="salesDropdown" role="button" data-bs-toggle="dropdown">
                    <i class="fas fa-shopping-cart"></i> إدارة المبيعات
                </a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item ${currentPage === 'list_sales' ? 'active' : ''}" href="list_sales.html"><i class="fas fa-list"></i> قائمة المبيعات</a></li>
                    <li><a class="dropdown-item ${currentPage === 'create_sale' ? 'active' : ''}" href="create_sale.html"><i class="fas fa-plus-circle"></i> إنشاء عملية بيع جديدة</a></li>
                </ul>
            </li>

            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle ${currentPage.includes('phone') ? 'active' : ''}" href="#" id="phoneDropdown" role="button" data-bs-toggle="dropdown">
                    <i class="fas fa-mobile-alt"></i> إدارة الهواتف
                </a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item ${currentPage === 'add_new_phone' ? 'active' : ''}" href="add_new_phone.html"><i class="fas fa-mobile"></i> هاتف جديد</a></li>
                    <li><a class="dropdown-item ${currentPage === 'add_used_phone' ? 'active' : ''}" href="add_used_phone.html"><i class="fas fa-mobile-alt"></i> هاتف مستعمل</a></li>
                </ul>
            </li>

            <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle ${currentPage.includes('maintenance') ? 'active' : ''}" href="#" id="maintenanceDropdown" role="button" data-bs-toggle="dropdown">
                    <i class="fas fa-tools"></i> إدارة الصيانة
                </a>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item ${currentPage === 'maintenance' ? 'active' : ''}" href="maintenance.html"><i class="fas fa-home"></i> الرئيسية</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item ${currentPage === 'maintenance-reps' ? 'active' : ''}" href="maintenance-reps.html"><i class="fas fa-users"></i> المندوبين</a></li>
                    <li><a class="dropdown-item ${currentPage === 'maintenance-technicians' ? 'active' : ''}" href="maintenance-technicians.html"><i class="fas fa-hard-hat"></i> الفنيين</a></li>
                    <li><a class="dropdown-item ${currentPage === 'maintenance-jobs' ? 'active' : ''}" href="maintenance-jobs.html"><i class="fas fa-wrench"></i> أعمال الصيانة</a></li>
                    <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item ${currentPage === 'maintenance-accounts' ? 'active' : ''}" href="maintenance-accounts.html"><i class="fas fa-credit-card"></i> الحسابات</a></li>
                </ul>
            </li>

            <li class="nav-item">
                <a class="nav-link" href="#" onclick="logout()"><i class="fas fa-sign-out-alt"></i> تسجيل الخروج</a>
            </li>
        `;
    }

    return '';
}

/**
 * Initialize navigation for a page
 * @param {string} currentPage - Current page identifier
 */
function initNavigation(currentPage = '') {
    const role = getCurrentRole();
    console.log('🔍 Navigation Debug:');
    console.log('- Current role:', role);
    console.log('- Current page:', currentPage);
    console.log('- User data:', localStorage.getItem('current_user'));
    
    const navbar = document.querySelector('.navbar-nav.me-auto');
    console.log('- Navbar element found:', !!navbar);
    
    if (navbar) {
        const navigationHTML = generateNavigation(role, currentPage);
        console.log('- Generated HTML:', navigationHTML);
        navbar.innerHTML = navigationHTML;
        console.log('✅ Navigation updated successfully');
    } else {
        console.error('❌ Navbar element not found!');
    }
}

/**
 * Logout function
 */
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('current_user');
        alert('تم تسجيل الخروج');
        window.location.href = 'login.html';
    }
}

// Make functions available globally
window.initNavigation = initNavigation;
window.logout = logout;
