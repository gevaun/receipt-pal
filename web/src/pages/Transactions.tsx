import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ExpenseDrawer, type DrawerState } from "../components/ExpenseDrawer";
import { PlusIcon } from "../components/icons";
import { PageHeader } from "../components/Layout";
import { Banner, Button, cx, Select } from "../components/ui";
import { deleteTransactions, isExpense } from "../lib/api";
import { useInvalidate, useLookups, useTransactions } from "../lib/data";
import { currentMonth, formatMoney, monthBounds, shortDate } from "../lib/format";

export function Transactions() {
  const [params, setParams] = useSearchParams();
  const invalidate = useInvalidate();
  const lookups = useLookups();
  const [range, setRange] = useState(() => monthBounds(currentMonth()));
  const query = useTransactions(range.start, range.end);
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(() => (params.get("new") ? { mode: "create" } : null));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter(isExpense).filter((tx) => {
      if (accountId && tx.assetId !== accountId) return false;
      if (!q) return true;
      return [tx.merchant, tx.note, tx.category, tx.subCategory].some((field) => field.toLowerCase().includes(q));
    });
  }, [query.data, accountId, search]);

  const visibleSelected = rows.filter((tx) => selected.has(tx.id));
  const allSelected = rows.length > 0 && visibleSelected.length === rows.length;
  const total = rows.reduce((sum, tx) => sum + tx.amount, 0);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmDelete(false);
  }

  function openDrawer(state: DrawerState | null) {
    setDrawer(state);
    if (params.has("new")) setParams({}, { replace: true });
  }

  async function deleteSelected() {
    if (!confirmDelete) return setConfirmDelete(true);
    setDeleting(true);
    setError(null);
    try {
      const ids = visibleSelected.map((tx) => tx.id);
      await deleteTransactions(ids);
      setSelected(new Set());
      if (drawer?.mode === "edit" && ids.includes(drawer.tx.id)) setDrawer(null);
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const dateInput =
    "h-8 rounded-md border-0 bg-transparent px-1 font-mono text-[12px] text-fg outline-none focus:bg-raise";

  return (
    <div className={cx("grid min-h-full", drawer && "xl:grid-cols-[1fr_360px]")}>
      <div className="mx-auto flex w-full max-w-[1080px] min-w-0 flex-col px-6 py-7 md:px-10">
        <PageHeader eyebrow="Ledger" title="Transactions">
          <Button className="ml-auto" onClick={() => openDrawer({ mode: "create" })}>
            <PlusIcon />
            Add expense
          </Button>
        </PageHeader>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-1 rounded-lg border border-line bg-panel px-2 text-[12px] text-muted">
            <span className="px-1">Range</span>
            <input type="date" aria-label="From" className={dateInput} value={range.start} max={range.end}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, start: e.target.value }))} />
            <span>–</span>
            <input type="date" aria-label="To" className={dateInput} value={range.end} min={range.start}
              onChange={(e) => e.target.value && setRange((r) => ({ ...r, end: e.target.value }))} />
          </div>
          <div className="w-52">
            <Select
              value={accountId}
              onChange={setAccountId}
              placeholder="All accounts"
              options={lookups.accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
          <input
            type="search"
            placeholder="Search merchant, category or note"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 min-w-48 flex-1 rounded-lg border border-line bg-panel px-3 text-[13px] outline-none placeholder:text-muted/70 focus:border-lime"
          />
        </div>

        {(error ?? query.error) && <div className="mb-4"><Banner onDismiss={error ? () => setError(null) : undefined}>{error ?? query.error}</Banner></div>}

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel">
          <table className="w-full table-fixed border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-raise/60 text-left font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                <th className="w-11 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((tx) => tx.id)))}
                    className="size-3.5 accent-lime"
                  />
                </th>
                <th className="w-20 px-2 py-3 font-medium">Date</th>
                <th className="px-2 py-3 font-medium">Merchant</th>
                <th className="hidden px-2 py-3 font-medium lg:table-cell">Account</th>
                <th className="w-32 px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {query.loading && !query.data &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td colSpan={5} className="px-4 py-4"><span className="shimmer-bar block h-3 w-2/3 rounded" /></td>
                  </tr>
                ))}
              {rows.map((tx) => {
                const open = drawer?.mode === "edit" && drawer.tx.id === tx.id;
                return (
                  <tr
                    key={tx.id}
                    onClick={() => openDrawer({ mode: "edit", tx })}
                    className={cx(
                      "cursor-pointer border-b border-line/60 align-top transition-colors",
                      open ? "bg-lime/[0.06] shadow-[inset_2px_0_0_var(--color-lime)]" : selected.has(tx.id) ? "bg-raise" : "hover:bg-raise/60",
                    )}
                  >
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${tx.merchant}`} checked={selected.has(tx.id)} onChange={() => toggle(tx.id)} className="size-3.5 accent-lime" />
                    </td>
                    <td className="px-2 py-3.5 font-mono text-[11.5px] whitespace-nowrap text-muted">{shortDate(tx.date)}</td>
                    <td className="px-2 py-3.5">
                      <div className="truncate">{tx.merchant || "—"}</div>
                      <div className="truncate text-[11px] text-muted">
                        {tx.category}
                        {tx.subCategory && ` · ${tx.subCategory}`}
                      </div>
                    </td>
                    <td className="hidden truncate px-2 py-3.5 text-muted lg:table-cell">{tx.account}</td>
                    <td className="tabular px-4 py-3.5 text-right font-mono font-medium">{formatMoney(tx.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {query.data && rows.length === 0 && (
            <p className="px-4 py-10 text-center text-[12.5px] text-muted">
              {search || accountId ? "No expenses match these filters." : "No expenses in this range."}
            </p>
          )}

          <div className="mt-auto flex items-center gap-3 border-t border-line px-4 py-2.5 text-[12px]">
            {visibleSelected.length > 0 ? (
              <>
                <span>{visibleSelected.length} selected</span>
                <span className="tabular font-mono text-muted">{formatMoney(visibleSelected.reduce((s, tx) => s + tx.amount, 0))}</span>
                <button type="button" className="text-muted hover:text-fg" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
                <Button variant="danger" className="ml-auto h-7" disabled={deleting} onBlur={() => setConfirmDelete(false)} onClick={deleteSelected}>
                  {deleting ? "Deleting…" : confirmDelete ? `Confirm delete ${visibleSelected.length}` : "Delete"}
                </Button>
              </>
            ) : (
              <>
                <span className="text-muted">{rows.length} expenses</span>
                <span className="tabular ml-auto font-mono">{formatMoney(total)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {drawer && (
        <ExpenseDrawer
          key={drawer.mode === "edit" ? drawer.tx.id : "new"}
          state={drawer}
          lookups={lookups}
          onClose={() => openDrawer(null)}
        />
      )}
    </div>
  );
}
