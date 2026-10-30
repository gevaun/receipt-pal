import type { ComponentType, ReactNode, SVGProps } from "react";
import { NavLink, Outlet } from "react-router";
import { useTheme, type ThemePreference } from "../lib/theme";
import { DashboardIcon, ListIcon, MonitorIcon, MoonIcon, ScanIcon, SunIcon, TagIcon } from "./icons";
import { cx } from "./ui";

const themes: { value: ThemePreference; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

function ThemeSwitch() {
  const [preference, setPreference] = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-0.5 rounded-lg border border-line p-0.5 md:flex-row">
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          title={label}
          onClick={() => setPreference(value)}
          className={cx(
            "grid h-7 flex-1 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-lime",
            preference === value ? "bg-raise text-fg" : "text-muted hover:text-fg",
          )}
        >
          <Icon className="size-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

const links: { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/scan", label: "Scan", icon: ScanIcon },
  { to: "/transactions", label: "Transactions", icon: ListIcon },
  { to: "/categories", label: "Categories", icon: TagIcon },
];

export function BrandMark() {
  return (
    <span className="relative block size-5 shrink-0 rounded-[5px] border-[1.5px] border-fg" aria-hidden="true">
      <span className="absolute inset-x-[2px] top-[6.5px] h-[2px] bg-lime shadow-[0_0_6px_var(--color-lime)]" />
    </span>
  );
}

export function Layout() {
  return (
    <div className="grid h-dvh grid-cols-[64px_1fr] md:grid-cols-[188px_1fr]">
      <nav className="flex flex-col gap-8 border-r border-line px-3 py-6 md:px-3.5" aria-label="Main">
        <div className="flex items-center gap-2.5 px-2.5">
          <BrandMark />
          <span className="hidden text-[15px] font-semibold tracking-[-0.02em] md:block">Receipt Pal</span>
        </div>
        <ul className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                title={label}
                className={({ isActive }) =>
                  cx(
                    "group flex h-9 items-center gap-2.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-lime",
                    isActive ? "border-line bg-raise text-fg" : "border-transparent text-muted hover:bg-raise/60 hover:text-fg",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cx("size-4 shrink-0", isActive && "text-lime")} />
                    <span className="hidden md:inline">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto -mb-3">
          <ThemeSwitch />
        </div>
        <div className="flex items-center gap-2 px-2.5 text-[11.5px] text-muted">
          <span className="size-1.5 shrink-0 rounded-full bg-lime shadow-[0_0_6px_var(--color-lime)]" />
          <span className="hidden md:inline">Money Manager</span>
        </div>
      </nav>
      <main className="dot-grid min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end gap-3">
      <div>
        <div className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{eyebrow}</div>
        <h1 className="mt-1 text-[24px] leading-tight font-medium tracking-[-0.03em]">{title}</h1>
      </div>
      {children}
    </header>
  );
}
