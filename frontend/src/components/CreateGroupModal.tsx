import { useState } from "react";
import { createGroup } from "../api/groups";

type CreateGroupModalProps = {
  jwt: string;
  onClose: () => void;
  onSuccess: (groupId: string) => void;
};

export function CreateGroupModal({ jwt, onClose, onSuccess }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Название группы обязательно");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const group = await createGroup({ name: name.trim(), description: description.trim() }, jwt);
      onSuccess(group.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания группы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h2 style={{ marginTop: 0, marginBottom: 20 }}>Создать группу</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
              Название группы *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание группы (необязательно)"
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
            />
          </div>

          {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btnSecondary" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" className="btn btnPrimary" disabled={loading}>
              {loading ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
