export type BankId = "federal" | "sbi" | "hdfc";

export function detectBank(text: string): BankId | null {
  if (/THE FEDERAL BANK LTD\./i.test(text) || /Statement of Account for the period/i.test(text)) {
    return "federal";
  }

  if (/State Bank of India/i.test(text) || /SBIN\d{7}/i.test(text)) {
    return "sbi";
  }

  if (/HDFC BANK/i.test(text) || /HDFCBank/i.test(text) || /www\.hdfcbank\.com/i.test(text)) {
    return "hdfc";
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
