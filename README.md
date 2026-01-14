# Trimly | Barbershop Booking Network (MVP)

A premium, mobile-first barbershop booking application designed for the Zagreb market.

## 🚀 Quick Start (Local Development)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```
   The production-ready files will be in the `dist/` folder.

## 🌐 Deployment Instructions

### Option A: Vercel (Easiest)
1. Push this code to a GitHub repository.
2. Connect the repo to [Vercel](https://vercel.com).
3. Vercel will build and host it automatically.

### Option B: Manual Static Hosting
1. Run `npm run build`.
2. Upload the contents of the `dist/` folder to any static host (Netlify, GitHub Pages, or your own server).

## 📱 PWA Features (Installable App)
This app is configured as a Progressive Web App. To install:
- **iOS**: Open in Safari > Share > Add to Home Screen.
- **Android**: Open in Chrome > Options > Install App.

## 🛠 Project Structure
- `screens/`: Role-based views for Customers, Barbers, and Admins.
- `store/mockDatabase.ts`: Current data layer using `localStorage`.
- `constants.ts`: City-specific configurations (Zagreb Quarters, Invite Codes).
- `manifest.json`: PWA configuration for mobile installation.

## ⚠️ Important for Production
This version is an **MVP (Minimum Viable Product)**. 

### 1. Database
Currently, data is stored in `localStorage`. This means data is saved **only on the individual user's device**. 
- **Action**: Replace `store/mockDatabase.ts` logic with a real backend like **Firebase**, **Supabase**, or a **Node.js/PostgreSQL** stack so that customers and barbers can see the same data.

### 2. Images
Profile pictures currently use Unsplash/Picsum links.
- **Action**: Implement a file upload service (like Cloudinary or Firebase Storage) in the Barber Profile form.

### 3. Authentication
Passwords are currently stored in plain text for demo purposes.
- **Action**: Use an auth provider (Auth0, Firebase Auth, or Supabase Auth) for secure logins.

---
Created by Trimly Engineering.