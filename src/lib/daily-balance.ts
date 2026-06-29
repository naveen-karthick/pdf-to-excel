import type { Transaction } from "@/lib/types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseDisplayDate(date: string): Date {
  const [day, month, year] = date.split("-");
  const monthIndex = MONTHS.indexOf(month);
  return new Date(Number(year), monthIndex, Number(day));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildDailyBalanceSheet(transactions: Transaction[]): unknown[][] {
  const endOfDayBalances = new Map<string, number>();
  const monthColumns = new Set<string>();

  for (const transaction of transactions) {
    const date = parseDisplayDate(transaction.date);
    const key = monthKey(date);
    monthColumns.add(key);
    endOfDayBalances.set(
      `${key}-${date.getDate()}`,
      transaction.balance,
    );
  }

  const sortedMonths = [...monthColumns].sort();
  const header = ["Day of month", "Average", ...sortedMonths];
  const rows: unknown[][] = [header];

  for (let day = 1; day <= 31; day += 1) {
    const row: unknown[] = [String(day)];
    const dayValues: number[] = [];
    const monthValues: Array<number | ""> = [];

    for (const month of sortedMonths) {
      let value: number | "" = "";
      for (let previousDay = day; previousDay >= 1; previousDay -= 1) {
        const lookup = endOfDayBalances.get(`${month}-${previousDay}`);
        if (lookup !== undefined) {
          value = lookup;
          break;
        }
      }

      monthValues.push(value);
      if (value !== "") dayValues.push(value);
    }

    row.push(Number(average(dayValues).toFixed(1)));
    row.push(...monthValues);
    rows.push(row);
  }

  const medianRow: unknown[] = ["Median"];
  const averageRow: unknown[] = ["Average"];

  for (let column = 1; column < header.length; column += 1) {
    const values = rows
      .slice(1)
      .map((row) => row[column])
      .filter((value): value is number => typeof value === "number");

    medianRow.push(Number(median(values).toFixed(2)));
    averageRow.push(Number(average(values).toFixed(2)));
  }

  rows.push(medianRow, averageRow);
  return rows;
}
