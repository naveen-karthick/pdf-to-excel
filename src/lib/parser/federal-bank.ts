import type { ParseResult, Transaction } from "@/lib/types";

import {
  formatDateFromDash,
  normalizeParticulars,
  parseAmount,
} from "@/lib/parser/shared";

const TRAN_TYPES = new Set([
  "TRF",
  "MB",
  "NEFT",
  "SBINT",
  "POS",
  "TDINT",
  "RTGS",
  "IMPS",
  "UPI",
  "ATW",
  "CASH",
  "CHG",
  "INT",
]);

const COMPLETION_RE =
  /^(.+?)\t(\d{2}-\d{2}-\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+(CR|DR)\t(\S+)(?:\s+(\S+))?\s*$/;

const DATE_PREFIX_RE = /^(\d{2}-\d{2}-\d{4})\s+/;

function isHeaderOrFooterLine(line: string): boolean {
  return (
    /^Page \d+ of \d+$/.test(line) ||
    /^-- \d+ of \d+ --$/.test(line) ||
    /^THE FEDERAL BANK/.test(line) ||
    /^CIN:/.test(line) ||
    /^Date Value Date Balance$/.test(line) ||
    /^Type$/.test(line) ||
    /^\(Cr\/Dr\)$/.test(line) ||
    /^Balance\tDeposits\tWithdrawals/.test(line) ||
    /^Balance Deposits Withdrawals/.test(line) ||
    /^Cheque$/.test(line) ||
    /^Details\t?$/.test(line) ||
    /^Tran Id\tTran$/.test(line) ||
    /^Tran Id Tran/.test(line) ||
    /^Type\t?$/.test(line) ||
    /^Particulars$/.test(line) ||
    /^Opening Balance/.test(line) ||
    /^Statement of Account/.test(line) ||
    /^Abbreviations Used:/.test(line) ||
    /^DISCLAIMER:/.test(line) ||
    /^\*{4} END OF STATEMENT/.test(line) ||
    /^GRAND TOTAL/.test(line)
  );
}

function isAccountMetaLine(line: string): boolean {
  return (
    /^SANDHYA/.test(line) ||
    /^Communication Address/.test(line) ||
    /^Regd\./.test(line) ||
    /^Type Of Account/.test(line) ||
    /^Account Number/.test(line) ||
    /^Customer ID/.test(line) ||
    /^Branch Name/.test(line) ||
    /^Currency/.test(line) ||
    /^Nomination/.test(line) ||
    /^Mode of Operation/.test(line) ||
    /^Effective Available/.test(line) ||
    /^Joint Holders/.test(line) ||
    /^Address Last/.test(line) ||
    /^MICR Code/.test(line) ||
    /^Account Open/.test(line) ||
    /^Email ID/.test(line) ||
    /^Branch Sol/.test(line) ||
    /^Account Status/.test(line) ||
    /^CKYC/.test(line) ||
    /^IFSC/.test(line) ||
    /^SWIFT/.test(line) ||
    /^Scheme/.test(line) ||
    /^:/.test(line) ||
    /^THIRUVANANTHAPURAM/.test(line) ||
    /^INDIA-/.test(line) ||
    /^FDRL/.test(line) ||
    /^Date of Issue/.test(line) ||
    /^NIL/.test(line) ||
    /^SINGLE/.test(line) ||
    /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}/.test(line) ||
    /^ACTIVE/.test(line) ||
    /^Name$/.test(line) ||
    /^CASH :/.test(line) ||
    /^FT :/.test(line) ||
    /^SBINT :/.test(line) ||
    /^TDINT :/.test(line) ||
    /^TRF :/.test(line) ||
    /^CLG :/.test(line) ||
    /^MB :/.test(line) ||
    /^TDS :/.test(line) ||
    /^This is a computer generated statement/.test(line) ||
    /^statement date\./.test(line) ||
    /^Contents of this statement/.test(line)
  );
}

function extractTranType(text: string): { tranType: string; particulars: string } {
  const parts = text.trim().split(/\s+/);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (TRAN_TYPES.has(parts[index])) {
      return {
        tranType: parts[index],
        particulars: parts.slice(0, index).join(" ").trim(),
      };
    }
  }

  return { tranType: "", particulars: text.trim() };
}

const GRAND_TOTAL_RE = /^GRAND TOTAL\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/;
const OPENING_BALANCE_RE = /^Opening Balance\s+(CR|DR)[\s\t]+([\d,]+\.?\d*)/;

function parseOpeningBalance(text: string): Transaction | null {
  for (const rawLine of text.split("\n")) {
    const match = rawLine.trim().match(OPENING_BALANCE_RE);
    if (match) {
      return {
        date: "",
        valueDate: "",
        particulars: "Opening Balance",
        tranType: "",
        tranId: "",
        chequeDetails: "",
        withdrawals: "",
        deposits: "",
        balance: parseAmount(match[2]),
        balanceType: match[1],
      };
    }
  }

  return null;
}

function parseGrandTotal(text: string): { totalWithdrawals: number; totalDeposits: number } | null {
  for (const rawLine of text.split("\n")) {
    const match = rawLine.trim().match(GRAND_TOTAL_RE);
    if (match) {
      return {
        totalWithdrawals: parseAmount(match[1]),
        totalDeposits: parseAmount(match[2]),
      };
    }
  }

  return null;
}

function applyGrandTotal(transactions: Transaction[], text: string): Transaction[] {
  const grandTotal = parseGrandTotal(text);
  if (!grandTotal) {
    return transactions;
  }

  return [
    ...transactions,
    {
      date: "",
      valueDate: "",
      particulars: "GRAND TOTAL",
      tranType: "",
      tranId: "",
      chequeDetails: "",
      withdrawals: grandTotal.totalWithdrawals,
      deposits: grandTotal.totalDeposits,
      balance: "",
      balanceType: "",
    },
  ];
}

function prependOpeningBalance(transactions: Transaction[], text: string): Transaction[] {
  const openingBalance = parseOpeningBalance(text);
  if (!openingBalance) {
    return transactions;
  }

  return [openingBalance, ...transactions];
}

function parseTransactions(text: string): Transaction[] {
  const lines = text.split("\n");
  const transactions: Transaction[] = [];
  let buffer: string[] = [];
  let inTransactionSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeaderOrFooterLine(line)) {
      buffer = [];
      if (/^Particulars$/.test(line)) inTransactionSection = true;
      continue;
    }

    if (!inTransactionSection || isAccountMetaLine(line)) {
      buffer = [];
      continue;
    }

    const match = line.match(COMPLETION_RE);
    if (match) {
      const [, tail, valueDate, amountStr, balanceStr, balanceType, tranId, chequeDetails = ""] =
        match;
      const fullText = normalizeParticulars([...buffer, tail].join(" "));
      buffer = [];

      let date = valueDate;
      const dateMatch = fullText.match(DATE_PREFIX_RE);
      if (dateMatch) date = dateMatch[1];

      let particularsText = fullText;
      if (dateMatch) particularsText = fullText.slice(dateMatch[0].length);

      const { tranType, particulars } = extractTranType(particularsText);
      const amount = parseAmount(amountStr);
      const balance = parseAmount(balanceStr);
      const previousBalance = transactions.length
        ? transactions[transactions.length - 1].balance
        : 0;
      const comparablePreviousBalance =
        typeof previousBalance === "number" ? previousBalance : 0;

      let withdrawals: number | "" = "";
      let deposits: number | "" = "";
      if (balance > comparablePreviousBalance) deposits = amount;
      else if (balance < comparablePreviousBalance) withdrawals = amount;
      else deposits = amount;

      transactions.push({
        date: formatDateFromDash(date),
        valueDate: formatDateFromDash(valueDate),
        particulars: normalizeParticulars(particulars),
        tranType,
        tranId,
        chequeDetails: chequeDetails || "",
        withdrawals,
        deposits,
        balance,
        balanceType,
      });
    } else {
      buffer.push(line);
    }
  }

  return applyGrandTotal(prependOpeningBalance(transactions, text), text);
}

export function isFederalBankStatement(text: string): boolean {
  return /THE FEDERAL BANK LTD\./i.test(text) || /Statement of Account for the period/i.test(text);
}

export function parseFederalBankStatement(text: string): ParseResult {
  return {
    bankName: "Federal Bank",
    transactions: parseTransactions(text),
  };
}
