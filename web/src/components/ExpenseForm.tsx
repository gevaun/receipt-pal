import { useId } from "react";
import type { ExpenseInput, Transaction } from "../lib/api";
import type { Lookups, Merchant } from "../lib/lookups";
import { CheckIcon } from "./icons";
import { MerchantInput } from "./MerchantInput";
import { Combobox, Field, inputClass, Select, type FieldTone } from "./ui";

export interface Draft {
  date: string;
  amount: string;
  merchant: string;
  note: string;
  assetId: string;
  account: string;
  categoryId: string;
  category: string;
  subCategoryId: string;
  subCategory: string;
}

export type DraftField = "merchant" | "date" | "amount" | "account" | "category" | "subCategory" | "note";

export function emptyDraft(date: string, lookups: Lookups): Draft {
  const account = lookups.accounts.find((a) => a.id === lookups.lastAccountId);
  return {
    date,
    amount: "",
    merchant: "",
    note: "",
    assetId: account?.id ?? "",
    account: account?.name ?? "",
    categoryId: "",
    category: "",
    subCategoryId: "",
    subCategory: "",
  };
}

export function draftFromTransaction(tx: Transaction): Draft {
  return {
    date: tx.date,
    amount: tx.amount.toFixed(2),
    merchant: tx.merchant,
    note: tx.note,
    assetId: tx.assetId,
    account: tx.account,
    categoryId: tx.categoryId,
    category: tx.category,
    subCategoryId: tx.subCategoryId,
    subCategory: tx.subCategory,
  };
}

export function merchantDefaults(merchant: Merchant): Partial<Draft> {
  const { last } = merchant;
  return {
    merchant: merchant.name,
    assetId: last.assetId,
    account: last.account,
    categoryId: last.categoryId,
    category: last.category,
    subCategoryId: last.subCategoryId,
    subCategory: last.subCategory,
  };
}

export function parseAmount(text: string): number {
  return Number.parseFloat(text.replace(/[^0-9.]/g, ""));
}

export function validateDraft(draft: Draft): string | ExpenseInput {
  const amount = parseAmount(draft.amount);
  if (!draft.merchant.trim()) return "Add a merchant.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "Pick a date.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount above zero.";
  if (!draft.assetId) return "Choose an account.";
  if (!draft.categoryId) return "Choose a category.";
  if (!draft.subCategoryId) return "Choose a sub-category.";
  return {
    date: draft.date,
    amount,
    assetId: draft.assetId,
    account: draft.account,
    categoryId: draft.categoryId,
    category: draft.category,
    subCategoryId: draft.subCategoryId,
    subCategory: draft.subCategory,
    merchant: draft.merchant.trim(),
    note: draft.note.trim(),
  };
}

export function ExpenseForm({
  draft,
  onChange,
  lookups,
  tones = {},
  merchantMatched,
  disabled,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  lookups: Lookups;
  tones?: Partial<Record<DraftField, FieldTone>>;
  merchantMatched?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const category = lookups.categories.find((c) => c.id === draft.categoryId);
  const subs = category?.subs ?? [];

  const accountOptions = lookups.accounts.map((a) => ({ value: a.id, label: a.name }));
  if (draft.assetId && !accountOptions.some((o) => o.value === draft.assetId)) {
    accountOptions.unshift({ value: draft.assetId, label: draft.account });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Merchant" tone={tones.merchant} htmlFor={`${id}-merchant`}>
        <MerchantInput
          id={`${id}-merchant`}
          value={draft.merchant}
          merchants={lookups.merchants}
          tone={tones.merchant}
          disabled={disabled}
          onChange={(merchant) => onChange({ merchant })}
          onPick={(merchant) => onChange(merchantDefaults(merchant))}
        />
        {merchantMatched !== undefined && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
            <CheckIcon className="size-3 text-lime" />
            Matches a previous merchant · {merchantMatched}×
          </p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Date" tone={tones.date} htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            type="date"
            value={draft.date}
            disabled={disabled}
            onChange={(e) => onChange({ date: e.target.value })}
            className={`${inputClass(tones.date)} font-mono text-[12.5px]`}
          />
        </Field>
        <Field label="Amount" tone={tones.amount} htmlFor={`${id}-amount`}>
          <input
            id={`${id}-amount`}
            inputMode="decimal"
            placeholder="0.00"
            value={draft.amount}
            disabled={disabled}
            onChange={(e) => onChange({ amount: e.target.value })}
            onBlur={() => {
              const amount = parseAmount(draft.amount);
              if (Number.isFinite(amount)) onChange({ amount: amount.toFixed(2) });
            }}
            className={`${inputClass(tones.amount)} tabular text-right font-mono`}
          />
        </Field>
      </div>

      <Field label="Account" tone={tones.account} hint={draft.assetId === lookups.lastAccountId ? "last used" : undefined} htmlFor={`${id}-account`}>
        <Select
          id={`${id}-account`}
          value={draft.assetId}
          options={accountOptions}
          placeholder={accountOptions.length ? "Choose an account" : "No accounts yet"}
          tone={tones.account}
          disabled={disabled}
          onChange={(assetId) => onChange({ assetId, account: accountOptions.find((o) => o.value === assetId)?.label ?? "" })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Category" tone={tones.category} htmlFor={`${id}-category`}>
          <Combobox
            id={`${id}-category`}
            placeholder="Category"
            tone={tones.category}
            disabled={disabled}
            options={lookups.categories.map((c) => ({ id: c.id, label: c.name }))}
            value={draft.categoryId ? { id: draft.categoryId, label: draft.category } : null}
            onChange={(option) => {
              if (option.id === draft.categoryId) return;
              const next = lookups.categories.find((c) => c.id === option.id);
              const only = next?.subs.length === 1 ? next.subs[0] : null;
              onChange({
                categoryId: option.id,
                category: option.label,
                subCategoryId: only?.id ?? "",
                subCategory: only?.name ?? "",
              });
            }}
          />
        </Field>
        <Field label="Sub" tone={tones.subCategory} htmlFor={`${id}-sub`}>
          <Combobox
            id={`${id}-sub`}
            placeholder={draft.categoryId ? "Sub-category" : "Pick a category"}
            tone={tones.subCategory}
            disabled={disabled || !draft.categoryId}
            emptyText="No sub-categories"
            options={subs.map((s) => ({ id: s.id, label: s.name }))}
            value={draft.subCategoryId ? { id: draft.subCategoryId, label: draft.subCategory } : null}
            onChange={(option) => onChange({ subCategoryId: option.id, subCategory: option.label })}
          />
        </Field>
      </div>

      <Field label="Note" tone={tones.note} hint="optional" htmlFor={`${id}-note`}>
        <textarea
          id={`${id}-note`}
          rows={2}
          value={draft.note}
          disabled={disabled}
          onChange={(e) => onChange({ note: e.target.value })}
          className={`${inputClass(tones.note)} h-auto resize-none py-2 leading-snug`}
        />
      </Field>
    </div>
  );
}
