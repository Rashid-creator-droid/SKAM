import { useState } from "react";
import { PasswordLogin } from "./PasswordLogin";
import { QRLogin } from "./QRLogin";

type Tab = "password" | "qr";

type AuthTabsProps = {
  onAuthed: (jwt: string) => void;
};

export function AuthTabs({ onAuthed }: AuthTabsProps) {
  const [tab, setTab] = useState<Tab>("password");

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Auth tabs">
        <button
          className={`tab ${tab === "password" ? "tabActive" : ""}`}
          onClick={() => setTab("password")}
          role="tab"
        >
          Пароль
        </button>
        <button
          className={`tab ${tab === "qr" ? "tabActive" : ""}`}
          onClick={() => setTab("qr")}
          role="tab"
        >
          QR
        </button>
      </div>

      {tab === "password" ? (
        <PasswordLogin onAuthed={onAuthed} />
      ) : (
        <QRLogin onAuthed={onAuthed} />
      )}
    </>
  );
}
