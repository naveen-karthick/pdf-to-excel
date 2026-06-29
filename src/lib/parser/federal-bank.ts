import type { ParseResult, Transaction } from "@/lib/types";

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

function parseAmount(value: string): number {
  return parseFloat(value.replace(/,/g, ""));
}

function formatDate(date: string): string {
  const [day, month, year] = date.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day}-${months[parseInt(month, 10) - 1]}-${year}`;
}

function normalizeParticulars(text: string): string {
  return text.replace(/\s+/g, " ").replace(/([A-Za-z0-9]) \//g, "$1/").trim();
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
  if (!grandTotal || transactions.length === 0) {
    return transactions;
  }

  const lastIndex = transactions.length - 1;
  const lastTransaction = transactions[lastIndex];

  return [
    ...transactions.slice(0, lastIndex),
    {
      ...lastTransaction,
      particulars: `${lastTransaction.particulars} GRAND TOTAL`.trim(),
      withdrawals: grandTotal.totalWithdrawals,
    },
  ];
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

      let withdrawals: number | "" = "";
      let deposits: number | "" = "";
      if (balance > previousBalance) deposits = amount;
      else if (balance < previousBalance) withdrawals = amount;
      else deposits = amount;

      transactions.push({
        date: formatDate(date),
        valueDate: formatDate(valueDate),
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

  return applyGrandTotal(transactions, text);
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
