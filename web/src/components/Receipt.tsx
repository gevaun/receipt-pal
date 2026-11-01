import { useEffect, useRef } from "react";
import type { ReceiptLine } from "../lib/extract";
import { cx } from "./ui";

export function Receipt({ lines, printing }: { lines: ReceiptLine[]; printing: boolean }) {
  const paperRef = useRef<HTMLDivElement>(null);

  // Long receipts scroll inside the paper; follow the newest line while it prints.
  useEffect(() => {
    const paper = paperRef.current;
    if (printing && paper) paper.scrollTop = paper.scrollHeight;
  }, [lines.length, printing]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative z-10 h-6 w-full rounded-full border border-line bg-raise shadow-[inset_0_-6px_10px_var(--shadow-strong)]">
        <span
          className={cx(
            "absolute inset-x-4 bottom-[7px] h-[2px] rounded-full bg-lime shadow-[0_0_10px_var(--color-lime)]",
            printing ? "animate-pulse-led" : "opacity-40",
          )}
        />
      </div>
      <div
        ref={paperRef}
        className="receipt-paper relative -mt-3 max-h-[440px] w-[88%] overflow-y-auto overscroll-contain bg-thermal [scrollbar-width:thin] px-4 pt-6 pb-7 font-mono text-[10.5px] leading-[1.6] text-[#26231d] shadow-[0_24px_40px_-18px_var(--shadow-strong)] ring-1 ring-black/5"
        aria-live="polite"
      >
        {lines.map((line, i) => (
          <div key={i} className="animate-print">
            <Line line={line} />
          </div>
        ))}
        {printing && (
          <>
            <div className="relative -mx-4 my-2 h-0" aria-hidden="true">
              <span className="absolute inset-x-0 -top-px h-[2px] bg-lime shadow-[0_0_12px_2px_color-mix(in_oklab,var(--color-lime)_70%,transparent)]" />
              <span className="absolute inset-x-0 bottom-px h-7 bg-gradient-to-t from-lime/25 to-transparent" />
            </div>
            {[82, 64, 74, 56].map((width, i) => (
              <div key={i} className="my-2.5 h-1.5 rounded-full bg-[#e1ddd2]" style={{ width: `${width}%`, marginLeft: i > 2 ? "auto" : undefined }} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Line({ line }: { line: ReceiptLine }) {
  switch (line.kind) {
    case "title":
      return <div className="text-center text-[12px] font-medium tracking-[0.05em]">{line.text}</div>;
    case "small":
      return <div className="text-center text-[9.5px] text-[#6e695f]">{line.text}</div>;
    case "rule":
      return <div className="my-2 border-t border-dashed border-[#b6b0a3]" />;
    case "row":
      return (
        <div className={cx("flex justify-between gap-3", line.strong && "mt-0.5 text-[12px] font-medium")}>
          <span className="truncate">{line.left}</span>
          <span className="tabular shrink-0">{line.right}</span>
        </div>
      );
  }
}
