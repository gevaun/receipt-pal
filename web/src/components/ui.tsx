import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ChevronDownIcon, CloseIcon, UpDownIcon } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-cta text-on-cta font-semibold hover:bg-cta-hover disabled:bg-lime/15 disabled:text-lime/60 disabled:cursor-not-allowed",
  ghost: "border border-line text-fg hover:bg-raise disabled:opacity-50",
  danger: "text-alert hover:bg-alert/10 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
        "[&_svg]:size-3.5",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("font-mono text-[10px] tracking-[0.14em] text-muted uppercase", className)}>{children}</div>;
}

export function Banner({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-alert/40 bg-alert/10 px-3.5 py-2.5 text-[12.5px] text-alert-fg">
      <span className="flex-1">{children}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-alert-fg/70 hover:text-alert-fg">
          <CloseIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export type FieldTone = "extracted" | "suggested" | "check" | "pending";

const toneLabel: Record<Exclude<FieldTone, "pending">, string> = {
  extracted: "extracted",
  suggested: "suggested",
  check: "check",
};

export function Field({
  label,
  tone,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  tone?: FieldTone;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="relative min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 whitespace-nowrap font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
        {label}
        {tone && tone !== "pending" && (
          <span className={cx("tracking-[0.04em] normal-case", tone === "check" ? "text-check" : "text-lime")}>{toneLabel[tone]}</span>
        )}
        {!tone && hint && <span className="tracking-[0.04em] normal-case">{hint}</span>}
      </label>
      {tone === "pending" ? (
        <div className="flex h-9 items-center rounded-lg border border-line bg-panel px-3" aria-busy="true">
          <span className="shimmer-bar h-2 w-3/4 rounded" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function inputClass(tone?: FieldTone): string {
  return cx(
    "h-9 w-full min-w-0 rounded-lg border bg-panel px-3 text-[13px] text-fg placeholder:text-muted/70",
    "outline-none transition-[border-color,box-shadow] focus:border-lime focus:bg-sunk focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-lime)_14%,transparent)]",
    tone === "check" ? "border-check/60" : tone === "extracted" || tone === "suggested" ? "border-lime/35" : "border-line",
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  tone,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  tone?: FieldTone;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputClass(tone), "cursor-pointer appearance-none pr-8", !value && "text-muted")}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <UpDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <b className="font-semibold text-fg">{text.slice(index, index + query.length)}</b>
      {text.slice(index + query.length)}
    </>
  );
}

export interface ComboOption {
  id: string;
  label: string;
  hint?: string;
}

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  tone,
  disabled,
  emptyText = "No matches",
}: {
  id?: string;
  options: ComboOption[];
  value: ComboOption | null;
  onChange: (option: ComboOption) => void;
  placeholder?: string;
  tone?: FieldTone;
  disabled?: boolean;
  emptyText?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  function close() {
    setOpen(false);
    setQuery(null);
  }

  function pick(option: ComboOption) {
    onChange(option);
    close();
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query ?? value?.label ?? ""}
        className={cx(inputClass(tone), "pr-8")}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
          setActive(0);
        }}
        onBlur={close}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && filtered[active]) {
            e.preventDefault();
            pick(filtered[active]);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            close();
          }
        }}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
      {open && (
        <ul id={listId} role="listbox" className={popoverClass}>
          {filtered.length === 0 && <li className="px-2.5 py-2 text-[12px] text-muted">{emptyText}</li>}
          {filtered.map((option, i) => (
            <li
              key={option.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(option)}
              className={optionClass(i === active)}
            >
              <span className="truncate">
                <Highlight text={option.label} query={query ?? ""} />
              </span>
              {option.hint && <small className="font-mono text-[10.5px] text-muted">{option.hint}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const popoverClass =
  "absolute inset-x-0 top-[calc(100%+5px)] z-20 max-h-64 overflow-y-auto rounded-lg border border-line bg-pop p-1 shadow-[0_16px_32px_-12px_var(--shadow-strong)]";

export function optionClass(active: boolean): string {
  return cx(
    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12.5px]",
    active ? "bg-lime/10 text-fg" : "text-muted",
  );
}
