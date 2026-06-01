# CloudVault

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Storage-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-16a34a?style=for-the-badge)](./LICENSE)

CloudVault is a secure cloud storage platform that allows users to upload, organize, share, recover, and manage files through a modern web interface. It supports file uploads, folder organization, password-protected share links, activity tracking, trash recovery, and admin account management.

## Features

### Authentication and account management
  - Email signup and login
  - Email verification
  - Password reset
  - Profile updates and password changes
  - Account deletion and restore flow

### Files and folders
  - Upload files to storage
  - Create, rename, move, and delete folders
  - Upload files into folders
  - Download files and folders
  - File previews for supported formats
  - Search across files and folders

### Sharing
- Secure file sharing
- Secure folder sharing with nested folder support
- Password-protected share links
- Expiring public links
- Shared items management and revoke actions

### Activity and Recovery
- Detailed activity history and audit tracking
- Activity metadata logging
- Trash with restore and permanent delete actions
- Automatic cleanup of expired trash after 30 days

### Admin tools
  - Admin dashboard
  - User management
  - Storage usage overview
  - System logs and deletion flow visibility

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma
- PostgreSQL
- Supabase Storage
- Tailwind CSS
- shadcn/ui
- Nodemailer
- bcryptjs
- JSON Web Tokens

## Screenshots

### Landing Page
![Landing Page](screenshots/landing.png)

### Dashboard
![Dashboard](screenshots/dashboard.png)

### Files Dashboard
![Files Dashboard](screenshots/files-dashboard.png)

### Uploading Page
![Upload](screenshots/upload-dashboard.png)

### Secure Sharing
![Secure Sharing](screenshots/sharing-dashboard.png)

### Activity Tracking
![Activity Tracking](screenshots/activity-dashboard.png)

### Trash & Recovery
![Trash](screenshots/trash-dashboard.png)

### Admin Dashboard
![Admin Dashboard](screenshots/admin-dashboard.png)

## Installation

```bash
git clone https://github.com/Soumodeep084/cloudvault-storage-platform.git
cd cloudvault-storage-platform
npm install
npx prisma migrate dev
npx prisma generate
```

## Environment Variables

Create a `.env` file with the variables below:

```env
JWT_SECRET=your_jwt_secret
SHARE_ACCESS_COOKIE_SECRET=your_share_access_cookie_secret

SHARE_BASE_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://...

GMAIL_USER=your_gmail
GMAIL_APP_PASSWORD=your_gmail_app_password
EMAIL_SIGNATURE=- CloudVault Team
```

## Running Locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Project Structure

```text
app/
  actions/          Server actions for auth, files, folders, admin, and trash
  api/              Route handlers for auth, downloads, previews, and cleanup
  dashboard/        User dashboard, files, shared items, history, trash, settings
components/         Shared UI and dashboard components
lib/                Auth, storage, email, share, admin, and utility helpers
prisma/             Database schema and migrations
public/             Static assets
types/              Shared TypeScript types
proxy.ts            Route protection and request handling
```

## Security Features

- HttpOnly session cookies backed by signed JWTs
- Email verification flow for new accounts
- Password reset links with token expiry
- Password-protected share links
- Expiring share links
- Trash retention with scheduled cleanup
- Admin-only access to the admin dashboard and user actions

## Deployment

- Build the app with `npm run build`.
- Set the production environment variables listed above.
- Provision PostgreSQL and a Supabase Storage bucket named `files`.
- Deploy to Vercel or any Node host that supports Next.js App Router.

## Author

Soumodeep Tarak Dutta

