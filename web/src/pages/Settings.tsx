import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/Layout";
import { Banner, Button, cx, inputClass } from "../components/ui";
import { getConnectionStatus, getSettings, saveSettings, type ConnectionStatus, type Settings as SavedSettings } from "../lib/api";
import { useInvalidate } from "../lib/data";

export function Settings() {
  const invalidate = useInvalidate();
  const [saved, setSaved] = useState<SavedSettings | null>(null);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    try {
      setStatus(await getConnectionStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setSaved(settings);
        setAddress(settings.money_manager_base_url ?? "");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    void check();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const settings = await saveSettings(address);
      setSaved(settings);
      setAddress(settings.money_manager_base_url ?? "");
      setNotice("Saved. Checking the connection…");
      invalidate();
      await check();
      setNotice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const unchanged = address.trim() === (saved?.money_manager_base_url ?? "");

  return (
    <div className="mx-auto max-w-[1080px] px-6 py-7 md:px-10">
      <PageHeader eyebrow="Settings" title="Money Manager" />

      <form onSubmit={save} className="flex max-w-xl flex-col gap-5 rounded-xl border border-fg/10 bg-void p-5">
        <div>
          <label htmlFor="mm-address" className="text-[0.8125rem] font-medium">
            Server address
          </label>
          <p className="mt-1 text-[0.75rem] text-pretty text-muted">
            Shown on your phone when you start Money Manager's PC Manager. It's saved on this computer, so you only need
            to change it when the address changes.
          </p>
          <input
            id="mm-address"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="192.168.100.203:8888"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={cx(inputClass(), "mt-3 font-mono")}
          />
          {saved?.source === "env" && (
            <p className="mt-2 text-[0.75rem] text-muted">
              Currently using <code className="font-mono">MONEY_MANAGER_BASE_URL</code> from the backend's .env. Saving
              here overrides it.
            </p>
          )}
        </div>

        {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

        <div className="flex flex-wrap items-center gap-3 border-t border-fg/10 pt-4">
          <Button type="submit" disabled={saving || unchanged || !address.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={() => void check()} disabled={checking || saving}>
            {checking ? "Checking…" : "Test connection"}
          </Button>
          <StatusLine status={status} checking={checking} notice={notice} />
        </div>
      </form>
    </div>
  );
}

function StatusLine({ status, checking, notice }: { status: ConnectionStatus | null; checking: boolean; notice: string | null }) {
  if (notice || checking || !status) {
    return <p className="text-[0.75rem] text-muted">{notice ?? "Checking…"}</p>;
  }
  if (!status.configured) {
    return <p className="text-[0.75rem] text-check">No address saved yet.</p>;
  }
  if (status.reachable) {
    return (
      <p className="flex items-center gap-2 text-[0.75rem] text-muted">
        <span className="size-1.5 rounded-full bg-lime shadow-[0_0_6px_var(--color-lime)]" />
        Connected to <span className="font-mono text-fg">{status.money_manager_base_url}</span>
      </p>
    );
  }
  return (
    <p className="text-[0.75rem] text-pretty text-alert">
      Can't reach <span className="font-mono">{status.money_manager_base_url}</span>. Check that PC Manager is running and
      this computer is on the same Wi-Fi as your phone.
    </p>
  );
}
