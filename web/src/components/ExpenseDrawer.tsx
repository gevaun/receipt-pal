import { useEffect, useState } from "react";
import { createExpense, deleteTransactions, updateTransaction, type Transaction } from "../lib/api";
import { useInvalidate } from "../lib/data";
import { today } from "../lib/format";
import type { Lookups } from "../lib/lookups";
import { draftFromTransaction, emptyDraft, ExpenseForm, validateDraft, type Draft } from "./ExpenseForm";
import { CloseIcon } from "./icons";
import { Banner, Button } from "./ui";

export type DrawerState = { mode: "create" } | { mode: "edit"; tx: Transaction };

export function ExpenseDrawer({ state, lookups, onClose }: { state: DrawerState; lookups: Lookups; onClose: () => void }) {
  const invalidate = useInvalidate();
  const tx = state.mode === "edit" ? state.tx : null;
  const [draft, setDraft] = useState<Draft>(() => (tx ? draftFromTransaction(tx) : emptyDraft(today(), lookups)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lookups may arrive after the drawer opens; default the account once they do.
  useEffect(() => {
    if (!tx && !draft.assetId && lookups.lastAccountId) setDraft(emptyDraft(draft.date, lookups));
  }, [lookups, tx, draft.assetId, draft.date]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      invalidate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const result = validateDraft(draft);
    if (typeof result === "string") return setError(result);
    void run(() => (tx ? updateTransaction(tx, result) : createExpense(result)));
  }

  return (
    <aside
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[360px] flex-col gap-4 overflow-y-auto border-l border-line bg-sunk p-5 shadow-[-20px_0_40px_var(--shadow-strong)] xl:sticky xl:top-0 xl:z-auto xl:h-dvh xl:shadow-none"
      aria-label={tx ? "Edit expense" : "Add expense"}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[16px] font-medium tracking-[-0.01em]">{tx ? "Edit expense" : "Add expense"}</h2>
          {tx && <p className="mt-0.5 font-mono text-[10px] text-muted">ID {tx.id.slice(0, 8)}…</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-raise hover:text-fg">
          <CloseIcon className="size-4" />
        </button>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      <ExpenseForm draft={draft} lookups={lookups} disabled={busy} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />

      <div className="mt-auto flex items-center gap-2 border-t border-line pt-4">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : tx ? "Save changes" : "Add expense"}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {tx && (
          <Button
            variant="danger"
            className="ml-auto"
            disabled={busy}
            onBlur={() => setConfirmDelete(false)}
            onClick={() => (confirmDelete ? void run(() => deleteTransactions([tx.id])) : setConfirmDelete(true))}
          >
            {confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
        )}
      </div>
    </aside>
  );
}
