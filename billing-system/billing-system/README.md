# Billing & Invoice Management System

MERN-style stack with **MySQL**: **R**eact (Vite) + **E**xpress + **N**ode.js + MySQL.
Web version of the original Python/CustomTkinter desktop app, with the same screens:
Dashboard, Customers, Products, New Invoice, Invoice History (view / PDF / pay / payment history / delete),
Sales Reports (with PDF export) and Settings (company info, tax rate, backup & restore).

## Project structure

```
billing-system/
├── api/index.js          # Vercel serverless entry (wraps the Express app)
├── server/               # Express + MySQL backend
│   ├── app.js            # Express app (exported)
│   ├── index.js          # Local dev server
│   ├── db.js             # MySQL connection pool
│   ├── schema.sql        # Table definitions
│   ├── initDb.js         # Creates the tables (npm run db:init)
│   └── routes/           # customers, products, invoices, dashboard, reports, settings
├── client/               # React frontend (Vite)
│   └── src/pages/        # One file per screen
├── vercel.json
└── .env.example
```

## Run locally

1. Install MySQL and create a database:
   ```sql
   CREATE DATABASE billing;
   ```
2. Copy `.env.example` to `.env` and fill in your MySQL details.
3. Install and create the tables:
   ```bash
   npm install
   npm run db:init
   cd client && npm install && cd ..
   ```
4. Start the API (terminal 1) and the React app (terminal 2):
   ```bash
   npm run dev          # API on http://localhost:5000
   npm run client:dev   # React on http://localhost:5173 (proxies /api to port 5000)
   ```

## Deploy to Vercel

Vercel cannot host MySQL, so you need a **cloud MySQL database** first.
Free options: [TiDB Cloud Serverless](https://tidbcloud.com), [Aiven](https://aiven.io), [Railway](https://railway.app).

1. Create the cloud database, then create the tables **from your own computer**:
   put the cloud credentials in `.env` (with `DB_SSL=true`) and run `npm run db:init`.
2. Push this folder to a GitHub repository.
3. On vercel.com choose **Add New → Project** and import the repository
   (leave Framework Preset as "Other"; `vercel.json` sets the build and output folder).
4. Under **Settings → Environment Variables** add:
   `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`.
5. Click **Deploy**.

## Notes

- Deleting an invoice also returns its stock to the products.
- The first payment entered on a new invoice is stored in the payment history.
- Backup downloads a JSON file with all data; Restore replaces all current data from such a file.
- PDFs (invoice and sales report) are generated on request, because Vercel cannot store files.
