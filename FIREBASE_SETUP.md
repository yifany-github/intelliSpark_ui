# Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for the ProductInsightAI application to enable email-based authentication and Google OAuth login.

## Prerequisites

- Google account for Firebase Console access
- Node.js and npm installed
- Access to this project's codebase

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `productinsightai` (or your preferred name)
4. Disable Google Analytics (optional for this setup)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, navigate to **Authentication** in the left sidebar
2. Click on the **Sign-in method** tab
3. Enable the following sign-in providers:

### Email/Password Authentication
1. Click on **Email/Password**
2. Enable the first option: **Email/Password**
3. Optionally enable **Email link (passwordless sign-in)**
4. Click **Save**

### Google OAuth Authentication
1. Click on **Google**
2. Enable **Google sign-in**
3. Enter your project support email
4. Click **Save**

## Step 3: Configure Web App

1. In Firebase Console, click on **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click **Web** icon (`</>`)
4. Enter app nickname: `ProductInsightAI Web`
5. Check **"Also set up Firebase Hosting"** (optional)
6. Click **Register app**
7. Copy the Firebase configuration object (you'll need this for environment variables)

The config object looks like this:
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Step 4: Set Up Environment Variables

1. Create a `.env` file in the root directory of the project (if it doesn't exist)
2. Add the following environment variables using values from your Firebase config:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id-here
```

**Important:** 
- Never commit the `.env` file to version control
- Make sure `.env` is in your `.gitignore` file
- Use `VITE_` prefix for environment variables in Vite projects

## Step 5: Configure Authorized Domains

1. In Firebase Console, go to **Authentication** > **Settings** > **Authorized domains**
2. Add your domains:
   - `localhost` (for development)
   - `127.0.0.1` (for development)
   - Your production domain (e.g., `yourapp.com`)

## Step 6: Install Dependencies (Already Done)

The following dependencies have already been installed:
```bash
npm install firebase react-firebase-hooks
```

## Step 7: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page
3. Try the following tests:
   - **Email Registration**: Create a new account with email and password
   - **Email Login**: Log in with the created account
   - **Google OAuth**: Use "Continue with Google" button
   - **Logout**: Ensure logout works properly

## Troubleshooting

### Common Issues

**1. "Firebase: Error (auth/unauthorized-domain)"**
- Solution: Add your domain to Authorized domains in Firebase Console

**2. "Firebase: Error (auth/api-key-not-valid)"**
- Solution: Check that your VITE_FIREBASE_API_KEY is correct

**3. "Firebase: Error (auth/project-not-found)"**
- Solution: Verify VITE_FIREBASE_PROJECT_ID matches your project

**4. Google OAuth popup closes immediately**
- Solution: Check authorized domains and ensure popup blockers are disabled

**5. "Module not found: Can't resolve 'firebase'"**
- Solution: Restart your development server after installing dependencies

### Development vs Production

**Development:**
- Uses `localhost` and `127.0.0.1`
- Can use Firebase emulator for testing (optional)

**Production:**
- Add your production domain to authorized domains
- Ensure environment variables are set in your hosting platform
- Consider implementing additional security rules

## Security Considerations

1. **Environment Variables**: Never expose Firebase config in client-side code in production
2. **Firestore Rules**: If using Firestore, implement proper security rules
3. **Domain Restrictions**: Keep authorized domains list minimal
4. **API Key Restrictions**: Consider restricting Firebase API key usage

## Backend Integration

The backend is already configured to:
- Accept Firebase ID tokens via `/api/auth/login/firebase` endpoint
- Exchange Firebase tokens for internal JWT tokens
- Create user accounts automatically for new Firebase users
- Maintain backward compatibility with username-based authentication

## Support

For issues with this setup:
1. Check Firebase Console for error logs
2. Review browser console for client-side errors
3. Check the backend logs for authentication errors
4. Refer to [Firebase Documentation](https://firebase.google.com/docs/auth)

## Migration from Username Auth

Existing users with username-based accounts can:
1. Continue using username login via legacy endpoint
2. Add an email to their account (future enhancement)
3. Link their account with Google OAuth (future enhancement)

The system maintains full backward compatibility during the transition period.