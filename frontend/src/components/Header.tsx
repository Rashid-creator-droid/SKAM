import { useNavigate } from "react-router-dom";
import logo from "../../images/logo.png";

type HeaderProps = {
  jwt: string;
  onLogout: () => void;
  onSettingsClick?: () => void;
};

export function Header({ jwt, onLogout, onSettingsClick }: HeaderProps) {
  const navigate = useNavigate();
  const authed = Boolean(jwt);

  return (
    <div className="header" style={{
      backgroundColor: "#fce7f3",
      borderBottom: "1px solid #fbcfe8",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 24px",
      height: 80,
    }}>
      <img
        src={logo}
        alt="Logo"
        onClick={() => navigate("/chat")}
        style={{
          height: 56,
          width: "auto",
          cursor: "pointer",
        }}
      />

      <div className="btnRow">
        {authed && onSettingsClick ? (
          <button
            className="btn"
            onClick={onSettingsClick}
            style={{ padding: "10px 14px", fontSize: 22 }}
            title="Настройки"
          >
            ⚙️
          </button>
        ) : null}
      </div>
    </div>
  );
}
