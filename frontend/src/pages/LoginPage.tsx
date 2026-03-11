import { useNavigate } from "react-router-dom";
import { AuthTabs } from "../components";

const LS_TOKEN = "skam_web_jwt";

export function LoginPage() {
  const navigate = useNavigate();

  function setToken(token: string) {
    if (token) {
      localStorage.setItem(LS_TOKEN, token);
      navigate("/chat");
    } else {
      localStorage.removeItem(LS_TOKEN);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="header" style={{ borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
          <div>
            <div className="title">SKAM</div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <AuthTabs onAuthed={setToken} />
        </div>
      </div>
    </div>
  );
}
