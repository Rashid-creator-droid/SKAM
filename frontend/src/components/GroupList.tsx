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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Группы</h3>
        <button className="btn btnPrimary" onClick={onCreateGroup} style={{ padding: "4px 8px", fontSize: 13 }}>
          + Создать
        </button>
      </div>
      
      {groups.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, padding: 8 }}>
          У вас пока нет групп
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {groups.map((group) => (
            <li
              key={group.id}
              className={`groupItem ${selectedGroupId === group.id ? "selected" : ""}`}
              onClick={() => onSelectGroup(group.id)}
              style={{
                padding: "8px 12px",
                marginBottom: 4,
                borderRadius: 6,
                cursor: "pointer",
                backgroundColor: selectedGroupId === group.id ? "#fce7f3" : "transparent",
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
  );
}
