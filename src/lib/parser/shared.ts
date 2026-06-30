export function parseAmount(value: string): number {
  return parseFloat(value.replace(/,/g, ""));
}

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

export function formatDateFromDash(date: string): string {
  const [day, month, year] = date.split("-");
  return `${day}-${MONTHS[parseInt(month, 10) - 1]}-${year}`;
}

export function formatDateFromSlash(date: string): string {
  const [day, month, yearRaw] = date.split("/");
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${day}-${MONTHS[parseInt(month, 10) - 1]}-${year}`;
}

export function normalizeParticulars(text: string): string {
  return text.replace(/\s+/g, " ").replace(/([A-Za-z0-9]) \//g, "$1/").trim();
}
