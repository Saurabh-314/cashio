# Cashio

Personal money management for bank accounts, cash, credit cards, budgets, goals, bills, loans, and net worth.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Cloud Firestore and Storage
- Email/password accounts stored in a Firestore `appUsers` table with hashed passwords
- Recharts, React Hook Form, Zod, date-fns

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Create a Firebase project and enable Cloud Firestore and Storage. Do not use Firebase Authentication.

3. Paste the Firebase web app config into `.env.local`, and set `AUTH_SECRET` and `AUTH_PEPPER`.

4. Deploy security rules from `firebase/`:

```bash
firebase deploy --only firestore:rules,storage
```

5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). New users land on onboarding, then `/dashboard`.

## Notes

- Do not commit `.env.local`.
- Transfers and credit-card payments are not treated as expenses.
- Demo seed data is available from Settings in development only.
- Deploy to Vercel with the same `NEXT_PUBLIC_FIREBASE_*` environment variables.
