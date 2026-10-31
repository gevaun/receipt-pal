export interface Transaction {
  id: string;
  date: string;
  amount: number;
  inOutType: string;
  inOutCode: number;
  assetId: string;
  account: string;
  categoryId: string;
  category: string;
  subCategoryId: string;
  subCategory: string;
  merchant: string;
  note: string;
}

export interface ExpenseInput {
  date: string;
  amount: number;
  assetId: string;
  account: string;
  categoryId: string;
  category: string;
  subCategoryId: string;
  subCategory: string;
  merchant: string;
  note: string;
}

export class ApiError extends Error {}

export function isExpense(tx: Transaction): boolean {
  return tx.inOutCode === 1 || tx.inOutType.toLowerCase().startsWith("exp");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError(
      "Can't reach the Receipt Pal API. Is the backend running on port 8000?",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).join(", ")
          : `Request failed (${response.status})`;
    throw new ApiError(message);
  }
  return response.json() as Promise<T>;
}

type Row = Record<string, string>;

function toTransaction(row: Row): Transaction {
  return {
    id: row.id ?? "",
    date: (row.mbDate ?? "").slice(0, 10),
    amount: Number.parseFloat(row.mbCash ?? "0") || 0,
    inOutType: row.inOutType ?? "",
    inOutCode: Number.parseInt(row.inOutCode ?? "", 10),
    assetId: row.assetId ?? "",
    account: row.payType ?? "",
    categoryId: row.mcid ?? "",
    category: row.mbCategory ?? "",
    subCategoryId: row.mcscid ?? "",
    subCategory: row.subCategory ?? "",
    merchant: row.mbContent ?? "",
    note: row.mbDetailContent ?? "",
  };
}

export async function getTransactions(
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<Transaction[]> {
  const params = new URLSearchParams({ start_date: start, end_date: end });
  const data = await request<{ results: number; rows: Row[] }>(
    `/get-transactions?${params}`,
    { signal },
  );
  return data.rows
    .map(toTransaction)
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function postForm(
  path: string,
  form: URLSearchParams,
  failure: string,
): Promise<void> {
  const data = await request<{ result: string }>(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!/success\s*:\s*true/i.test(data.result)) throw new ApiError(failure);
}

function expenseFields(input: ExpenseInput): Record<string, string> {
  return {
    mbDate: `${input.date}T00:00:00`,
    mbCash: input.amount.toFixed(2),
    payType: input.account,
    assetId: input.assetId,
    mcid: input.categoryId,
    mbCategory: input.category,
    mcscid: input.subCategoryId,
    subCategory: input.subCategory,
    mbContent: input.merchant,
    mbDetailContent: input.note,
  };
}

export function createExpense(input: ExpenseInput): Promise<void> {
  const form = new URLSearchParams({
    ...expenseFields(input),
    inOutType: "Expense",
    inOutCode: "1",
  });
  return postForm(
    "/create-transaction",
    form,
    "Money Manager didn't accept the new expense.",
  );
}

export function updateTransaction(
  original: Transaction,
  input: ExpenseInput,
): Promise<void> {
  const form = new URLSearchParams({
    id: original.id,
    ...expenseFields(input),
    inOutType: original.inOutType,
    inOutCode: String(original.inOutCode),
  });
  return postForm(
    "/update-transaction",
    form,
    "Money Manager didn't accept the change.",
  );
}

export function deleteTransactions(ids: string[]): Promise<void> {
  const form = new URLSearchParams();
  for (const id of ids) form.append("ids", id);
  return postForm(
    "/delete-transactions",
    form,
    "Money Manager didn't delete the transactions.",
  );
}

export interface Settings {
  money_manager_base_url: string | null;
  source: "file" | "env" | null;
}

export interface ConnectionStatus {
  configured: boolean;
  reachable: boolean;
  money_manager_base_url: string | null;
  detail: string | null;
}

export function getSettings(signal?: AbortSignal): Promise<Settings> {
  return request<Settings>("/settings", { signal });
}

export function saveSettings(moneyManagerBaseUrl: string): Promise<Settings> {
  return request<Settings>("/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ money_manager_base_url: moneyManagerBaseUrl }),
  });
}

export function getConnectionStatus(
  signal?: AbortSignal,
): Promise<ConnectionStatus> {
  return request<ConnectionStatus>("/settings/status", { signal });
}
