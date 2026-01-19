# Firebase Setup Guide - Phone Store Demo

This guide explains how to configure Firebase for the Phone Store Demo project.

## Prerequisites

1. Firebase project: `phone-store-demo`
2. Firebase CLI installed
3. Admin access to Firebase project

## Firebase Services Setup

### 1. Firestore Database

**Enable Firestore:**
1. Go to Firebase Console → Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (we'll update rules later)
4. Select location (choose closest to your users)

**Apply Security Rules:**
```bash
firebase deploy --only firestore:rules
```

### 2. Firebase Storage

**Enable Storage:**
1. Go to Firebase Console → Storage
2. Click "Get started"
3. Choose "Start in test mode"
4. Select location (same as Firestore)

**Apply Storage Rules:**
```bash
firebase deploy --only storage
```

### 3. Firebase Authentication

**Enable Authentication:**
1. Go to Firebase Console → Authentication
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider
5. Optionally enable "Google" provider

**Configure Authorized Domains:**
- Add your Render domain: `https://phone-store-demo.onrender.com`
- Add localhost for development: `http://localhost:8000`

### 4. Firebase Analytics

**Enable Analytics:**
1. Go to Firebase Console → Analytics
2. Click "Get started"
3. Follow the setup wizard
4. Analytics will be automatically enabled

## Security Rules Explanation

### Firestore Rules

```javascript
// المنتجات - قراءة عامة، كتابة للمستخدمين المسجلين
match /products/{productId} {
  allow read: if true;
  allow write: if request.auth != null;
}

// المبيعات - للمستخدمين المسجلين فقط
match /sales/{saleId} {
  allow read, write: if request.auth != null;
}

// العملاء - للمستخدمين المسجلين فقط
match /customers/{customerId} {
  allow read, write: if request.auth != null;
}
```

### Storage Rules

```javascript
// صور المنتجات - قراءة عامة، كتابة للمستخدمين المسجلين
match /products/{productId}/{fileName} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

## Deployment Commands

### Deploy All Rules
```bash
firebase deploy
```

### Deploy Specific Rules
```bash
# Firestore rules only
firebase deploy --only firestore:rules

# Storage rules only
firebase deploy --only storage

# Hosting only
firebase deploy --only hosting
```

## Testing Rules

### Test Firestore Rules
1. Go to Firebase Console → Firestore Database
2. Click "Rules" tab
3. Use "Rules playground" to test rules

### Test Storage Rules
1. Go to Firebase Console → Storage
2. Click "Rules" tab
3. Use "Rules playground" to test rules

## Environment Configuration

### Development
- Use test mode rules
- Allow all reads/writes for testing

### Production
- Use strict rules
- Require authentication for writes
- Allow public reads for products only

## Monitoring

### Firestore
- Monitor usage in Firebase Console
- Check security rules violations
- Review query performance

### Storage
- Monitor storage usage
- Check file upload/download metrics
- Review security rules violations

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Check if user is authenticated
   - Verify security rules
   - Check user permissions

2. **CORS Errors**
   - Add domain to authorized domains
   - Check Firebase configuration

3. **Storage Upload Fails**
   - Check storage rules
   - Verify file size limits
   - Check authentication

### Debug Steps

1. Check browser console for errors
2. Verify Firebase configuration
3. Test rules in Firebase Console
4. Check network requests

## Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use environment variables** for sensitive data
3. **Implement proper authentication** checks
4. **Regularly review** security rules
5. **Monitor** for suspicious activity

## Support

For Firebase support:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Console](https://console.firebase.google.com)
- [Firebase Support](https://firebase.google.com/support)

---

**Project**: phone-store-demo
**Repository**: https://github.com/FLANsa/phone-store-demo
