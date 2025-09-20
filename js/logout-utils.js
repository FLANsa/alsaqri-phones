// Centralized logout utility for Firebase Authentication
// This ensures proper logout from both Firebase Auth and localStorage

import { signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Global logout function that works from any page
window.logout = async function() {
  if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
    try {
      // Sign out from Firebase Authentication
      if (window.firebaseAuth) {
        await signOut(window.firebaseAuth);
        console.log('✅ تم تسجيل الخروج من Firebase Authentication');
      }
      
      // Clear local session data
      localStorage.removeItem('current_user');
      console.log('✅ تم مسح بيانات الجلسة المحلية');
      
      // Show success message
      alert('تم تسجيل الخروج بنجاح');
      
      // Redirect to login page
      window.location.href = 'login.html';
      
    } catch (error) {
      console.error('❌ خطأ في تسجيل الخروج:', error);
      
      // Even if Firebase logout fails, clear local data
      localStorage.removeItem('current_user');
      alert('تم تسجيل الخروج (مع بعض الأخطاء)');
      window.location.href = 'login.html';
    }
  }
};

// Export for module usage
export { window.logout as logout };
