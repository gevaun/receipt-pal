import { useState, type CSSProperties } from "react";
import { formatMoney, type Month } from "../lib/format";
import { cx } from "./ui";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => value / power <= s) ?? 10;
  return step * power;
}

const gridlines = [0, 0.25, 0.5, 0.75, 1];

export function DailySpendChart({ daily, month, todayIndex }: { daily: number[]; month: Month; todayIndex: number | null }) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const peakDay = daily.reduce((best, value, i) => (value > daily[best] ? i : best), 0);
  const peak = daily[peakDay] ?? 0;
  const scale = niceCeil(peak);
  const monthShort = new Date(month.year, month.month, 1).toLocaleDateString("en-US", { month: "short" });
  const columns = { "--cols": `repeat(${daily.length}, minmax(0, 1fr))` } as CSSProperties;

  const readoutDay = hoverDay ?? (peak > 0 ? peakDay : null);
  const readout =
    readoutDay === null
      ? "No spending yet"
      : `${hoverDay === null ? "Peak · " : ""}${String(readoutDay + 1).padStart(2, "0")} ${monthShort} · ${formatMoney(daily[readoutDay])}`;

  return (
    <section className="@container rounded-xl border border-fg/10 bg-void p-4 @lg:p-5" aria-label="Daily spend">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[0.8125rem] font-medium">Daily spend</h2>
        <p className="truncate font-mono text-[0.6875rem] text-muted tabular-nums" aria-live="polite">
          {readout}
        </p>
      </div>

      <div className="mt-5 flex gap-3">
        <div className="relative h-44 flex-1 @lg:h-52" onMouseLeave={() => setHoverDay(null)}>
          {gridlines.map((at) => (
            <div
              key={at}
              aria-hidden="true"
              className={cx("absolute inset-x-0 top-(--at) border-t", at === 1 ? "border-fg/15" : "border-fg/6")}
              style={{ "--at": `${at * 100}%` } as CSSProperties}
            />
          ))}
          <div className="absolute inset-0 grid grid-cols-(--cols)" style={columns}>
            {daily.map((value, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoverDay(i)}
                className={cx(
                  "flex items-end justify-center border-l border-fg/5 px-[18%] first:border-l-0",
                  hoverDay === i ? "bg-fg/4" : i === todayIndex && "bg-lime/6",
                )}
              >
                {value > 0 && (
                  <div
                    className={cx(
                      "h-(--bar) w-full max-w-3 rounded-t-[2px]",
                      i === peakDay ? "bg-lime" : hoverDay === i ? "bg-fg" : "bg-bar",
                    )}
                    style={{ "--bar": `${Math.max((value / scale) * 100, 3)}%` } as CSSProperties}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="relative w-10 shrink-0 font-mono text-[0.625rem] text-muted tabular-nums" aria-hidden="true">
          {[0, 0.5, 1].map((at) => (
            <span key={at} className="absolute right-0 top-(--at) -translate-y-1/2" style={{ "--at": `${at * 100}%` } as CSSProperties}>
              {compact.format(scale * (1 - at))}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 mr-13 grid grid-cols-(--cols) font-mono text-[0.625rem] text-muted tabular-nums" style={columns} aria-hidden="true">
        {daily.map((_, i) => (
          <span key={i} className={cx("text-center", i === todayIndex && "text-lime")}>
            {i % 7 === 0 || i === daily.length - 1 ? String(i + 1).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
    </section>
  );
}
