import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getJson, deleteJson } from "../api";
import { getUserGroups, getGroupMembers, createGroup, deleteGroup } from "../api/groups";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { Header } from "../components/Header";
import { GroupList } from "../components/GroupList";
import { GroupMembersPanel } from "../components/GroupMembersPanel";
import { SettingsModal } from "../components/SettingsModal";
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

  // Модальное окно настроек
  const [showSettings, setShowSettings] = useState(false);

  // Модальное окно настроек группы
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Последнее сообщение в каждой группе для сортировки
  const [groupLastMessages, setGroupLastMessages] = useState<Record<string, string>>({});

  // Ref для автоскролла
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          
          // Автовыбор первой группы если есть
          if (groupsArray.length > 0 && !selectedGroupId) {
            setSelectedGroupId(groupsArray[0].id);
          }
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

  // Очистка сообщений при переключении группы
  useEffect(() => {
    setMessages([]);
  }, [selectedGroupId]);

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

        // Обновляем время последнего сообщения для группы
        setGroupLastMessages(prev => ({
          ...prev,
          [selectedGroupId]: last.created_at
        }));
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

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // Добавляем новую группу в список с ролью admin
      setGroups((prev) => [...prev, { ...group, user_role: "admin" as const }]);
      setSelectedGroupId(group.id);
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Ошибка создания группы");
    } finally {
      setCreating(false);
    }
  };

  const canModerate = userRoleInGroup === "admin" || userRoleInGroup === "moderator";
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const handleDeleteGroup = async () => {
    if (!selectedGroupId || !jwt) return;
    if (!confirm("Вы уверены, что хотите удалить эту группу?")) return;

    setDeletingGroup(true);
    try {
      await deleteGroup(selectedGroupId, jwt);
      setShowGroupSettings(false);
      // Удаляем группу из списка
      setGroups((prev) => prev.filter(g => g.id !== selectedGroupId));
      // Сбрасываем выбранную группу
      setSelectedGroupId(null);
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Ошибка удаления группы");
    } finally {
      setDeletingGroup(false);
    }
  };

  // Сортировка групп: сначала с последними сообщениями (по убыванию), потом без
  const sortedGroups = [...groups].sort((a, b) => {
    const aTime = groupLastMessages[a.id];
    const bTime = groupLastMessages[b.id];

    // Если есть сообщения в обеих группах - сортируем по времени
    if (aTime && bTime) {
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    }
    // Если есть только в одной - та группа выше, у которой есть
    if (aTime) return -1;
    if (bTime) return 1;
    // Если нет ни в одной - сортируем по названию
    return a.name.localeCompare(b.name);
  });

  // Если данные еще загружаются - показываем индикатор
  if (groupsLoading) {
    return (
      <div className="chatPage" style={{ padding: 0 }}>
        <Header jwt={jwt} onLogout={() => { setToken(""); navigate("/login"); }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="muted">Загрузка...</div>
        </div>
      </div>
    );
  }

  // Экран чата
  return (
    <div className="chatPage" style={{ padding: 0 }}>
      <div className="chatCard" style={{ display: "flex", flexDirection: "column", height: "100vh", padding: 0 }}>
        {/* Header с кнопкой настроек */}
        <Header
          jwt={jwt}
          onLogout={() => { setToken(""); navigate("/login"); }}
          onSettingsClick={() => setShowSettings(true)}
        />

        {/* Основной контент: группы слева + чат справа */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Список групп слева */}
          <div style={{
            width: 280,
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#fafafa",
            minHeight: 0,
          }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Группы</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {groups.length} {groups.length === 1 ? 'группа' : groups.length < 5 ? 'группы' : 'групп'}
              </div>
            </div>

            <GroupList
              groups={sortedGroups}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              onCreateGroup={() => setShowCreateGroup(true)}
            />
          </div>

          {/* Основная область чата */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Заголовок группы */}
            {selectedGroup && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                backgroundColor: "#fce7f3",
                borderBottom: "1px solid #fbcfe8"
              }}>
                <div>
                  <b style={{ fontSize: 16 }}>{selectedGroup.name}</b>
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
                    style={{ fontSize: 13, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}
                    title="Участники"
                  >
                    <span style={{ fontSize: 16 }}>👤</span>
                    <span>{groupMembers.length}</span>
                  </button>
                  {(userRoleInGroup === "admin" || userRoleInGroup === "moderator") && (
                    <button
                      className="btn btnSecondary"
                      onClick={() => setShowGroupSettings(true)}
                      style={{ fontSize: 13, padding: "6px 12px" }}
                      title="Настройки группы"
                    >
                      ⚙️
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Сообщения чата с фиксированной высотой */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: 16,
              overflow: "hidden",
              minHeight: 0,
            }}>
              <div className="chatMessages" style={{
                flex: 1,
                overflow: "auto",
                marginBottom: 16,
                minHeight: 0,
              }}>
                <MessageList
                  messages={messages}
                  currentUserId={me?.id}
                  jwt={jwt}
                  canModerate={canModerate}
                  onDeleteMessage={handleDeleteMessage}
                />
                <div ref={messagesEndRef} />
              </div>

              <MessageInput
                jwt={jwt}
                groupId={selectedGroupId}
                onMessageSent={handleSendMessage}
                onError={handleError}
              />

              {err ? <div className="error" style={{ marginTop: 12 }}>{err}</div> : null}
            </div>
          </div>
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

      {/* Модальное окно настроек */}
      {showSettings && (
        <SettingsModal
          userEmail={me?.email}
          onLogout={() => { setToken(""); navigate("/login"); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Модальное окно настроек группы */}
      {showGroupSettings && (
        <div className="modal-overlay" onClick={() => setShowGroupSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>Настройки группы</h2>

            <div style={{ marginBottom: 24, padding: 16, backgroundColor: "#f9fafb", borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Группа</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedGroup?.name}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                className="btn"
                onClick={handleDeleteGroup}
                disabled={deletingGroup}
                style={{
                  width: "100%",
                  borderColor: "#ef4444",
                  color: "#ef4444",
                }}
              >
                {deletingGroup ? "Удаление..." : "Удалить группу"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
