import type { ParseResult, Transaction } from "@/lib/types";

import {
  formatDateFromSlash,
  normalizeParticulars,
  parseAmount,
} from "@/lib/parser/shared";

const TXN_START_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(DEP|WDL)\s+(.+)$/;

const DEPOSIT_AMOUNT_RE = /^-\s*-\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
const WITHDRAWAL_AMOUNT_RE = /^-\s*([\d,]+\.\d{2})\s*-\s*([\d,]+\.\d{2})$/;

const SUMMARY_RE =
  /^([\d,]+\.\d{2})(CR|DR)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(CR|DR)/;

const REF_LINE_RE = /^(\d{10,})\s+AT\s+/;

function isSkipLine(line: string): boolean {
  return (
    /^Balance$/i.test(line) ||
    /^State Bank of India/i.test(line) ||
    /^Branch Name/i.test(line) ||
    /^STATEMENT OF ACCOUNT/i.test(line) ||
    /^Statement Summary/i.test(line) ||
    /^Brought Forward/i.test(line) ||
    /^Please do not share/i.test(line) ||
    /^If your account is operated/i.test(line) ||
    /^This is a computer generated statement/i.test(line) ||
    /^Page no\./i.test(line) ||
    /^\d+\tPage no\./i.test(line) ||
    /^-- \d+ of \d+ --$/.test(line) ||
    /^\(\s*\)/.test(line) ||
    /^Account Summary/i.test(line) ||
    /^Welcome:/i.test(line) ||
    /^Statement From/i.test(line) ||
    /^As on /i.test(line)
  );
}

function parseSummary(text: string): {
  opening: Transaction | null;
  closing: Transaction | null;
} {
  for (const rawLine of text.split("\n")) {
    const match = rawLine.trim().match(SUMMARY_RE);
    if (!match) continue;

    const [
      ,
      openingBalance,
      openingType,
      totalDebits,
      totalCredits,
      closingBalance,
      closingType,
    ] = match;

    return {
      opening: {
        date: "",
        valueDate: "",
        particulars: "Opening Balance",
        tranType: "",
        tranId: "",
        chequeDetails: "",
        withdrawals: "",
        deposits: "",
        balance: parseAmount(openingBalance),
        balanceType: openingType,
      },
      closing: {
        date: "",
        valueDate: "",
        particulars: "GRAND TOTAL",
        tranType: "",
        tranId: "",
        chequeDetails: "",
        withdrawals: parseAmount(totalDebits),
        deposits: parseAmount(totalCredits),
        balance: parseAmount(closingBalance),
        balanceType: closingType,
      },
    };
  }

  return { opening: null, closing: null };
}

function parseTransactions(text: string): Transaction[] {
  const lines = text.split("\n");
  const transactions: Transaction[] = [];
  let buffer: string[] = [];
  let currentStart: RegExpMatchArray | null = null;

  const flushTransaction = (amountLine: string) => {
    if (!currentStart) return;

    const depositMatch = amountLine.match(DEPOSIT_AMOUNT_RE);
    const withdrawalMatch = amountLine.match(WITHDRAWAL_AMOUNT_RE);
    if (!depositMatch && !withdrawalMatch) {
      buffer = [];
      currentStart = null;
      return;
    }

    const [, date, valueDate, direction, headParticulars] = currentStart;
    const middleLines = buffer.slice(1);
    const refLine = middleLines.find((line) => REF_LINE_RE.test(line));
    const particularsLines = middleLines.filter((line) => !REF_LINE_RE.test(line));
    const particulars = normalizeParticulars(
      [`${direction} ${headParticulars}`, ...particularsLines].join(" "),
    );
    const tranId = refLine?.match(REF_LINE_RE)?.[1] ?? "";

    let withdrawals: number | "" = "";
    let deposits: number | "" = "";
    let balance = 0;

    if (depositMatch) {
      deposits = parseAmount(depositMatch[1]);
      balance = parseAmount(depositMatch[2]);
    } else if (withdrawalMatch) {
      withdrawals = parseAmount(withdrawalMatch[1]);
      balance = parseAmount(withdrawalMatch[2]);
    }

    transactions.push({
      date: formatDateFromSlash(date),
      valueDate: formatDateFromSlash(valueDate),
      particulars,
      tranType: direction === "DEP" ? "DEP" : "WDL",
      tranId,
      chequeDetails: "",
      withdrawals,
      deposits,
      balance,
      balanceType: balance >= 0 ? "CR" : "DR",
    });

    buffer = [];
    currentStart = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isSkipLine(line)) {
      buffer = [];
      currentStart = null;
      continue;
    }

    const startMatch = line.match(TXN_START_RE);
    if (startMatch) {
      buffer = [line];
      currentStart = startMatch;
      continue;
    }

    if (currentStart) {
      if (DEPOSIT_AMOUNT_RE.test(line) || WITHDRAWAL_AMOUNT_RE.test(line)) {
        flushTransaction(line);
      } else {
        buffer.push(line);
      }
    }
  }

  return transactions;
}

export function isSbiStatement(text: string): boolean {
  return /State Bank of India/i.test(text) || /SBIN\d{7}/i.test(text);
}

export function parseSbiStatement(text: string): ParseResult {
  const { opening, closing } = parseSummary(text);
  const transactions = parseTransactions(text);

  const rows: Transaction[] = [];
  if (opening) rows.push(opening);
  rows.push(...transactions);
  if (closing) rows.push(closing);

  return {
    bankName: "State Bank of India",
    transactions: rows,
  };
}
