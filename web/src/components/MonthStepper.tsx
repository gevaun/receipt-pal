import { shiftMonth, type Month } from "../lib/format";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export function MonthStepper({ month, onChange }: { month: Month; onChange: (month: Month) => void }) {
  const button = "grid size-7 place-items-center rounded-md border border-line text-muted hover:bg-raise hover:text-fg";
  return (
    <div className="flex gap-1">
      <button type="button" className={button} aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeftIcon className="size-3.5" />
      </button>
      <button type="button" className={button} aria-label="Next month" onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRightIcon className="size-3.5" />
      </button>
    </div>
  );
}
