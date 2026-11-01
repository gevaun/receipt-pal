import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DailySpendChart } from "../components/DailySpendChart";
import { ArrowIcon, ScanIcon } from "../components/icons";
import { PageHeader } from "../components/Layout";
import { MonthStepper } from "../components/MonthStepper";
import { Banner, Button, Eyebrow } from "../components/ui";
import { isExpense } from "../lib/api";
import { useTransactions } from "../lib/data";
import { currentMonth, formatMoney, monthBounds, monthLabel, shiftMonth, shortDate, splitMoney } from "../lib/format";

export function Dashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth);
  const bounds = monthBounds(month);
  const previousBounds = monthBounds(shiftMonth(month, -1));
  const current = useTransactions(bounds.start, bounds.end);
  const previous = useTransactions(previousBounds.start, previousBounds.end);

  const expenses = useMemo(() => (current.data ?? []).filter(isExpense), [current.data]);
  const total = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const previousTotal = (previous.data ?? []).filter(isExpense).reduce((sum, tx) => sum + tx.amount, 0);
  const change = previous.data && previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null;

  const daily = useMemo(() => {
    const days = Array<number>(bounds.days).fill(0);
    for (const tx of expenses) {
      const day = Number(tx.date.slice(8, 10));
      if (day >= 1 && day <= bounds.days) days[day - 1] += tx.amount;
    }
    return days;
  }, [expenses, bounds.days]);
  const now = new Date();
  const todayIndex = now.getFullYear() === month.year && now.getMonth() === month.month ? now.getDate() - 1 : null;

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of expenses) totals.set(tx.category || "Uncategorised", (totals.get(tx.category || "Uncategorised") ?? 0) + tx.amount);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [expenses]);

  const { whole, cents } = splitMoney(total);
  const loading = current.loading && !current.data;

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-7 md:px-10">
      <PageHeader eyebrow="Overview" title={monthLabel(month)} titleClass="min-w-[13rem]">
        <MonthStepper month={month} onChange={setMonth} />
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => navigate("/transactions?new=1")}>
            Add manually
          </Button>
          <Button onClick={() => navigate("/scan")}>
            <ScanIcon />
            Scan receipt
          </Button>
        </div>
      </PageHeader>

      {current.error && <Banner>{current.error}</Banner>}

      <section className="mt-2">
        <Eyebrow>Spent this month</Eyebrow>
        <div className="tabular mt-3 mb-3 text-[64px] leading-none font-light tracking-[-0.055em]">
          {loading ? <span className="shimmer-bar inline-block h-14 w-72 rounded-lg align-middle" /> : (
            <>
              ${whole}
              <span className="text-[32px] tracking-[-0.03em] text-muted">.{cents}</span>
            </>
          )}
        </div>
        <div className="flex gap-4 text-[12px] text-muted">
          <span>
            <b className="font-medium text-fg">{expenses.length}</b> {expenses.length === 1 ? "expense" : "expenses"}
          </span>
          {change !== null && (
            <span>
              <b className="font-medium text-fg">
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}%
              </b>{" "}
              vs {new Date(previousBounds.start + "T00:00").toLocaleDateString("en-US", { month: "short" })}
            </span>
          )}
        </div>
      </section>

      <div className="mt-10">
        <DailySpendChart daily={daily} month={month} todayIndex={todayIndex} />
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.3fr]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[13.5px] font-medium">Categories</h2>
            <Link to="/categories" className="text-[11.5px] text-muted hover:text-fg">
              {categories.length}
            </Link>
          </div>
          {categories.length === 0 && !loading && <p className="text-[12.5px] text-muted">Nothing yet this month.</p>}
          {categories.map(([name, amount]) => (
            <div key={name} className="mb-4">
              <div className="flex justify-between text-[12.5px]">
                <span>{name}</span>
                <span className="tabular font-mono text-[11.5px] text-muted">{formatMoney(amount)}</span>
              </div>
              <div className="mt-2 h-[3px] rounded-full bg-track">
                <div className="h-full rounded-full bg-fg" style={{ width: `${Math.max((amount / total) * 100, 1)}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[13.5px] font-medium">Recent</h2>
            <Link to="/transactions" className="text-[11.5px] text-muted hover:text-fg">
              View all
            </Link>
          </div>
          {expenses.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-muted">
              No expenses in {monthLabel(month)}.{" "}
              <Link to="/scan" className="text-lime hover:underline">
                Scan a receipt
              </Link>
            </div>
          )}
          <ul>
            {expenses.slice(0, 6).map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 border-t border-line py-2.5 last:border-b">
                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-raise text-muted">
                  <ArrowIcon className="size-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px]">{tx.merchant || "—"}</div>
                  <div className="text-[11px] text-muted">
                    {shortDate(tx.date)} · {tx.subCategory || tx.category}
                  </div>
                </div>
                <span className="tabular font-mono text-[12.5px] font-medium">{formatMoney(tx.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
