import { scanReceipt, type ScanLine } from "./api";

export type ReceiptLine =
  | { kind: "title"; text: string }
  | { kind: "small"; text: string }
  | { kind: "rule" }
  | { kind: "row"; left: string; right: string; strong?: boolean };

export type ExtractField = "merchant" | "date" | "amount" | "note";

export type ExtractEvent =
  | { type: "line"; line: ReceiptLine; progress?: number }
  | { type: "field"; field: ExtractField; value: string };

export type Extractor = (
  file: File,
  merchants: string[],
  onEvent: (event: ExtractEvent) => void,
  signal: AbortSignal,
) => Promise<void>;

// The whole replay takes about this long, however many lines the receipt has.
const REPLAY_MS = 3000;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

function toReceiptLine(line: ScanLine): ReceiptLine {
  switch (line.kind) {
    case "title":
      return { kind: "title", text: line.text };
    case "small":
      return { kind: "small", text: line.text };
    case "rule":
      return { kind: "rule" };
    case "row":
      return { kind: "row", left: line.left, right: line.right, strong: line.strong };
  }
}

export const extractReceipt: Extractor = async (file, merchants, onEvent, signal) => {
  const scan = await scanReceipt(file, merchants, signal);
  onEvent({ type: "field", field: "merchant", value: scan.merchant });
  onEvent({ type: "field", field: "date", value: scan.date });

  // The receipt prints line by line, so replay the lines the model read in order.
  const total = Math.max(scan.lines.length, 1);
  const step = Math.min(320, REPLAY_MS / total);
  for (const [index, scanned] of scan.lines.entries()) {
    await wait(scanned.kind === "rule" ? step / 2 : step, signal);
    onEvent({ type: "line", line: toReceiptLine(scanned), progress: (index + 1) / total });
  }

  onEvent({ type: "field", field: "amount", value: scan.amount.toFixed(2) });
  onEvent({ type: "field", field: "note", value: scan.description });
};
