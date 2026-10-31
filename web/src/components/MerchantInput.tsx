import { useId, useState } from "react";
import { normalize, type Merchant } from "../lib/lookups";
import { Highlight, inputClass, optionClass, popoverClass, type FieldTone } from "./ui";

type Item = { kind: "merchant"; merchant: Merchant } | { kind: "new"; name: string };

export function MerchantInput({
  id,
  value,
  onChange,
  onPick,
  merchants,
  tone,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (merchant: Merchant) => void;
  merchants: Merchant[];
  tone?: FieldTone;
  disabled?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(0);

  const query = typed ? value.trim() : "";
  const q = query.toLowerCase();
  const matches = q ? merchants.filter((m) => m.name.toLowerCase().includes(q)).sort((a, b) => b.count - a.count).slice(0, 5) : [];
  const recent = merchants.filter((m) => !matches.includes(m)).slice(0, q ? 3 : 6);
  const exact = merchants.some((m) => normalize(m.name) === normalize(query));

  const items: Item[] = [
    ...matches.map((merchant): Item => ({ kind: "merchant", merchant })),
    ...recent.map((merchant): Item => ({ kind: "merchant", merchant })),
    ...(query && !exact ? [{ kind: "new", name: query } as Item] : []),
  ];

  function close() {
    setOpen(false);
    setTyped(false);
  }

  function choose(item: Item) {
    if (item.kind === "merchant") {
      onChange(item.merchant.name);
      onPick(item.merchant);
    } else {
      onChange(item.name);
    }
    close();
  }

  const renderMerchant = (merchant: Merchant, index: number) => (
    <li
      key={merchant.name}
      role="option"
      aria-selected={index === active}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setActive(index)}
      onClick={() => choose(items[index])}
      className={optionClass(index === active)}
    >
      <span className="truncate">
        <Highlight text={merchant.name} query={query} />
      </span>
      <small className="font-mono text-[10.5px] text-muted">{merchant.count}×</small>
    </li>
  );

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder="Where did you spend?"
        value={value}
        className={inputClass(tone)}
        onFocus={() => {
          setOpen(true);
          setActive(-1);
        }}
        onBlur={close}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && items[active]) {
            e.preventDefault();
            choose(items[active]);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            close();
          }
        }}
      />
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className={popoverClass}>
          {matches.length > 0 && <GroupLabel>Matches</GroupLabel>}
          {matches.map((m, i) => renderMerchant(m, i))}
          {recent.length > 0 && <GroupLabel>Recent</GroupLabel>}
          {recent.map((m, i) => renderMerchant(m, matches.length + i))}
          {query && !exact && (
            <li
              role="option"
              aria-selected={active === items.length - 1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(items.length - 1)}
              onClick={() => choose({ kind: "new", name: query })}
              className={`mt-1 cursor-pointer rounded-md border-t border-line px-2.5 py-2 text-[12px] font-medium text-lime ${active === items.length - 1 ? "bg-lime/10" : ""}`}
            >
              + Use “{query}” as new merchant
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: string }) {
  return <li className="px-2.5 pt-2 pb-1 font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">{children}</li>;
}
