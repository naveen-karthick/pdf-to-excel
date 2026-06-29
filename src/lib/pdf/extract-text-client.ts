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

export async function extractPdfTextFromFile(file: File): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  await configurePdfWorker(PDFParse);

  const data = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
