import { NextRequest, NextResponse } from "next/server";

import { buildDownloadFilename, generateExcelBuffer } from "@/lib/excel/generator";
import {
  isFederalBankStatement,
  parseFederalBankStatement,
} from "@/lib/parser/federal-bank";
import { extractPdfText } from "@/lib/pdf/extract-text";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer);

    if (!isFederalBankStatement(text)) {
      return NextResponse.json(
        {
          error:
            "This PDF format is not supported yet. Currently, Federal Bank account statements are supported.",
        },
        { status: 422 },
      );
    }

    const { transactions } = parseFederalBankStatement(text);

    if (!transactions.length) {
      return NextResponse.json(
        { error: "No transactions were found in this statement." },
        { status: 422 },
      );
    }

    const excelBuffer = generateExcelBuffer(transactions);
    const filename = buildDownloadFilename(file.name);

    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Transaction-Count": String(transactions.length),
      },
    });
  } catch (error) {
    console.error("Conversion failed:", error);
    return NextResponse.json(
      { error: "Failed to convert the PDF. Please try another statement." },
      { status: 500 },
    );
  }
}
