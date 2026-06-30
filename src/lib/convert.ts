import { buildDownloadFilename, generateExcelArrayBuffer } from "@/lib/excel/generator";
import { parseBankStatement } from "@/lib/parser";
import { extractPdfTextFromFile } from "@/lib/pdf/extract-text-client";

export interface ConvertResult {
  blob: Blob;
  filename: string;
  transactionCount: number;
  bankName: string;
}

export async function convertPdfFileToExcel(
  file: File,
  password?: string,
): Promise<ConvertResult> {
  const text = await extractPdfTextFromFile(file, password);
  const { transactions, bankName } = parseBankStatement(text);

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
    bankName,
  };
}
