import { useNavigate } from "react-router-dom";

type HeaderProps = {
  jwt: string;
  onLogout: () => void;
  showChatTitle?: boolean;
};

export function Header({ jwt, onLogout, showChatTitle }: HeaderProps) {
  const navigate = useNavigate();
  const authed = Boolean(jwt);

  return (
    <div className="header">
      <div>
        <div className="title" style={{ cursor: "pointer" }} onClick={() => navigate("/chat")}>
          {showChatTitle ? "Чат" : "SKAM"}
        </div>
      </div>

      <div className="btnRow">
        {authed ? (
          <button className="btn" onClick={onLogout}>
            Выйти
          </button>
        ) : null}
      </div>
    </div>
  );
}
