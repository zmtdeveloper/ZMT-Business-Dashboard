# ZMT Business Dashboard

A lightweight business operations dashboard for managing clients, products, orders, payments, expenses, and reports from a single web interface.

The app is built with React, TypeScript, Vite, Tailwind CSS, Radix UI primitives, Recharts, and an optional Google Sheets sync layer powered by Google Apps Script.

## Features

- Client, product, order, payment, and expense management
- Dashboard KPIs for revenue, expenses, profit, pending payments, and renewals
- Order expiry and renewal tracking
- Payment status calculation across orders and payments
- Responsive layout for desktop and mobile
- Local storage fallback for offline/private use
- Optional Google Sheets sync through Apps Script
- Environment-based configuration

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Recharts
- Wouter
- Google Apps Script

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Update `.env` with your local values:

```env
PORT=5173
BASE_PATH=/
VITE_APP_PASSWORD_HASH=
VITE_APP_PASSWORD=replace-with-a-strong-password
VITE_APPS_SCRIPT_URL=
VITE_APPS_SCRIPT_TOKEN=
```

For deployed builds, prefer `VITE_APP_PASSWORD_HASH` and leave `VITE_APP_PASSWORD`
empty. Generate a SHA-256 hash of the password, then set the 64-character hex
hash in `.env` or in Vercel Environment Variables:

```powershell
$password = Read-Host "Password"
$bytes = [Text.Encoding]::UTF8.GetBytes($password)
$hash = [Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
([BitConverter]::ToString($hash) -replace "-", "").ToLower()
```

```env
VITE_APP_PASSWORD_HASH=your-sha256-password-hash
VITE_APP_PASSWORD=
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Scripts

```bash
npm run dev        # Start local development server
npm run build      # Create production build
npm run preview    # Preview production build locally
npm run typecheck  # Run TypeScript checks
```

## Google Sheets Sync

The dashboard can run locally with browser storage, or sync with Google Sheets when the Apps Script integration is configured.

1. Create a Google Sheet with these tabs:

```text
Clients
Products
Orders
Payments
Expenses
```

2. Open `Extensions > Apps Script`.
3. Paste the contents of `apps-script/Code.gs`.
4. Set a script property:

```text
APP_TOKEN=your-secret-token
```

5. Deploy the script as a Web App.
6. Add the deployment URL and matching token to `.env`:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/...
VITE_APPS_SCRIPT_TOKEN=your-secret-token
```

When configured, the dashboard loads data from Google Sheets on startup and writes changes back to the sheet.

## Environment Notes

Do not commit `.env`. It is intentionally ignored by git.

`VITE_APP_PASSWORD_HASH` and `VITE_APP_PASSWORD` are bundled into the frontend by Vite. The hash option avoids exposing the plain password in the JavaScript bundle, but it is still only a lightweight access gate. Production deployments should use server-side authentication for stronger protection.

## Project Structure

```text
apps-script/        Google Apps Script sync bridge
public/             Static assets
src/components/     Shared layout and UI components
src/context/        Auth and data state providers
src/pages/          Dashboard pages
src/services/       Google Sheets sync service
src/lib/            Utility and formatting helpers
```

## Build

Create a production build:

```bash
npm run build
```

The compiled app is generated in:

```text
dist/public
```

## License

Private business software unless a license is added.
