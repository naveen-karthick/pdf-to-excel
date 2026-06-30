export class PdfPasswordRequiredError extends Error {
  constructor(message = "This PDF is password protected. Please enter the password.") {
    super(message);
    this.name = "PdfPasswordRequiredError";
  }
}

export class PdfPasswordIncorrectError extends Error {
  constructor(message = "Incorrect PDF password. Please try again.") {
    super(message);
    this.name = "PdfPasswordIncorrectError";
  }
}

export function mapPdfParseError(error: unknown): Error {
  if (error instanceof Error && error.name === "PasswordException") {
    const message = error.message.toLowerCase();
    if (message.includes("no password given") || message.includes("need a password")) {
      return new PdfPasswordRequiredError();
    }
    return new PdfPasswordIncorrectError();
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Failed to read the PDF.");
}
