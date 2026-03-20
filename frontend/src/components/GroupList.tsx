import type { GroupWithRole } from "../types/groups";

type GroupListProps = {
  groups: GroupWithRole[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: () => void;
};

export function GroupList({ groups, selectedGroupId, onSelectGroup, onCreateGroup }: GroupListProps) {
  return (
    <div className="groupList">
      <h3 style={{ margin: "0 0 12px 0", fontSize: 13, color: "#6b7280", textTransform: "uppercase" }}>
        Группы
      </h3>

      <div style={{ flex: 1, overflow: "auto", marginBottom: 12 }}>
        {groups.length === 0 ? (
          <div className="muted" style={{ fontSize: 13, padding: 8 }}>
            У вас пока нет групп
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {groups.map((group) => (
              <li
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                style={{
                  padding: "10px 12px",
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: selectedGroupId === group.id ? "#fce7f3" : "transparent",
                  fontSize: 14,
                  fontWeight: selectedGroupId === group.id ? 600 : 400,
                  transition: "background-color 0.2s",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 14 }}>{group.name}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {group.user_role === "admin" && "👑 Админ"}
                  {group.user_role === "moderator" && "🛡️ Модератор"}
                  {group.user_role === "member" && "👤 Участник"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onCreateGroup}
        style={{
          width: "100%",
          padding: "10px",
          border: "2px dashed #ec4899",
          borderRadius: 8,
          background: "transparent",
          color: "#ec4899",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        + Новая группа
      </button>
    </div>
  );
}
