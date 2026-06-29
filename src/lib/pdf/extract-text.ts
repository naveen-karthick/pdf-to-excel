let environmentReady = false;

async function ensurePdfEnvironment(): Promise<{
  PDFParse: typeof import("pdf-parse").PDFParse;
  CanvasFactory: typeof import("pdf-parse/worker").CanvasFactory;
}> {
  if (typeof globalThis.DOMMatrix === "undefined") {
    const { default: DOMMatrix } = await import("@thednp/dommatrix");
    globalThis.DOMMatrix = DOMMatrix as typeof globalThis.DOMMatrix;
  }

  const worker = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");

  if (!environmentReady) {
    PDFParse.setWorker(worker.getData());
    environmentReady = true;
  }

  return { PDFParse, CanvasFactory: worker.CanvasFactory };
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse, CanvasFactory } = await ensurePdfEnvironment();
  const parser = new PDFParse({ data: buffer, CanvasFactory });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
