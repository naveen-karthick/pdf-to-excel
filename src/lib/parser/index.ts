import { detectBank, getBankDisplayName } from "@/lib/parser/detect-bank";
import { parseFederalBankStatement } from "@/lib/parser/federal-bank";
import { parseHdfcStatement } from "@/lib/parser/hdfc";
import { parseSbiStatement } from "@/lib/parser/sbi";
import type { ParseResult } from "@/lib/types";

export function parseBankStatement(text: string): ParseResult {
  const bank = detectBank(text);

  if (!bank) {
    throw new Error(
      "This PDF format is not supported yet. Supported banks: Federal Bank, SBI, and HDFC.",
    );
  }

  switch (bank) {
    case "federal":
      return parseFederalBankStatement(text);
    case "sbi":
      return parseSbiStatement(text);
    case "hdfc":
      return parseHdfcStatement(text);
    default:
      throw new Error(`Unsupported bank: ${getBankDisplayName(bank)}`);
  }
}

export { detectBank, getBankDisplayName };
