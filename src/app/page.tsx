"use client";

import { useMemo, useState } from "react";

import { convertPdfFileToExcel } from "@/lib/convert";
import {
  PdfPasswordIncorrectError,
  PdfPasswordRequiredError,
} from "@/lib/pdf/errors";

type Status = "idle" | "converting" | "success" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [bankName, setBankName] = useState<string | null>(null);

  const canConvert = useMemo(
    () => !!file && status !== "converting" && (!needsPassword || password.length > 0),
    [file, status, needsPassword, password],
  );

  function resetStatus() {
    setStatus("idle");
    setMessage("");
    setTransactionCount(null);
    setBankName(null);
  }

  async function handleConvert() {
    if (!file) return;

    setStatus("converting");
    setMessage("");
    setTransactionCount(null);
    setBankName(null);

    try {
      const result = await convertPdfFileToExcel(
        file,
        needsPassword || password ? password : undefined,
      );

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);

      setNeedsPassword(false);
      setStatus("success");
      setTransactionCount(result.transactionCount);
      setBankName(result.bankName);
      setMessage("Excel file downloaded successfully.");
    } catch (error) {
      if (error instanceof PdfPasswordRequiredError) {
        setNeedsPassword(true);
        setStatus("error");
        setMessage(error.message);
        return;
      }

      if (error instanceof PdfPasswordIncorrectError) {
        setNeedsPassword(true);
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Conversion failed.");
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
            PDF to Excel
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Convert bank statements to Excel
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Upload a bank statement PDF and download a structured Excel workbook.
            Supports Federal Bank, SBI, and HDFC. Everything runs in your browser,
            so your statement never leaves your device.
          </p>

          <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-slate-950/40 p-6">
            <label
              htmlFor="pdf-upload"
              className="flex cursor-pointer flex-col items-center gap-3 text-center"
            >
              <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
                Choose PDF file
              </div>
              <span className="text-sm text-slate-400">
                {file ? file.name : "No file selected"}
              </span>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0] ?? null;
                  setFile(selected);
                  setPassword("");
                  setNeedsPassword(false);
                  resetStatus();
                }}
              />
            </label>
          </div>

          {needsPassword ? (
            <div className="mt-4">
              <label htmlFor="pdf-password" className="text-sm text-slate-300">
                PDF password
              </label>
              <input
                id="pdf-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  resetStatus();
                }}
                placeholder="Enter PDF password"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none ring-emerald-400/40 focus:ring-2"
              />
              <p className="mt-2 text-xs text-slate-500">
                The password is used only in your browser to unlock the PDF. The Excel
                file is saved without any password.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            disabled={!canConvert}
            onClick={handleConvert}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {status === "converting" ? "Converting..." : "Convert to Excel"}
          </button>

          {message ? (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                status === "error"
                  ? "bg-red-500/10 text-red-200"
                  : "bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {message}
              {bankName ? ` Detected bank: ${bankName}.` : null}
              {transactionCount ? ` Extracted ${transactionCount} transactions.` : null}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <h2 className="text-sm font-semibold text-white">Transactions sheet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Date, value date, particulars, transaction type, IDs, amounts,
                and running balance.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
              <h2 className="text-sm font-semibold text-white">Daily Balance sheet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                End-of-day balances by month with average and median summaries.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Client-side conversion with pdf-parse and xlsx-js-style.
        </p>
      </main>
    </div>
  );
}
