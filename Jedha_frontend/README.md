This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Audit UI

This workspace includes an `AuditGeo` UI under the `/audit` route that lets you send a query to the backend audit service and compare AI responses.

Environment:
- Set `JEDHA_BACKEND_URL` to the backend base URL (for example `http://localhost:8000`). The frontend uses a secure server-side proxy at `/api/audit` so the backend URL is never exposed to client JavaScript.
 - Set `JEDHA_BACKEND_URL` to the backend base URL (for example `http://localhost:8000`).
 - Set `JEDHA_BACKEND_API_KEY` to the backend API key so the server proxy can forward requests securely.
 You can copy `.env.local.example` to `.env.local` and update values locally. Do not commit `.env.local`.

Run locally:
```bash
npm install
npm run dev
# visit http://localhost:3000/audit
```

Security note: Do not commit `JEDHA_BACKEND_URL` or any secrets to the repository. Configure them in your deployment environment (Vercel/Netlify) or use a `.env` file locally (gitignored).
