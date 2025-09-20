// Logout utility for Firebase Authentication
import { signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Ensure firebaseAuth is available globally from firebase-config.js
// This utility assumes firebase-config.js has already run and set window.firebaseAuth

window.logout = async function() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            // Sign out from Firebase Authentication
            if (window.firebaseAuth) {
                await signOut(window.firebaseAuth);
            }
            
            // Clear local session data
            localStorage.removeItem('current_user');
            
            // Show success and redirect
            alert('تم تسجيل الخروج بنجاح');
            window.location.href = 'login.html';
            
        } catch (error) {
            console.error('Error during Firebase logout:', error);
            // Fallback: clear local data even if Firebase fails
            localStorage.removeItem('current_user');
            alert('تم تسجيل الخروج (مع بعض الأخطاء)');
            window.location.href = 'login.html';
        }
    }
};
