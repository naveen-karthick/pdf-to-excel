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

const CORPORATE_TXN_START_RE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;

const CORPORATE_AMOUNT_SUFFIX_RE =
  /(\d{4,5})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;

const CORPORATE_OPENING_BALANCE_RE =
  /^Opening Balance as on .+?:\s*([\d,]+\.\d{2})/i;

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

function isCorporateSkipLine(line: string): boolean {
  return (
    /^Date\s*:/i.test(line) ||
    /^Account Number/i.test(line) ||
    /^Description\s*:/i.test(line) ||
    /^Name\s*:/i.test(line) ||
    /^Currency\s*:/i.test(line) ||
    /^Branch\s*:/i.test(line) ||
    /^Rate of Interest/i.test(line) ||
    /^IFS Code/i.test(line) ||
    /^Book Balance/i.test(line) ||
    /^Available Balance/i.test(line) ||
    /^Hold Value/i.test(line) ||
    /^MOD Balance/i.test(line) ||
    /^Uncleared Amount/i.test(line) ||
    /^Account Statement from/i.test(line) ||
    /^The number of transactions/i.test(line) ||
    /^Corporate Address/i.test(line) ||
    /^Txn Date/i.test(line) ||
    /^No\.\s*Branch/i.test(line) ||
    /^Code\s+Debit/i.test(line) ||
    /^Description Ref/i.test(line) ||
    /^-- \d+ of \d+ --$/i.test(line) ||
    /^\*\*This is a computer generated/i.test(line)
  );
}

function isCorporateStatement(text: string): boolean {
  return (
    /IFS Code\s*:\s*SBIN/i.test(text) &&
    /Account Statement from/i.test(text) &&
    /Txn Date\s+Value Date/i.test(text)
  );
}

function classifyCorporateDirection(description: string): "deposit" | "withdrawal" {
  const upper = description.toUpperCase();

  if (
    /^BY TRANSFER|CHEQUE DEPOSIT|CREDIT|\bCR-|\bCR\b/.test(upper)
  ) {
    return "deposit";
  }

  if (
    /^TO TRANSFER|CHEQUE WDL|CHQ TRANSFER|TO CLEARING|WITHDRAWAL|\bDR-|\bDR\b/.test(
      upper,
    )
  ) {
    return "withdrawal";
  }

  return "withdrawal";
}

function extractCorporateTranId(middleLines: string[], amountLine: string): string {
  const prefix = amountLine.replace(CORPORATE_AMOUNT_SUFFIX_RE, "").trim();
  const prefixRef =
    prefix.match(/(\d{10,13})\s*\/?\s*$/)?.[1] ??
    prefix.match(/(\d{10,13})\s*\//)?.[1];
  if (prefixRef) return prefixRef;

  for (const line of middleLines) {
    const utr = line.match(/UTR NO:\s*(\S+)/i)?.[1];
    if (utr) return utr.replace(/-$/, "");

    const neft = line.match(/NEFT INB:\s*(\S+)/i)?.[1];
    if (neft) return neft;

    const longNum = line.match(/^(\d{10,13})\s*\/?$/)?.[1];
    if (longNum) return longNum;
  }

  return "";
}

function parseCorporateOpening(text: string): Transaction | null {
  for (const rawLine of text.split("\n")) {
    const match = rawLine.trim().match(CORPORATE_OPENING_BALANCE_RE);
    if (!match) continue;

    return {
      date: "",
      valueDate: "",
      particulars: "Opening Balance",
      tranType: "",
      tranId: "",
      chequeDetails: "",
      withdrawals: "",
      deposits: "",
      balance: parseAmount(match[1]),
      balanceType: "CR",
    };
  }

  return null;
}

function parseCorporateTransactions(text: string): Transaction[] {
  const lines = text.split("\n");
  const transactions: Transaction[] = [];
  let pendingDate = "";
  let pendingValueDate = "";
  let pendingDescription = "";
  let pendingNarration: string[] = [];

  const resetPending = () => {
    pendingDate = "";
    pendingValueDate = "";
    pendingDescription = "";
    pendingNarration = [];
  };

  const completePendingTransaction = (line: string) => {
    if (!pendingDate) return;

    const suffixMatch = line.match(CORPORATE_AMOUNT_SUFFIX_RE);
    if (!suffixMatch) return;

    const [, , amountRaw, balanceRaw] = suffixMatch;
    const particulars = normalizeParticulars(
      [pendingDescription, ...pendingNarration].filter(Boolean).join(" "),
    );
    const direction = classifyCorporateDirection(pendingDescription);
    const tranId = extractCorporateTranId(pendingNarration, line);

    transactions.push({
      date: formatDateFromSlash(pendingDate),
      valueDate: formatDateFromSlash(pendingValueDate),
      particulars,
      tranType: direction === "deposit" ? "DEP" : "WDL",
      tranId,
      chequeDetails: "",
      withdrawals: direction === "withdrawal" ? parseAmount(amountRaw) : "",
      deposits: direction === "deposit" ? parseAmount(amountRaw) : "",
      balance: parseAmount(balanceRaw),
      balanceType: "CR",
    });

    resetPending();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isCorporateSkipLine(line)) {
      continue;
    }

    const startMatch = line.match(CORPORATE_TXN_START_RE);
    if (startMatch) {
      resetPending();
      pendingDate = startMatch[1];
      pendingValueDate = startMatch[2];
      pendingDescription = startMatch[3].trim();
      continue;
    }

    if (CORPORATE_AMOUNT_SUFFIX_RE.test(line) && pendingDate) {
      completePendingTransaction(line);
      continue;
    }

    if (pendingDate) {
      pendingNarration.push(line);
    }
  }

  return transactions;
}

function parseCorporateSbiStatement(text: string): ParseResult {
  const opening = parseCorporateOpening(text);
  const transactions = parseCorporateTransactions(text);

  const rows: Transaction[] = [];
  if (opening) rows.push(opening);
  rows.push(...transactions);

  return {
    bankName: "State Bank of India",
    transactions: rows,
  };
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
  return (
    /(?:RTGS\/NEFT IFSC|IFS Code)\s*:\s*SBIN/i.test(text) ||
    /State Bank of India/i.test(text)
  );
}

export function parseSbiStatement(text: string): ParseResult {
  if (isCorporateStatement(text)) {
    return parseCorporateSbiStatement(text);
  }

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
