import { useMemo, useState } from "react";
import { PageHeader } from "../components/Layout";
import { MonthStepper } from "../components/MonthStepper";
import { Banner } from "../components/ui";
import { isExpense } from "../lib/api";
import { useLookups, useTransactions } from "../lib/data";
import { currentMonth, formatMoney, monthBounds, monthLabel } from "../lib/format";

interface Row {
  id: string;
  name: string;
  total: number;
  subs: { id: string; name: string; total: number }[];
}

export function Categories() {
  const [month, setMonth] = useState(currentMonth);
  const bounds = monthBounds(month);
  const query = useTransactions(bounds.start, bounds.end);
  const lookups = useLookups();

  const rows = useMemo(() => {
    const byId = new Map<string, Row>();
    for (const c of lookups.categories) {
      byId.set(c.id, { id: c.id, name: c.name, total: 0, subs: c.subs.map((s) => ({ ...s, total: 0 })) });
    }
    for (const tx of (query.data ?? []).filter(isExpense)) {
      const row = byId.get(tx.categoryId) ?? { id: tx.categoryId, name: tx.category, total: 0, subs: [] };
      row.total += tx.amount;
      const sub = row.subs.find((s) => s.id === tx.subCategoryId);
      if (sub) sub.total += tx.amount;
      else if (tx.subCategoryId) row.subs.push({ id: tx.subCategoryId, name: tx.subCategory, total: tx.amount });
      byId.set(row.id, row);
    }
    const sorted = [...byId.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    for (const row of sorted) row.subs.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    return sorted;
  }, [lookups.categories, query.data]);

  const total = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-7 md:px-10">
      <PageHeader eyebrow="Spending by category" title={monthLabel(month)} titleClass="min-w-[13rem]">
        <MonthStepper month={month} onChange={setMonth} />
        <span className="tabular mb-1 ml-auto font-mono text-[13px]">{formatMoney(total)}</span>
      </PageHeader>

      {query.error && <Banner>{query.error}</Banner>}
      {query.data && rows.length === 0 && <p className="text-[12.5px] text-muted">No categories yet. Add an expense to get started.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <section key={row.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14px] font-medium">{row.name}</h2>
              <span className={`tabular font-mono text-[13px] ${row.total ? "" : "text-muted"}`}>{formatMoney(row.total)}</span>
            </div>
            <div className="mt-2.5 mb-3 h-[3px] rounded-full bg-track">
              <div className="h-full rounded-full bg-lime" style={{ width: total ? `${(row.total / total) * 100}%` : 0 }} />
            </div>
            <ul className="flex flex-col gap-1.5">
              {row.subs.map((sub) => (
                <li key={sub.id} className="flex justify-between text-[12px] text-muted">
                  <span>{sub.name}</span>
                  <span className="tabular font-mono">{formatMoney(sub.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
