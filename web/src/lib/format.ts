const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(value: number): string {
  return money.format(value);
}

export function splitMoney(value: number): { whole: string; cents: string } {
  const [whole, cents] = money.format(value).split(".");
  return { whole, cents };
}

export interface Month {
  year: number;
  /** 0-based, like Date#getMonth. */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
}

export function currentMonth(): Month {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function monthBounds({ year, month }: Month): { start: string; end: string; days: number } {
  const last = new Date(year, month + 1, 0);
  return { start: toISODate(new Date(year, month, 1)), end: toISODate(last), days: last.getDate() };
}

export function monthLabel({ year, month }: Month): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-10-25" -> "25 Oct" */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${pad(day)} ${new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short" })}`;
}
