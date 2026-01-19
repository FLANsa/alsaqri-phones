/**
 * Authentication Module
 * الصقري للاتصالات - Phone Store Management System
 */

class AuthManager {
    constructor() {
        this.storage = storage;
        this.defaultUsers = [
            {
                id: 'admin',
                username: 'admin',
                password: 'admin123', // In real app, this should be hashed
                is_admin: true,
                full_name: 'مدير النظام',
                email: 'admin@aldhahbi.com',
                created_at: new Date().toISOString()
            },
            {
                id: 'user1',
                username: 'user',
                password: 'user123',
                is_admin: false,
                full_name: 'موظف المبيعات',
                email: 'user@aldhahbi.com',
                created_at: new Date().toISOString()
            }
        ];
        this.initializeUsers();
    }

    /**
     * Initialize default users if they don't exist
     */
    initializeUsers() {
        const existingUsers = this.getUsers();
        if (existingUsers.length === 0) {
            this.setUsers(this.defaultUsers);
        }
    }

    /**
     * Get all users
     * @returns {Array} Array of users
     */
    getUsers() {
        return this.storage.getItem('users', []);
    }

    /**
     * Set users
     * @param {Array} users - Array of users
     */
    setUsers(users) {
        return this.storage.setItem('users', users);
    }

    /**
     * Login user
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Object} Login result
     */
    async login(username, password) {
        try {
            if (!username || !password) {
                return { 
                    success: false, 
                    error: 'يرجى إدخال اسم المستخدم وكلمة المرور' 
                };
            }

            const users = this.getUsers();
            const user = users.find(u => u.username === username);

            if (!user) {
                return { 
                    success: false, 
                    error: 'اسم المستخدم غير موجود' 
                };
            }

            // Simple password check (in real app, use proper hashing)
            if (user.password !== password) {
                return { 
                    success: false, 
                    error: 'كلمة المرور غير صحيحة' 
                };
            }

            // Create session data (without password)
            const sessionUser = {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                is_admin: user.is_admin,
                login_time: new Date().toISOString()
            };

            // Save current user
            this.storage.setCurrentUser(sessionUser);

            return { 
                success: true, 
                user: sessionUser,
                message: `مرحباً ${user.full_name}` 
            };

        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                error: 'حدث خطأ أثناء تسجيل الدخول' 
            };
        }
    }

    /**
     * Logout user
     * @returns {Object} Logout result
     */
    logout() {
        try {
            this.storage.logout();
            return { 
                success: true, 
                message: 'تم تسجيل الخروج بنجاح' 
            };
        } catch (error) {
            console.error('Logout error:', error);
            return { 
                success: false, 
                error: 'حدث خطأ أثناء تسجيل الخروج' 
            };
        }
    }

    /**
     * Get current user
     * @returns {Object|null} Current user or null
     */
    getCurrentUser() {
        return this.storage.getCurrentUser();
    }

    /**
     * Check if user is logged in
     * @returns {boolean} Is logged in
     */
    isLoggedIn() {
        return this.storage.isLoggedIn();
    }

    /**
     * Check if current user is admin
     * @returns {boolean} Is admin
     */
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.is_admin === true;
    }

    /**
     * Require login (redirect to login if not logged in)
     * @returns {boolean} Is logged in
     */
    requireLogin() {
        if (!this.isLoggedIn()) {
            // Redirect to login page
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Require admin privileges
     * @returns {boolean} Is admin
     */
    requireAdmin() {
        if (!this.requireLogin()) {
            return false;
        }

        if (!this.isAdmin()) {
            UIUtils.showAlert('error', 'ليس لديك صلاحية للوصول لهذه الصفحة');
            return false;
        }

        return true;
    }

    /**
     * Register new user (admin only)
     * @param {Object} userData - User data
     * @returns {Object} Registration result
     */
    async registerUser(userData) {
        try {
            // Check admin privileges
            if (!this.isAdmin()) {
                return { 
                    success: false, 
                    error: 'ليس لديك صلاحية لإنشاء مستخدمين جدد' 
                };
            }

            // Validate required fields
            if (!userData.username || !userData.password || !userData.full_name) {
                return { 
                    success: false, 
                    error: 'جميع الحقول مطلوبة' 
                };
            }

            const users = this.getUsers();

            // Check if username already exists
            if (users.find(u => u.username === userData.username)) {
                return { 
                    success: false, 
                    error: 'اسم المستخدم موجود بالفعل' 
                };
            }

            // Create new user
            const newUser = {
                id: this.generateUserId(),
                username: userData.username.trim(),
                password: userData.password, // Should be hashed in real app
                full_name: userData.full_name.trim(),
                email: userData.email ? userData.email.trim() : '',
                is_admin: userData.is_admin === true,
                created_at: new Date().toISOString(),
                created_by: this.getCurrentUser().id
            };

            users.push(newUser);
            this.setUsers(users);

            return { 
                success: true, 
                user: newUser,
                message: 'تم إنشاء المستخدم بنجاح' 
            };

        } catch (error) {
            console.error('Registration error:', error);
            return { 
                success: false, 
                error: 'حدث خطأ أثناء إنشاء المستخدم' 
            };
        }
    }

    /**
     * Update user (admin only or self)
     * @param {string} userId - User ID
     * @param {Object} userData - Updated user data
     * @returns {Object} Update result
     */
    async updateUser(userId, userData) {
        try {
            const currentUser = this.getCurrentUser();
            
            // Check if user can update (admin or self)
            if (!this.isAdmin() && currentUser.id !== userId) {
                return { 
                    success: false, 
                    error: 'ليس لديك صلاحية لتعديل هذا المستخدم' 
                };
            }

            const users = this.getUsers();
            const userIndex = users.findIndex(u => u.id === userId);

            if (userIndex === -1) {
                return { 
                    success: false, 
                    error: 'المستخدم غير موجود' 
                };
            }

            // Update allowed fields
            const allowedFields = ['full_name', 'email'];
            if (this.isAdmin()) {
                allowedFields.push('is_admin');
            }
            if (userData.password) {
                allowedFields.push('password');
            }

            allowedFields.forEach(field => {
                if (userData[field] !== undefined) {
                    users[userIndex][field] = userData[field];
                }
            });

            users[userIndex].updated_at = new Date().toISOString();
            users[userIndex].updated_by = currentUser.id;

            this.setUsers(users);

            // Update current user session if updating self
            if (currentUser.id === userId) {
                const updatedSessionUser = { ...currentUser };
                allowedFields.forEach(field => {
                    if (userData[field] !== undefined && field !== 'password') {
                        updatedSessionUser[field] = userData[field];
                    }
                });
                this.storage.setCurrentUser(updatedSessionUser);
            }

            return { 
                success: true, 
                message: 'تم تحديث المستخدم بنجاح' 
            };

        } catch (error) {
            console.error('Update user error:', error);
            return { 
                success: false, 
                error: 'حدث خطأ أثناء تحديث المستخدم' 
            };
        }
    }

    /**
     * Delete user (admin only)
     * @param {string} userId - User ID
     * @returns {Object} Delete result
     */
    async deleteUser(userId) {
        try {
            if (!this.isAdmin()) {
                return { 
                    success: false, 
                    error: 'ليس لديك صلاحية لحذف المستخدمين' 
                };
            }

            const currentUser = this.getCurrentUser();
            if (currentUser.id === userId) {
                return { 
                    success: false, 
                    error: 'لا يمكنك حذف حسابك الخاص' 
                };
            }

            const users = this.getUsers();
            const filteredUsers = users.filter(u => u.id !== userId);

            if (filteredUsers.length === users.length) {
                return { 
                    success: false, 
                    error: 'المستخدم غير موجود' 
                };
            }

            this.setUsers(filteredUsers);

            return { 
                success: true, 
                message: 'تم حذف المستخدم بنجاح' 
            };

        } catch (error) {
            console.error('Delete user error:', error);
            return { 
                success: false, 
                error: 'حدث خطأ أثناء حذف المستخدم' 
            };
        }
    }

    /**
     * Change password
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Object} Change password result
     */
    async changePassword(currentPassword, newPassword) {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) {
                return { 
                    success: false, 
                    error: 'يجب تسجيل الدخول أولاً' 
                };
            }

            const users = this.getUsers();
            const user = users.find(u => u.id === currentUser.id);

            if (!user) {
                return { 
                    success: false, 
                    error: 'المستخدم غير موجود' 
                };
            }

            // Verify current password
            if (user.password !== currentPassword) {
                return { 
                    success: false, 
                    error: 'كلمة المرور الحالية غير صحيحة' 
                };
            }

            // Validate new password
            if (!newPassword || newPassword.length < 6) {
                return { 
                    success: false, 
                    error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' 
                };
            }

            // Update password
            const result = await this.updateUser(currentUser.id, { 
                password: newPassword 
            });

            if (result.success) {
                return { 
                    success: true, 
                    message: 'تم تغيير كلمة المرور بنجاح' 
                };
            } else {
                return result;
            }

        } catch (error) {
            console.error('Change password error:', error);
            return { 
                success: false, 
                error: 'حدث خطأ أثناء تغيير كلمة المرور' 
            };
        }
    }

    /**
     * Generate unique user ID
     * @returns {string} User ID
     */
    generateUserId() {
        return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Get user activity log
     * @returns {Array} Activity log
     */
    getUserActivity() {
        // This would typically come from a backend
        // For now, return mock data
        return [
            {
                user: this.getCurrentUser()?.username || 'مجهول',
                action: 'تسجيل الدخول',
                timestamp: new Date().toISOString(),
                ip: '192.168.1.100'
            }
        ];
    }

    /**
     * Session management
     */
    
    /**
     * Check session validity
     * @returns {boolean} Is session valid
     */
    isSessionValid() {
        const user = this.getCurrentUser();
        if (!user || !user.login_time) {
            return false;
        }

        // Check if session is older than 24 hours
        const loginTime = new Date(user.login_time);
        const now = new Date();
        const hoursDiff = (now - loginTime) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            this.logout();
            return false;
        }

        return true;
    }

    /**
     * Extend session
     */
    extendSession() {
        const user = this.getCurrentUser();
        if (user) {
            user.login_time = new Date().toISOString();
            this.storage.setCurrentUser(user);
        }
    }

    /**
     * Initialize page authentication
     * Call this on pages that require authentication
     */
    initPageAuth() {
        // Check if session is valid
        if (!this.isSessionValid()) {
            return;
        }

        // Extend session on activity
        this.extendSession();

        // Update UI with user info
        this.updateAuthUI();
    }

    /**
     * Update authentication UI elements
     */
    updateAuthUI() {
        const user = this.getCurrentUser();
        const isLoggedIn = !!user;

        // Update navigation
        const navAuth = document.getElementById('nav-auth');
        const navGuest = document.getElementById('nav-guest');

        if (navAuth) navAuth.classList.toggle('d-none', !isLoggedIn);
        if (navGuest) navGuest.classList.toggle('d-none', isLoggedIn);

        // Update user info displays
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(el => {
            if (user) {
                el.textContent = user.full_name || user.username;
            }
        });

        // Show/hide admin elements
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.classList.toggle('d-none', !this.isAdmin());
        });
    }
}

// Create global instance
const authManager = new AuthManager();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    authManager.initPageAuth();
});

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
    window.authManager = authManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthManager, authManager };
}
