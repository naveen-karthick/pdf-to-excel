import { buildDownloadFilename, generateExcelArrayBuffer } from "@/lib/excel/generator";
import {
  isFederalBankStatement,
  parseFederalBankStatement,
} from "@/lib/parser/federal-bank";
import { extractPdfTextFromFile } from "@/lib/pdf/extract-text-client";

export interface ConvertResult {
  blob: Blob;
  filename: string;
  transactionCount: number;
}

export async function convertPdfFileToExcel(file: File): Promise<ConvertResult> {
  const text = await extractPdfTextFromFile(file);

  if (!isFederalBankStatement(text)) {
    throw new Error(
      "This PDF format is not supported yet. Currently, Federal Bank account statements are supported.",
    );
  }

  const { transactions } = parseFederalBankStatement(text);

  if (!transactions.length) {
    throw new Error("No transactions were found in this statement.");
  }

  const excelBuffer = generateExcelArrayBuffer(transactions);
  const filename = buildDownloadFilename(file.name);

  return {
    blob: new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
    transactionCount: transactions.length,
  };
}
