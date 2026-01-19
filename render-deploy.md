# Render Deployment Guide - Phone Store Demo

This guide explains how to deploy the Phone Store Demo to Render as a static site.

## Prerequisites

1. GitHub repository: `https://github.com/FLANsa/phone-store-demo`
2. Render account
3. Firebase project configured

## Deployment Steps

### 1. Create New Static Site on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Static Site"
3. Connect your GitHub account if not already connected
4. Select repository: `FLANsa/phone-store-demo`

### 2. Configure Static Site Settings

**Basic Settings:**
- **Name**: `phone-store-demo`
- **Branch**: `main`
- **Root Directory**: Leave empty (uses repository root)
- **Build Command**: Leave empty (no build required)
- **Publish Directory**: `./` (root directory)

**Advanced Settings:**
- **Node Version**: 18.x (if needed)
- **Environment**: Production

### 3. Environment Variables (Optional)

If you need to override Firebase config via environment variables:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=phone-store-demo
VITE_FIREBASE_STORAGE_BUCKET=phone-store-demo.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Deploy

1. Click "Create Static Site"
2. Render will automatically:
   - Clone your repository
   - Deploy the static files
   - Provide a public URL

### 5. Custom Domain (Optional)

1. Go to your static site settings
2. Click "Custom Domains"
3. Add your domain
4. Update DNS records as instructed

## File Structure for Static Deployment

```
phone-store-demo/
├── index.html              # Main entry point
├── login.html              # Login page
├── dashboard.html          # Dashboard
├── add_new_phone.html      # Add new phone
├── add_used_phone.html     # Add used phone
├── add_accessory.html      # Add accessory
├── create_sale.html        # Create sale
├── list_sales.html         # List sales
├── inventory_summary.html  # Inventory summary
├── search.html             # Search
├── js/                     # JavaScript files
│   ├── firebase-config.js  # Firebase configuration
│   ├── main.js            # Main application logic
│   └── ...                # Other JS files
├── _redirects             # SPA routing rules
├── render.yaml            # Render configuration
└── package.json           # Dependencies
```

## Important Notes

1. **Firebase Configuration**: Make sure your Firebase project is properly configured
2. **CORS Settings**: Ensure Firebase allows your Render domain
3. **Authentication**: Configure Firebase Auth for your domain
4. **Storage Rules**: Update Firebase Storage rules if needed

## Troubleshooting

### Common Issues:

1. **404 Errors**: Check `_redirects` file for SPA routing
2. **Firebase Connection**: Verify Firebase configuration
3. **CORS Errors**: Update Firebase CORS settings
4. **Build Failures**: Check build logs in Render dashboard

### Debug Steps:

1. Check Render build logs
2. Verify all files are in the correct directory
3. Test Firebase connection locally
4. Check browser console for errors

## Post-Deployment

1. Test all functionality
2. Verify Firebase integration
3. Check mobile responsiveness
4. Test user authentication
5. Verify data persistence

## Monitoring

- Use Render's built-in monitoring
- Check Firebase Analytics
- Monitor error logs
- Track performance metrics

---

**Deployment URL**: Will be provided by Render after successful deployment
**Repository**: https://github.com/FLANsa/phone-store-demo