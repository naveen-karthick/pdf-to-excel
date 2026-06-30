# PDF to Excel

Convert Indian bank statement PDFs into Excel workbooks entirely in the browser.

## Features

- Upload a bank statement PDF locally in your browser
- Password-protected PDFs supported (password stays in the browser; Excel output is not password-protected)
- Auto-detects bank and applies the correct parser
- Extracts transactions into a structured `Transactions` sheet
- Generates a `Daily Balance` summary sheet
- Download the Excel file immediately

## Supported banks

| Bank | Detection |
| --- | --- |
| Federal Bank | `THE FEDERAL BANK LTD.` |
| State Bank of India (SBI) | `State Bank of India` / `SBIN` IFSC |
| HDFC Bank | `HDFC BANK` |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

Deploy as a static/client-heavy Next.js app. No server API or environment variables are required.

## Tech stack

- Next.js App Router
- `pdf-parse` browser build for PDF text extraction
- `xlsx-js-style` for Excel generation
- Tailwind CSS
