export type ReceiptLine =
  | { kind: "title"; text: string }
  | { kind: "small"; text: string }
  | { kind: "rule" }
  | { kind: "row"; left: string; right: string; strong?: boolean };

export type ExtractField = "merchant" | "date" | "amount" | "note";

export type ExtractEvent =
  | { type: "line"; line: ReceiptLine; progress?: number }
  | { type: "field"; field: ExtractField; value: string };

export type Extractor = (file: File, onEvent: (event: ExtractEvent) => void, signal: AbortSignal) => Promise<void>;

export const EXTRACTION_IS_MOCK = true;

const sample: (ReceiptLine | { field: ExtractField; value: string })[] = [
  { kind: "title", text: "SUPER VALU" },
  { kind: "title", text: "FRESH FOODS" },
  { kind: "small", text: "Manor Park Plaza · Kingston" },
  { field: "merchant", value: "Super Valu Fresh Foods" },
  { kind: "rule" },
  { kind: "row", left: "25/10/2026 14:32", right: "REG 03" },
  { field: "date", value: "2026-10-25" },
  { kind: "rule" },
  { kind: "row", left: "JASMINE RICE 2KG", right: "1,250.00" },
  { kind: "row", left: "WHOLE CHICKEN 1.8KG", right: "2,184.60" },
  { kind: "row", left: "CALLALOO BUNCH", right: "350.00" },
  { kind: "row", left: "ACKEE 540G", right: "1,395.00" },
  { kind: "row", left: "CHEDDAR CHEESE 1KG", right: "2,890.00" },
  { kind: "row", left: "LAUNDRY DETERGENT", right: "3,415.40" },
  { kind: "row", left: "COOKING OIL 3L", right: "2,271.16" },
  { kind: "rule" },
  { kind: "row", left: "SUBTOTAL", right: "13,756.16" },
  { kind: "row", left: "GCT 15%", right: "2,063.42" },
  { kind: "row", left: "TOTAL", right: "15,819.58", strong: true },
  { field: "amount", value: "15819.58" },
  { kind: "rule" },
  { kind: "row", left: "MASTERCARD ****4417", right: "15,819.58" },
  { kind: "small", text: "THANK YOU · COME AGAIN" },
  { field: "note", value: "7 items, incl. GCT 2,063.42" },
];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const mockExtract: Extractor = async (_file, onEvent, signal) => {
  await wait(700, signal);
  const total = sample.filter((step) => !("field" in step)).length;
  let printed = 0;
  for (const step of sample) {
    if ("field" in step) {
      onEvent({ type: "field", field: step.field, value: step.value });
      continue;
    }
    await wait(step.kind === "rule" ? 140 : 320, signal);
    printed += 1;
    onEvent({ type: "line", line: step, progress: printed / total });
  }
};

export const extractReceipt: Extractor = mockExtract;
