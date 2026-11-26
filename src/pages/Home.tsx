import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, setHostKey, type LocationPick, type Meta } from "../api";
import { HostKeyPrompt, LocationPicker } from "../components";

// Host landing: pick a location, start a season.
export default function Home() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState("");
  const [needKey, setNeedKey] = useState(false);

  useEffect(() => {
    const k = params.get("host");
    if (k) setHostKey(k);
    api.meta().then(setMeta).catch((e) => setErr(e.message));
    api.hostCheck().catch((e) => { if (e instanceof ApiError && e.status === 401) setNeedKey(true); });
  }, [params]);

  async function start(pick: LocationPick) {
    try {
      const { code } = await api.createSeason(pick);
      nav(`/host/${code}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedKey(true);
      else throw e;
    }
  }

  if (needKey) return <HostKeyPrompt onDone={() => setNeedKey(false)} />;

  return (
    <div className="page">
      <header className="hero-title">
        <div className="eyebrow">Family Edition</div>
        <h1>ALONE</h1>
        <p className="sub">Ten items. One location. Who lasts the longest?</p>
      </header>

      <section className="card">
        <h2>Choose the location for this season</h2>
        {meta ? (
          <LocationPicker
            locations={meta.locations}
            actionLabel="Start a new season"
            busyLabel="Starting…"
            onSubmit={start}
            extra={<a className="link" href="/join">Joining from a phone? Enter a code →</a>}
          />
        ) : <p className="muted">Loading…</p>}
        {err && <p className="error">{err}</p>}
      </section>
    </div>
  );
}
