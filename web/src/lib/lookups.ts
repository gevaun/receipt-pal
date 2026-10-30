import { isExpense, type Transaction } from "./api";

// The backend has no endpoints for accounts, categories or merchants, so the
// pickers are built from the expenses already in Money Manager.

export interface Account {
  id: string;
  name: string;
  count: number;
}

export interface SubCategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  count: number;
  subs: SubCategory[];
}

export interface Merchant {
  name: string;
  count: number;
  /** The most recent expense at this merchant, used to prefill the form. */
  last: Transaction;
}

export interface Lookups {
  accounts: Account[];
  categories: Category[];
  merchants: Merchant[];
  lastAccountId: string | null;
}

export const emptyLookups: Lookups = { accounts: [], categories: [], merchants: [], lastAccountId: null };

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildLookups(transactions: Transaction[]): Lookups {
  const expenses = transactions.filter(isExpense).sort((a, b) => b.date.localeCompare(a.date));
  const accounts = new Map<string, Account>();
  const categories = new Map<string, Category>();
  const merchants = new Map<string, Merchant>();

  for (const tx of expenses) {
    if (tx.assetId) {
      const account = accounts.get(tx.assetId) ?? { id: tx.assetId, name: tx.account, count: 0 };
      account.count += 1;
      accounts.set(tx.assetId, account);
    }
    if (tx.categoryId) {
      const category = categories.get(tx.categoryId) ?? { id: tx.categoryId, name: tx.category, count: 0, subs: [] };
      category.count += 1;
      if (tx.subCategoryId && !category.subs.some((sub) => sub.id === tx.subCategoryId)) {
        category.subs.push({ id: tx.subCategoryId, name: tx.subCategory });
      }
      categories.set(tx.categoryId, category);
    }
    const key = normalize(tx.merchant);
    if (key) {
      const merchant = merchants.get(key) ?? { name: tx.merchant, count: 0, last: tx };
      merchant.count += 1;
      merchants.set(key, merchant);
    }
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  for (const category of categories.values()) category.subs.sort((a, b) => a.name.localeCompare(b.name));

  return {
    accounts: [...accounts.values()].sort(byCount),
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    merchants: [...merchants.values()].sort((a, b) => b.last.date.localeCompare(a.last.date)),
    lastAccountId: expenses[0]?.assetId ?? null,
  };
}

/** Finds a previous merchant matching a name read off a receipt. */
export function matchMerchant(merchants: Merchant[], name: string): Merchant | null {
  const target = normalize(name);
  if (!target) return null;
  return (
    merchants.find((m) => normalize(m.name) === target) ??
    merchants.find((m) => {
      const known = normalize(m.name);
      return known.length >= 4 && (target.includes(known) || known.includes(target));
    }) ??
    null
  );
}
