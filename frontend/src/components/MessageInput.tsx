import { useState } from "react";
import { postJson } from "../api";

type ChatMessage = {
  id: string;
  user_id: string;
  user_email: string;
  text: string;
  created_at: string;
  group_id?: string;
};

type MessageInputProps = {
  jwt: string;
  groupId?: string | null;
  onMessageSent: (message: ChatMessage) => void;
  onError: (error: string) => void;
};

export function MessageInput({ jwt, groupId, onMessageSent, onError }: MessageInputProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || !jwt) return;

    setSending(true);
    try {
      const msg = await postJson<ChatMessage>(
        "/chat/messages",
        { text, group_id: groupId || undefined },
        jwt,
      );
      onMessageSent(msg);
      setInput("");
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chatInput">
      <input
        placeholder={groupId ? "Написать сообщение в группу..." : "Написать сообщение..."}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button className="btn btnPrimary" disabled={sending || !input.trim()} onClick={send}>
        Отправить
      </button>
    </div>
  );
}
