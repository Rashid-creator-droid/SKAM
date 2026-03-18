import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJson } from "../api";
import { getUserGroups, getGroupMembers, createGroup } from "../api/groups";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { Header } from "../components/Header";
import { GroupMembersPanel } from "../components/GroupMembersPanel";
import type { GroupWithRole, GroupMember } from "../types/groups";

type MeResponse = { id: string; email: string };

type ChatMessage = {
  id: string;
  user_id: string;
  user_email: string;
  text: string;
  created_at: string;
  group_id?: string;
};

const LS_TOKEN = "skam_web_jwt";

export function ChatPage() {
  const navigate = useNavigate();
  const [jwt, setJwt] = useState<string>(() => localStorage.getItem(LS_TOKEN) ?? "");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meErr, setMeErr] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [err, setErr] = useState("");
  
  // Группы
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [userRoleInGroup, setUserRoleInGroup] = useState<"admin" | "moderator" | "member" | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  
  // Модальное окно создания группы
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!jwt) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    setMeErr("");

    getJson<MeResponse>("/auth/me", jwt)
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMe(null);
          setMeErr(e instanceof Error ? e.message : "Ошибка");
          localStorage.removeItem(LS_TOKEN);
          navigate("/login");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jwt, navigate]);

  // Загрузка групп
  useEffect(() => {
    if (!jwt) return;

    let cancelled = false;

    const loadGroups = async () => {
      try {
        const data = await getUserGroups(jwt);
        if (!cancelled) {
          // Гарантируем что это массив
          const groupsArray = Array.isArray(data) ? data : [];
          setGroups(groupsArray);
          setGroupsLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          console.error('Ошибка загрузки групп:', e);
          setErr((prev) => (prev ? prev : e instanceof Error ? e.message : "Ошибка загрузки групп"));
          setGroups([]);
          setGroupsLoading(false);
        }
      }
    };

    void loadGroups();
  }, [jwt]);

  // Загрузка участников группы
  useEffect(() => {
    if (!jwt || !selectedGroupId) return;

    let cancelled = false;

    const loadMembers = async () => {
      try {
        const data = await getGroupMembers(selectedGroupId, jwt);
        if (!cancelled) {
          setGroupMembers(data);
          const currentMember = data.find(m => m.user_id === me?.id);
          if (currentMember) {
            setUserRoleInGroup(currentMember.role);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr((prev) => (prev ? prev : e instanceof Error ? e.message : "Ошибка загрузки участников"));
        }
      }
    };

    void loadMembers();
    return () => { cancelled = true; };
  }, [selectedGroupId, jwt, me?.id]);

  // Polling сообщений
  useEffect(() => {
    if (!jwt || !selectedGroupId) return;

    let cancelled = false;
    let lastSince: string | null = null;

    const fetchOnce = async () => {
      try {
        const params = new URLSearchParams();
        params.set("group_id", selectedGroupId);
        if (lastSince) {
          params.set("since", lastSince);
        }
        const res = await getJson<ChatMessage[]>(`/chat/messages?${params.toString()}`, jwt);
        if (cancelled) return;
        if (res.length === 0) return;

        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          for (const m of res) {
            if (!existing.has(m.id)) merged.push(m);
          }
          return merged;
        });

        const last = res[res.length - 1];
        lastSince = last.created_at;
      } catch (e: unknown) {
        if (cancelled) return;
        setErr((prev) => (prev ? prev : e instanceof Error ? e.message : "Ошибка чата"));
      }
    };

    void fetchOnce();
    const id = window.setInterval(fetchOnce, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jwt, selectedGroupId]);

  function setToken(token: string) {
    setJwt(token);
    if (token) localStorage.setItem(LS_TOKEN, token);
    else localStorage.removeItem(LS_TOKEN);
  }

  const handleSendMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleError = (error: string) => {
    setErr(error);
  };

  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter(m => m.id !== messageId));
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    setCreating(true);
    try {
      const group = await createGroup({ 
        name: newGroupName.trim(), 
        description: newGroupDesc.trim() 
      }, jwt);
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setSelectedGroupId(group.id);
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Ошибка создания группы");
    } finally {
      setCreating(false);
    }
  };

  const canModerate = userRoleInGroup === "admin" || userRoleInGroup === "moderator";
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // Если данные еще загружаются - показываем индикатор
  if (groupsLoading) {
    return (
      <div className="chatPage" style={{ padding: 0 }}>
        <Header jwt={jwt} onLogout={() => { setToken(""); navigate("/login"); }} showChatTitle />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="muted">Загрузка...</div>
        </div>
      </div>
    );
  }

  // Если группы не выбраны - показываем экран выбора групп
  if (!selectedGroupId) {
    return (
      <div className="chatPage" style={{ padding: 0 }}>
        <Header jwt={jwt} onLogout={() => { setToken(""); navigate("/login"); }} showChatTitle />
        
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>
          {me ? (
            <div className="ok" style={{ marginBottom: 24 }}>
              <b>{me.email}</b> в сети
            </div>
          ) : meErr ? (
            <div className="error" style={{ marginBottom: 24 }}>{meErr}</div>
          ) : null}

          <h2 style={{ marginBottom: 20 }}>Ваши группы</h2>

          {groups.length === 0 ? (
            <div className="muted" style={{ textAlign: "center", padding: 40, fontSize: 16 }}>
              У вас пока нет групп.<br />Нажмите + чтобы создать новую.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  style={{
                    padding: 20,
                    border: "2px solid #e5e7eb",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backgroundColor: "#fff",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#ec4899";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(236, 72, 153, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>{group.name}</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {group.user_role === "admin" && "👑 Администратор"}
                    {group.user_role === "moderator" && "🛡️ Модератор"}
                    {group.user_role === "member" && "👤 Участник"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Большая кнопка + внизу */}
        <button
          onClick={() => setShowCreateGroup(true)}
          style={{
            position: "fixed",
            bottom: 40,
            right: 40,
            width: 70,
            height: 70,
            borderRadius: "50%",
            border: "none",
            background: "linear-gradient(135deg, #ec4899, #f472b6)",
            color: "white",
            fontSize: 40,
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(236, 72, 153, 0.4)",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 8px 25px rgba(236, 72, 153, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(236, 72, 153, 0.4)";
          }}
        >
          +
        </button>

        {/* Модальное окно создания группы */}
        {showCreateGroup && (
          <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <h2 style={{ marginTop: 0, marginBottom: 20 }}>Новая группа</h2>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Название группы *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Введите название"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Описание
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Описание (необязательно)"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                />
              </div>

              {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button className="btn btnSecondary" onClick={() => setShowCreateGroup(false)} disabled={creating}>
                  Отмена
                </button>
                <button className="btn btnPrimary" onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
                  {creating ? "Создание..." : "Создать"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Экран чата
  return (
    <div className="chatPage">
      <div className="chatCard" style={{ display: "flex", height: "100vh" }}>
        {/* Боковая панель с группами */}
        <div style={{ width: 250, borderRight: "1px solid #e5e7eb", padding: 16, overflow: "auto", backgroundColor: "#fafafa" }}>
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setSelectedGroupId(null)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "2px solid #e5e7eb",
                borderRadius: 8,
                background: "white",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ← Назад к группам
            </button>
          </div>
          
          <h4 style={{ margin: "0 0 12px 0", fontSize: 13, color: "#6b7280", textTransform: "uppercase" }}>Ваши группы</h4>
          
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {groups.map((group) => (
              <li
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                style={{
                  padding: "10px 12px",
                  marginBottom: 4,
                  borderRadius: 6,
                  cursor: "pointer",
                  backgroundColor: selectedGroupId === group.id ? "#fce7f3" : "transparent",
                  fontSize: 14,
                  fontWeight: selectedGroupId === group.id ? 600 : 400,
                }}
              >
                {group.name}
              </li>
            ))}
          </ul>
          
          <button
            onClick={() => setShowCreateGroup(true)}
            style={{
              width: "100%",
              marginTop: 16,
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

        {/* Основная область чата */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Header jwt={jwt} onLogout={() => { setToken(""); navigate("/login"); }} showChatTitle />

          {/* Заголовок группы */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginBottom: 12,
            padding: "12px 16px",
            backgroundColor: "#fce7f3",
            borderRadius: 8
          }}>
            <div>
              <b style={{ fontSize: 16 }}>{selectedGroup?.name}</b>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {userRoleInGroup === "admin" && "👑 Администратор"}
                {userRoleInGroup === "moderator" && "🛡️ Модератор"}
                {userRoleInGroup === "member" && "👤 Участник"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btnSecondary"
                onClick={() => setShowMembersPanel(true)}
                style={{ fontSize: 13, padding: "6px 14px" }}
              >
                Участники ({groupMembers.length})
              </button>
            </div>
          </div>

          <div className="chatMessages" style={{ flex: 1, overflow: "auto" }}>
            <MessageList
              messages={messages}
              currentUserId={me?.id}
              jwt={jwt}
              canModerate={canModerate}
              onDeleteMessage={handleDeleteMessage}
            />
          </div>

          <MessageInput
            jwt={jwt}
            groupId={selectedGroupId}
            onMessageSent={handleSendMessage}
            onError={handleError}
          />

          {err ? <div className="error">{err}</div> : null}
        </div>
      </div>

      {/* Панель участников */}
      {showMembersPanel && selectedGroupId && userRoleInGroup && (
        <GroupMembersPanel
          groupId={selectedGroupId}
          jwt={jwt}
          userRole={userRoleInGroup}
          onClose={() => setShowMembersPanel(false)}
        />
      )}

      {/* Модальное окно создания группы */}
      {showCreateGroup && (
        <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>Новая группа</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                Название группы *
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Введите название"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>
                Описание
              </label>
              <textarea
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Описание (необязательно)"
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btnSecondary" onClick={() => setShowCreateGroup(false)} disabled={creating}>
                Отмена
              </button>
              <button className="btn btnPrimary" onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()}>
                {creating ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
