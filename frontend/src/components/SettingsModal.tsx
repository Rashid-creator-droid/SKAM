type SettingsModalProps = {
  userEmail?: string | null;
  onLogout: () => void;
  onClose: () => void;
};

export function SettingsModal({ userEmail, onLogout, onClose }: SettingsModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Настройки</h2>

        <div style={{ marginBottom: 24, padding: 16, backgroundColor: "#f9fafb", borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Пользователь</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{userEmail || "Неизвестно"}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            className="btn"
            onClick={() => {
              onLogout();
              onClose();
            }}
            style={{
              width: "100%",
              borderColor: "#ef4444",
              color: "#ef4444",
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
