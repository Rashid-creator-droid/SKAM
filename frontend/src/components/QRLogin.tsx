import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { getJson } from "../api";

type QRCreateResponse = { token: string; expires_in: number };
type QRStatusResponse =
  | { status: "pending" | "used" }
  | { status: "confirmed"; token: string; user: { id: string; email: string } };

type QRLoginProps = {
  onAuthed: (jwt: string) => void;
};

export function QRLogin({ onAuthed }: QRLoginProps) {
  const [qrToken, setQrToken] = useState<string>("");
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!qrToken) return;
    setStatus("pending");
    setErr("");

    let alive = true;
    const interval = window.setInterval(async () => {
      try {
        const res = await getJson<QRStatusResponse>(`/auth/qr/status?token=${encodeURIComponent(qrToken)}`);
        if (!alive) return;

        setStatus(res.status);
        if (res.status === "confirmed") {
          onAuthed(res.token);
          window.clearInterval(interval);
        }
      } catch (e: unknown) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Ошибка");
      }
    }, 1000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [qrToken, onAuthed]);

  async function generate() {
    setLoading(true);
    setErr("");
    setStatus("");
    try {
      const res = await getJson<QRCreateResponse>("/auth/qr");
      setQrToken(res.token);
      setExpiresIn(res.expires_in);
      setStatus("pending");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="muted" style={{ marginBottom: 16 }}>
        Откройте QR → отсканируй в мобильном приложении → подтвердите вход.
      </div>

      <div className="btnRow" style={{ marginBottom: 16 }}>
        <button className="btn btnPrimary" onClick={generate} disabled={loading}>
          Сгенерировать QR
        </button>
        {qrToken ? (
          <span className="muted">
            TTL: ~{expiresIn}s, статус: <b>{status || "—"}</b>
          </span>
        ) : null}
      </div>

      {qrToken ? (
        <div className="qrBox">
          <div className="qrFrame">
            <QRCodeCanvas value={qrToken} size={200} includeMargin />
          </div>
          <div className="mono">
            <div>
              <b>QR token</b>
            </div>
            <div>{qrToken}</div>
          </div>
        </div>
      ) : null}

      {err ? <div className="error">{err}</div> : null}
    </>
  );
}
