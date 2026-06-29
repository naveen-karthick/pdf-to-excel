import * as XLSX from "xlsx-js-style";

import { buildDailyBalanceSheet } from "@/lib/daily-balance";
import type { Transaction } from "@/lib/types";

const TRANSACTION_HEADERS = [
  "Date",
  "Value Date",
  "Particulars",
  "Tran Type",
  "Tran Id",
  "Cheque Details",
  "Withdrawals",
  "Deposits",
  "Balance",
  "Balance Type (Cr/Dr)",
];

const HEADER_STYLE = {
  fill: {
    patternType: "solid",
    fgColor: { rgb: "0B57D0" },
    bgColor: { rgb: "0B57D0" },
  },
  font: {
    bold: true,
    color: { rgb: "FFFFFF" },
  },
  alignment: {
    horizontal: "center",
    vertical: "center",
  },
};

const INDIAN_CURRENCY_FORMAT = "#,##,##0.00_);(#,##,##0.00)";

const CURRENCY_STYLE = {
  numFmt: INDIAN_CURRENCY_FORMAT,
};

function applyHeaderStyle(sheet: XLSX.WorkSheet, columnCount: number) {
  for (let column = 0; column < columnCount; column += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: column });
    if (!sheet[cellRef]) continue;
    sheet[cellRef].s = HEADER_STYLE;
  }
}

function applyCurrencyStyle(
  sheet: XLSX.WorkSheet,
  columns: number[],
  startRow: number,
  endRow: number,
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (const column of columns) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[cellRef];
      if (!cell || typeof cell.v !== "number") continue;
      cell.s = { ...(cell.s || {}), ...CURRENCY_STYLE };
    }
  }
}

function transactionsToRows(transactions: Transaction[]): unknown[][] {
  return [
    TRANSACTION_HEADERS,
    ...transactions.map((transaction) => [
      transaction.date,
      transaction.valueDate,
      transaction.particulars,
      transaction.tranType,
      transaction.tranId,
      transaction.chequeDetails,
      transaction.withdrawals === "" ? "" : transaction.withdrawals,
      transaction.deposits === "" ? "" : transaction.deposits,
      transaction.balance,
      transaction.balanceType,
    ]),
  ];
}

function buildTransactionsSheet(transactions: Transaction[]): XLSX.WorkSheet {
  const rows = transactionsToRows(transactions);
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  applyHeaderStyle(sheet, TRANSACTION_HEADERS.length);
  applyCurrencyStyle(sheet, [6, 7, 8], 1, rows.length - 1);

  sheet["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 48 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
  ];

  return sheet;
}

function buildDailyBalanceWorksheet(transactions: Transaction[]): XLSX.WorkSheet {
  const rows = buildDailyBalanceSheet(transactions);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const columnCount = rows[0]?.length ?? 0;

  applyHeaderStyle(sheet, columnCount);

  const currencyColumns = Array.from({ length: Math.max(columnCount - 1, 0) }, (_, index) => index + 1);
  applyCurrencyStyle(sheet, currencyColumns, 1, rows.length - 1);

  return sheet;
}

export function generateWorkbook(transactions: Transaction[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, buildTransactionsSheet(transactions), "Transactions");
  XLSX.utils.book_append_sheet(
    workbook,
    buildDailyBalanceWorksheet(transactions),
    "Daily Balance",
  );

  return workbook;
}

export function generateExcelBuffer(transactions: Transaction[]): Buffer {
  const workbook = generateWorkbook(transactions);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildDownloadFilename(originalName: string): string {
  const baseName = originalName.replace(/\.pdf$/i, "");
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "_");
  const suffix = Math.random().toString(16).slice(2, 10);
  return `${baseName}_${timestamp}_${suffix}_extracted.xlsx`;
}
