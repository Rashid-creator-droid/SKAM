import { useState } from "react";
import { postJson } from "../api";

type AuthResponse = {
  token: string;
  user: { id: string; email: string };
};

type PasswordLoginProps = {
  onAuthed: (jwt: string) => void;
};

export function PasswordLogin({ onAuthed }: PasswordLoginProps) {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(kind: "login" | "register") {
    setLoading(true);
    setErr("");
    try {
      const res = await postJson<AuthResponse>(`/auth/${kind}`, { email, password });
      onAuthed(res.token);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="field">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Пароль</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
        />
        <div className="muted">Минимум 8 символов (для регистрации).</div>
      </div>
      <div className="btnRow">
        <button
          className="btn btnPrimary"
          disabled={loading}
          onClick={() => submit("login")}
        >
          Войти
        </button>
        <button className="btn" disabled={loading} onClick={() => submit("register")}>
          Зарегистрироваться
        </button>
      </div>
      {err ? <div className="error">{err}</div> : null}
    </>
  );
}
