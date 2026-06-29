# PDF to Excel

Convert Federal Bank PDF account statements into Excel workbooks entirely in the browser.

## Features

- Upload a bank statement PDF locally in your browser
- Extract all transactions into a structured `Transactions` sheet
- Generate a `Daily Balance` summary sheet
- Download the Excel file immediately
- Your PDF never leaves your device

## Supported formats

Currently supports **Federal Bank** account statement PDFs.

## Client-side libraries

| Step | Library | Why |
| --- | --- | --- |
| PDF text extraction | [`pdf-parse`](https://www.npmjs.com/package/pdf-parse) | Preserves the tab-separated layout needed for Federal Bank statement parsing |
| Excel generation | [`xlsx-js-style`](https://www.npmjs.com/package/xlsx-js-style) | Builds styled `.xlsx` files in the browser, including blue headers and Indian rupee number formats |

Other libraries considered:

- **`pdfjs-dist`**: excellent general-purpose PDF engine, but plain text extraction loses column structure unless you build custom layout reconstruction
- **`unpdf`**: simpler API, but merges text and breaks structured bank-statement parsing
- **`exceljs`**: good for Excel, but heavier than needed for this use case

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
