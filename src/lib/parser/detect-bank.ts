export type BankId = "federal" | "sbi" | "hdfc";

const ACCOUNT_IFSC_RE = /(?:RTGS\/NEFT IFSC|IFS Code)\s*:\s*(HDFC|SBIN)/i;

export function detectBank(text: string): BankId | null {
  if (/THE FEDERAL BANK LTD\./i.test(text) || /Statement of Account for the period/i.test(text)) {
    return "federal";
  }

  const accountIfsc = text.match(ACCOUNT_IFSC_RE)?.[1]?.toUpperCase();
  if (accountIfsc === "HDFC") {
    return "hdfc";
  }
  if (accountIfsc === "SBIN") {
    return "sbi";
  }

  if (/HDFC BANK/i.test(text) || /HDFCBank/i.test(text) || /www\.hdfcbank\.com/i.test(text)) {
    return "hdfc";
  }

  if (/State Bank of India/i.test(text)) {
    return "sbi";
  }

  return null;
}

export function getBankDisplayName(bank: BankId): string {
  switch (bank) {
    case "federal":
      return "Federal Bank";
    case "sbi":
      return "State Bank of India";
    case "hdfc":
      return "HDFC Bank";
    default:
      return bank;
  }
}
