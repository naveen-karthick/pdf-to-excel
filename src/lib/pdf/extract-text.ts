let polyfillsApplied = false;

async function ensurePdfPolyfills(): Promise<void> {
  if (polyfillsApplied) {
    return;
  }

  if (typeof globalThis.DOMMatrix === "undefined") {
    const { default: DOMMatrix } = await import("@thednp/dommatrix");
    globalThis.DOMMatrix = DOMMatrix as typeof globalThis.DOMMatrix;
  }

  polyfillsApplied = true;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  await ensurePdfPolyfills();

  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
