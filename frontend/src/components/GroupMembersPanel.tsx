import { useState, useEffect } from "react";
import { getGroupMembers, addMember, removeMember, changeRole, transferAdminship } from "../api/groups";
import type { GroupMember, GroupRole } from "../types/groups";

type GroupMembersPanelProps = {
  groupId: string;
  jwt: string;
  userRole: GroupRole;
  onClose: () => void;
};

export function GroupMembersPanel({ groupId, jwt, userRole, onClose }: GroupMembersPanelProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const isAdmin = userRole === "admin";

  const loadMembers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getGroupMembers(groupId, jwt);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки участников");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [groupId, jwt]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setAdding(true);
    setSuccessMsg("");
    setError("");

    try {
      await addMember(groupId, { email: newMemberEmail.trim() }, jwt);
      setSuccessMsg("Участник добавлен");
      setNewMemberEmail("");
      await loadMembers();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка добавления участника");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberEmail: string, memberRole: GroupRole) => {
    if (memberRole === "admin" && !isAdmin) {
      setError("Только админ может удалять администраторов");
      return;
    }

    if (!confirm(`Удалить пользователя ${memberEmail} из группы?`)) return;

    try {
      setError("");
      await removeMember(groupId, userId, jwt);
      setSuccessMsg("Участник удален");
      await loadMembers();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления участника");
    }
  };

  const handleChangeRole = async (userId: string, newRole: GroupRole) => {
    if (!isAdmin) return;

    try {
      setError("");
      await changeRole(groupId, { user_id: userId, role: newRole }, jwt);
      setSuccessMsg("Роль изменена");
      await loadMembers();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения роли");
    }
  };

  const handleTransferAdmin = async (newAdminId: string) => {
    if (!isAdmin) return;

    if (!confirm("Вы уверены, что хотите передать права администратора? Вы станете модератором.")) return;

    try {
      setError("");
      await transferAdminship(groupId, { new_admin_id: newAdminId }, jwt);
      setSuccessMsg("Права администратора переданы");
      await loadMembers();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка передачи прав");
    }
  };

  const canModerate = isAdmin || userRole === "moderator";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Участники группы</h2>
          <button className="btn btnSecondary" onClick={onClose} style={{ padding: "4px 12px" }}>
            ✕
          </button>
        </div>

        {isAdmin && (
          <form onSubmit={handleAddMember} style={{ marginBottom: 20, padding: 12, backgroundColor: "#f9fafb", borderRadius: 8 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
              Добавить участника
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Email пользователя"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btnPrimary" disabled={adding || !newMemberEmail.trim()}>
                Добавить
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="muted">Загрузка участников...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : successMsg ? (
          <div className="ok">{successMsg}</div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 10,
                backgroundColor: "#f9fafb",
                borderRadius: 6,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{member.email}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {member.role === "admin" && "👑 Администратор"}
                  {member.role === "moderator" && "🛡️ Модератор"}
                  {member.role === "member" && "👤 Участник"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {isAdmin && member.role !== "admin" && (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => handleChangeRole(member.user_id, e.target.value as GroupRole)}
                      style={{ fontSize: 12, padding: 4 }}
                    >
                      <option value="member">Участник</option>
                      <option value="moderator">Модератор</option>
                    </select>
                    <button
                      className="btn btnSecondary"
                      onClick={() => handleTransferAdmin(member.user_id)}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      title="Передать права администратора"
                    >
                      👑
                    </button>
                  </>
                )}
                {canModerate && member.role !== "admin" && (
                  <button
                    className="btn btnSecondary"
                    onClick={() => handleRemoveMember(member.user_id, member.email, member.role)}
                    style={{ fontSize: 11, padding: "4px 8px", color: "#dc2626" }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
