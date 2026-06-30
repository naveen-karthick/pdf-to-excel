import type { ParseResult, Transaction } from "@/lib/types";

import {
  formatDateFromSlash,
  normalizeParticulars,
  parseAmount,
} from "@/lib/parser/shared";

const TXN_DATE_START_RE = /^(\d{2}\/\d{2}\/\d{2,4})\s+/;

const AMOUNTS_SUFFIX_RE =
  /\s+(\d{2}\/\d{2}\/\d{2,4})\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?$/;

const SUMMARY_DATA_RE =
  /^([\d,]+\.\d{2})\s+\d+\s+\d+\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;

const PAGE_BREAK_RE = /^-- \d+ of \d+ --$/;

function isSkipLine(line: string): boolean {
  return (
    /^HDFC BANK/i.test(line) ||
    /^Page No/i.test(line) ||
    /^Account Branch/i.test(line) ||
    /^Statement of account/i.test(line) ||
    /^Date\s+Narration/i.test(line) ||
    /^Chq\./i.test(line) ||
    /^Withdrawal Amt/i.test(line) ||
    /^Closing Balance Dr Count/i.test(line) ||
    /^Generated On/i.test(line) ||
    /^This is a computer generated/i.test(line) ||
    /^STATEMENT SUMMARY/i.test(line) ||
    /^Opening Balance Dr Count/i.test(line) ||
    SUMMARY_DATA_RE.test(line) ||
    /^MS\s+/i.test(line) ||
    /^M\/S\./i.test(line) ||
    /^TC \d/i.test(line) ||
    /^FIRST FLOOR/i.test(line) ||
    /^Statement From\s*:/i.test(line) ||
    /^P O,/i.test(line) ||
    /^KUMARAPURAM,/i.test(line) ||
    /^THIRUVANANTHAPURAM \d/i.test(line) ||
    /^THIRUVANANTHAPURAM MEDICAL COLLEGE/i.test(line) ||
    /^KERALA$/i.test(line) ||
    /^JOINT HOLDERS|^Nomination\s*:|^Address\s*:|^City\s*:|^State\s*:|^Phone no|^OD Limit|^Currency\s*:|^Email\s*:|^Cust ID|^Account No|^A\/C Open|^Account Status|^RTGS\/NEFT|^Branch Code|^Account Type|^\*Closing balance|^Contents of this|^this statement|^State account|^Registered Office|^HDFC Bank GSTIN|^not require signature/i.test(
      line,
    )
  );
}

function isTrailingNarrationLine(line: string): boolean {
  if (TXN_DATE_START_RE.test(line) || AMOUNTS_SUFFIX_RE.test(line)) {
    return false;
  }

  if (isSkipLine(line) || PAGE_BREAK_RE.test(line)) {
    return false;
  }

  return true;
}

function classifyTransactionAmount(
  narration: string,
  amount: number,
  balance: number,
  previousBalance: number | null,
): "withdrawal" | "deposit" {
  if (previousBalance !== null) {
    const diff = balance - previousBalance;
    if (Math.abs(diff - amount) < 0.01) return "deposit";
    if (Math.abs(diff + amount) < 0.01) return "withdrawal";
  } else if (Math.abs(balance - amount) < 0.01 && amount > 0) {
    return "deposit";
  }

  const upper = narration.toUpperCase();

  if (/\bCREDIT CARD\b/.test(upper)) {
    return "withdrawal";
  }

  if (/\bNEFT CR\b|\bRTGS CR\b|\bUPI CR\b|\bIMPS CR\b|\bCR-/.test(upper)) {
    return "deposit";
  }

  if (/\bCASH DEPOSIT\b|\bUPI SETTLEMENT\b/.test(upper)) {
    return "deposit";
  }

  if (
    /\bNEFT DR\b|\bRTGS DR\b|\bUPI DR\b|\bIMPS DR\b|\bDR-|\bDR\b|DEBIT|CHARGE|CHG|P2P|\.IMPS P2P/.test(
      upper,
    )
  ) {
    return "withdrawal";
  }

  return "withdrawal";
}

function buildTransaction(
  date: string,
  valueDate: string,
  particulars: string,
  refNo: string,
  withdrawal?: string,
  deposit?: string,
  balance?: string,
): Transaction {
  return {
    date: formatDateFromSlash(date),
    valueDate: formatDateFromSlash(valueDate),
    particulars: normalizeParticulars(particulars),
    tranType: "",
    tranId: refNo,
    chequeDetails: "",
    withdrawals: withdrawal ? parseAmount(withdrawal) : "",
    deposits: deposit ? parseAmount(deposit) : "",
    balance: balance ? parseAmount(balance) : "",
    balanceType: balance ? "CR" : "",
  };
}

function parseAmountSuffix(
  line: string,
  narration: string,
  txnDate: string,
  refPrefix: string,
  previousBalance: number | null,
): { transaction: Transaction; balance: number } | null {
  const suffixMatch = line.match(AMOUNTS_SUFFIX_RE);
  if (!suffixMatch) return null;

  const [, valueDate, firstAmount, secondAmount] = suffixMatch;
  if (!secondAmount) return null;

  const refNo = refPrefix.trim() || narration.match(/\b(\d{8,})\b/)?.[1] || "";
  const particulars = refPrefix
    ? normalizeParticulars([narration, refPrefix].filter(Boolean).join(" "))
    : normalizeParticulars(narration);
  const amount = parseAmount(firstAmount);
  const balance = parseAmount(secondAmount);
  const kind = classifyTransactionAmount(particulars, amount, balance, previousBalance);

  const transaction = buildTransaction(
    txnDate,
    valueDate,
    particulars,
    refNo,
    kind === "withdrawal" ? firstAmount : undefined,
    kind === "deposit" ? firstAmount : undefined,
    secondAmount,
  );

  return { transaction, balance };
}

function parseSingleLineTransaction(
  line: string,
  previousBalance: number | null,
): { transaction: Transaction; balance: number } | null {
  const dateMatch = line.match(TXN_DATE_START_RE);
  if (!dateMatch) return null;

  const suffixMatch = line.match(AMOUNTS_SUFFIX_RE);
  if (!suffixMatch) return null;

  const txnDate = dateMatch[1];
  const narration = line.slice(dateMatch[0].length, suffixMatch.index).trim();

  return parseAmountSuffix(line, narration, txnDate, "", previousBalance);
}

function parseStatementSummary(text: string): {
  opening: Transaction | null;
  closing: Transaction | null;
} {
  const lines = text.split("\n").map((line) => line.trim());
  let opening: Transaction | null = null;
  let closing: Transaction | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^Opening Balance Dr Count/i.test(lines[index] ?? "")) continue;

    const dataLine = lines[index + 1]?.trim();
    if (!dataLine) break;

    const match = dataLine.match(SUMMARY_DATA_RE);
    if (!match) break;

    opening = {
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

    closing = {
      date: "",
      valueDate: "",
      particulars: "GRAND TOTAL",
      tranType: "",
      tranId: "",
      chequeDetails: "",
      withdrawals: parseAmount(match[2]),
      deposits: parseAmount(match[3]),
      balance: parseAmount(match[4]),
      balanceType: "CR",
    };
    break;
  }

  return { opening, closing };
}

function parseTransactions(text: string, openingBalance: number | null = null): Transaction[] {
  const lines = text.split("\n");
  const transactions: Transaction[] = [];
  let previousBalance = openingBalance;

  let pendingDate = "";
  let pendingNarration: string[] = [];
  let lastTransactionIndex = -1;
  let acceptTrailingNarration = false;
  let afterPageBreak = false;
  let pageBreakOrphans: string[] = [];

  const resetPending = () => {
    pendingDate = "";
    pendingNarration = [];
  };

  const appendToLastTransaction = (line: string) => {
    if (lastTransactionIndex < 0) return;
    const txn = transactions[lastTransactionIndex];
    txn.particulars = normalizeParticulars(`${txn.particulars} ${line}`);
  };

  const flushPageBreakOrphans = () => {
    if (pageBreakOrphans.length === 0) {
      return;
    }

    appendToLastTransaction(pageBreakOrphans.join(" "));
    pageBreakOrphans = [];
  };

  const appendPendingNarration = (line: string) => {
    pendingNarration.push(line);
  };

  const completePendingTransaction = (line: string, refPrefix: string) => {
    if (!pendingDate) return;

    const parsed = parseAmountSuffix(
      line,
      pendingNarration.join(" "),
      pendingDate,
      refPrefix,
      previousBalance,
    );
    if (!parsed) return;

    transactions.push(parsed.transaction);
    lastTransactionIndex = transactions.length - 1;
    previousBalance = parsed.balance;
    resetPending();
    acceptTrailingNarration = true;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (PAGE_BREAK_RE.test(line)) {
      afterPageBreak = true;
      pageBreakOrphans = [];
      acceptTrailingNarration = false;
      continue;
    }

    if (afterPageBreak) {
      if (isSkipLine(line)) {
        continue;
      }

      if (TXN_DATE_START_RE.test(line)) {
        flushPageBreakOrphans();
        afterPageBreak = false;
      } else {
        pageBreakOrphans.push(line);
        continue;
      }
    }

    if (isSkipLine(line)) {
      if (/^Page No/i.test(line) || /^STATEMENT SUMMARY/i.test(line) || SUMMARY_DATA_RE.test(line)) {
        acceptTrailingNarration = false;
      }
      continue;
    }

    const singleLine = parseSingleLineTransaction(line, previousBalance);
    if (singleLine) {
      resetPending();
      acceptTrailingNarration = false;
      transactions.push(singleLine.transaction);
      lastTransactionIndex = transactions.length - 1;
      previousBalance = singleLine.balance;
      acceptTrailingNarration = true;
      continue;
    }

    const dateMatch = line.match(TXN_DATE_START_RE);
    if (dateMatch) {
      resetPending();
      acceptTrailingNarration = false;
      pendingDate = dateMatch[1];
      pendingNarration = [line.slice(dateMatch[0].length).trim()].filter(Boolean);
      continue;
    }

    const suffixMatch = line.match(AMOUNTS_SUFFIX_RE);
    if (suffixMatch && pendingDate) {
      const refPrefix = line.slice(0, suffixMatch.index).trim();
      completePendingTransaction(line, refPrefix);
      continue;
    }

    if (pendingDate) {
      appendPendingNarration(line);
      continue;
    }

    if (acceptTrailingNarration && isTrailingNarrationLine(line)) {
      appendToLastTransaction(line);
    }
  }

  flushPageBreakOrphans();

  return transactions;
}

export function isHdfcStatement(text: string): boolean {
  return /HDFC BANK/i.test(text) || /HDFCBank/i.test(text) || /www\.hdfcbank\.com/i.test(text);
}

export function parseHdfcStatement(text: string): ParseResult {
  const { opening, closing } = parseStatementSummary(text);
  const openingBalance =
    opening && opening.balance !== ""
      ? typeof opening.balance === "number"
        ? opening.balance
        : parseAmount(String(opening.balance))
      : null;
  const transactions = parseTransactions(text, openingBalance);

  const rows: Transaction[] = [];
  if (opening) rows.push(opening);
  rows.push(...transactions);
  if (closing) rows.push(closing);

  return {
    bankName: "HDFC Bank",
    transactions: rows,
  };
}
