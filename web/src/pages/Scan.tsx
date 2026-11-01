import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import { emptyDraft, ExpenseForm, merchantDefaults, parseAmount, validateDraft, type Draft, type DraftField } from "../components/ExpenseForm";
import { CheckIcon, UploadIcon } from "../components/icons";
import { PageHeader } from "../components/Layout";
import { Receipt } from "../components/Receipt";
import { Banner, Button, cx, type FieldTone } from "../components/ui";
import { createExpense } from "../lib/api";
import { useInvalidate, useLookups } from "../lib/data";
import { extractReceipt, type ExtractEvent, type ReceiptLine } from "../lib/extract";
import { today } from "../lib/format";
import { matchMerchant } from "../lib/lookups";

type Phase = "idle" | "extracting" | "review" | "saving" | "saved";
type Tones = Partial<Record<DraftField, FieldTone>>;

const PENDING: Tones = { merchant: "pending", date: "pending", amount: "pending", category: "pending", subCategory: "pending", note: "pending" };

export function Scan() {
  const lookups = useLookups();
  const lookupsRef = useRef(lookups);
  lookupsRef.current = lookups;
  const invalidate = useInvalidate();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(today(), lookups));
  const [tones, setTones] = useState<Tones>({});
  const [matchedCount, setMatchedCount] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function handleEvent(event: ExtractEvent) {
    if (event.type === "line") {
      setLines((current) => [...current, event.line]);
      if (event.progress !== undefined) setProgress(event.progress);
      return;
    }
    const { field, value } = event;
    if (field === "merchant") {
      const match = matchMerchant(lookupsRef.current.merchants, value);
      if (match) {
        setDraft((d) => ({ ...d, ...merchantDefaults(match) }));
        setMatchedCount(match.count);
        setTones((t) => ({ ...t, merchant: "extracted", category: "suggested", subCategory: "suggested", account: "suggested" }));
      } else {
        setDraft((d) => ({ ...d, merchant: value }));
        setTones((t) => ({ ...t, merchant: "extracted", category: "check", subCategory: "check" }));
      }
    } else if (field === "amount") {
      setDraft((d) => ({ ...d, amount: parseAmount(value).toFixed(2) }));
      setTones((t) => ({ ...t, amount: "extracted" }));
    } else {
      setDraft((d) => ({ ...d, [field]: value }));
      setTones((t) => ({ ...t, [field]: "extracted" }));
    }
  }

  async function start(next: File) {
    if (!next.type.startsWith("image/")) return setError("That file isn't an image. Choose a photo of a receipt.");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setLines([]);
    setProgress(0);
    setDraft(emptyDraft(today(), lookupsRef.current));
    setTones(PENDING);
    setMatchedCount(undefined);
    setError(null);
    setPhase("extracting");
    try {
      const merchants = lookupsRef.current.merchants.map((m) => m.name);
      await extractReceipt(next, merchants, handleEvent, controller.signal);
      setTones((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v === "pending" ? "check" : v])));
      setPhase("review");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setTones({});
      setPhase("review");
    }
  }

  function reset() {
    abortRef.current?.abort();
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setLines([]);
    setError(null);
  }

  async function save() {
    const result = validateDraft(draft);
    if (typeof result === "string") return setError(result);
    setPhase("saving");
    setError(null);
    try {
      await createExpense(result);
      invalidate();
      setPhase("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("review");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) void start(dropped);
  }

  const extracting = phase === "extracting";

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-7 md:px-10">
      <PageHeader eyebrow="New expense" title="Scan receipt" />

      <Steps phase={phase} />

      {phase === "idle" ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(
            "mt-2 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-24 text-center transition-colors",
            dragging ? "border-lime bg-lime/5" : "border-line bg-panel/60 hover:border-muted",
          )}
        >
          <span className="grid size-12 place-items-center rounded-xl border border-line bg-raise text-lime">
            <UploadIcon className="size-5" />
          </span>
          <span>
            <span className="block text-[15px] font-medium">Drop a receipt photo</span>
            <span className="mt-1 block text-[12.5px] text-muted">or click to choose one · JPG, PNG or HEIC</span>
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void start(chosen);
              e.target.value = "";
            }}
          />
          {error && <span className="text-[12px] text-alert">{error}</span>}
        </label>
      ) : (
        <div className="grid gap-10 md:grid-cols-[260px_1fr]">
          <div className="min-w-0">
            {/* The photo and the read progress sit above the receipt so they stay put as the receipt grows. */}
            {file && (
              <figure className="mb-6">
                {preview && (
                  <a href={preview} target="_blank" rel="noreferrer" title="Open the full photo">
                    <img src={preview} alt={`Photo of ${file.name}`} className="h-40 w-full rounded-xl border border-line bg-panel object-cover object-top" />
                  </a>
                )}
                <figcaption className="mt-2 flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                </figcaption>
              </figure>
            )}
            <div className="flex justify-between font-mono text-[11px] text-muted">
              <span>
                <b className="font-medium text-lime">Gemini</b> {extracting ? `reading line ${lines.length + 1}` : `read ${lines.length} lines`}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="mt-2 h-[2px] rounded-full bg-line">
              <div className="h-full rounded-full bg-lime shadow-[0_0_8px_var(--color-lime)] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-4">
              <Receipt lines={lines} printing={extracting} />
            </div>
          </div>

          <section className="min-w-0 max-w-[460px]">
            {phase === "saved" ? (
              <div className="flex flex-col items-start gap-4 rounded-xl border border-line bg-panel p-6">
                <span className="grid size-10 place-items-center rounded-full bg-lime/15 text-lime">
                  <CheckIcon className="size-5" />
                </span>
                <div>
                  <h2 className="text-[16px] font-medium">Saved to Money Manager</h2>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {draft.merchant} · {draft.amount} · {draft.category} / {draft.subCategory}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={reset}>Scan another</Button>
                  <Link to="/transactions" className="inline-flex h-8 items-center rounded-lg border border-line px-3.5 text-[12.5px] font-medium hover:bg-raise">
                    View transactions
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-[15px] font-medium tracking-[-0.01em]">Review</h2>
                  <span className="font-mono text-[10.5px] text-muted">{extracting ? "fields fill as they're read" : "check, then save"}</span>
                </div>
                {error && <div className="mb-4"><Banner onDismiss={() => setError(null)}>{error}</Banner></div>}
                <ExpenseForm
                  draft={draft}
                  lookups={lookups}
                  tones={tones}
                  merchantMatched={matchedCount}
                  disabled={phase === "saving"}
                  onChange={(patch) => {
                    setDraft((d) => ({ ...d, ...patch }));
                    setTones((t) => {
                      const next = { ...t };
                      for (const key of Object.keys(patch)) {
                        const field = (key === "categoryId" || key === "category" ? "category" : key === "subCategoryId" || key === "subCategory" ? "subCategory" : key === "assetId" ? "account" : key) as DraftField;
                        if (next[field] !== "pending") delete next[field];
                      }
                      return next;
                    });
                  }}
                />
                <div className="mt-6 flex items-center gap-2 border-t border-line pt-4">
                  <Button onClick={save} disabled={extracting || phase === "saving"}>
                    {phase === "saving" ? "Saving…" : "Save to Money Manager"}
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    Discard
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

const stepNames = ["Upload", "Extract", "Review", "Save"] as const;

function Steps({ phase }: { phase: Phase }) {
  const current = { idle: 0, extracting: 1, review: 2, saving: 3, saved: 4 }[phase];
  return (
    <ol className="-mt-3 mb-8 flex flex-wrap items-center gap-2 font-mono text-[10.5px] tracking-[0.06em] text-muted uppercase">
      {stepNames.map((name, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={name} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-line" aria-hidden="true" />}
            <span
              className={cx(
                "grid size-[18px] place-items-center rounded-full border text-[9px]",
                done && "border-line bg-raise text-fg",
                now && "border-lime text-lime shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-lime)_14%,transparent)]",
                !done && !now && "border-line",
              )}
            >
              {done ? <CheckIcon className="size-2.5" /> : i + 1}
            </span>
            <span className={cx(now && "text-fg")} aria-current={now ? "step" : undefined}>
              {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
