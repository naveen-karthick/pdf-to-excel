const PDF_PARSE_VERSION = "2.4.5";
const PDF_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdf-parse@${PDF_PARSE_VERSION}/dist/pdf-parse/web/pdf.worker.mjs`;

let workerConfigured = false;

async function configurePdfWorker(PDFParse: typeof import("pdf-parse").PDFParse) {
  if (workerConfigured) {
    return;
  }

  PDFParse.setWorker(PDF_WORKER_URL);
  workerConfigured = true;
}

export async function extractPdfTextFromFile(file: File, password?: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const { mapPdfParseError } = await import("@/lib/pdf/errors");

  await configurePdfWorker(PDFParse);

  const data = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data, password });

  try {
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw mapPdfParseError(error);
  } finally {
    await parser.destroy();
  }
}
