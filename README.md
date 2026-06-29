# PDF to Excel

Convert Federal Bank PDF account statements into Excel workbooks, ready to deploy on [Vercel](https://vercel.com).

## Features

- Upload a bank statement PDF in the browser
- Extract all transactions into a structured `Transactions` sheet
- Generate a `Daily Balance` summary sheet
- Download the Excel file immediately

## Supported formats

Currently supports **Federal Bank** account statement PDFs.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repository to GitHub
2. Import the project in Vercel
3. Deploy with the default Next.js settings

No environment variables are required.

## API

`POST /api/convert`

Form field:

- `file`: PDF bank statement

Returns an `.xlsx` file on success.

## Tech stack

- Next.js App Router
- `pdf-parse` for PDF text extraction
- `xlsx` for Excel generation
- Tailwind CSS
