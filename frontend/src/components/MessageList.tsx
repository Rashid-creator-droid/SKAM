import { deleteJson } from "../api";

type ChatMessage = {
  id: string;
  user_id: string;
  user_email: string;
  text: string;
  created_at: string;
  group_id?: string;
};

type MessageListProps = {
  messages: ChatMessage[];
  currentUserId?: string;
  jwt?: string;
  canModerate?: boolean;
  onDeleteMessage?: (messageId: string) => void;
};

export function MessageList({ messages, currentUserId, jwt, canModerate, onDeleteMessage }: MessageListProps) {
  const handleDelete = async (messageId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!jwt) return;
    
    if (!confirm("Удалить это сообщение?")) return;
    
    try {
      await deleteJson<{ message: string }>(`/chat/messages/${messageId}`, jwt);
      if (onDeleteMessage) {
        onDeleteMessage(messageId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  if (messages.length === 0) {
    return (
      <div className="muted" style={{ textAlign: "center", padding: 20 }}>
        Сообщений пока нет. Напишите первым!
      </div>
    );
  }

  return (
    <>
      {messages.map((m) => {
        const isAuthor = currentUserId === m.user_id;
        const canDelete = isAuthor || canModerate;
        
        return (
          <div key={m.id} style={{ marginBottom: 12, position: "relative" }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              <b style={{ color: "#ec4899" }}>{m.user_email}</b>{" "}
              <span style={{ color: "#9ca3af" }}>
                {new Date(m.created_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div style={{ color: "#374151", fontSize: 15, lineHeight: 1.5 }}>{m.text}</div>
            {canDelete && jwt && (
              <button
                onClick={(e) => handleDelete(m.id, e)}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontSize: 16,
                  padding: 0,
                  lineHeight: 1,
                  opacity: 0.7,
                }}
                title="Удалить сообщение"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
