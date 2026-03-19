import { useState } from "react";
import { postJson } from "../api";

type UserSearchResult = {
  id: string;
  email: string;
};

type UserSearchProps = {
  jwt: string;
  onSelect: (userId: string, email: string) => void;
  onError: (error: string) => void;
};

// Временное решение - в будущем нужен отдельный endpoint для поиска пользователей
export function UserSearch({ jwt, onSelect, onError }: UserSearchProps) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<UserSearchResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSearching(true);
    setResult(null);

    try {
      // TODO: Нужен endpoint GET /users?email=... для поиска
      // Пока заглушка - в реальном проекте нужен API endpoint
      onError("Поиск пользователей будет реализован через отдельный API endpoint");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Ошибка поиска");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email пользователя"
          style={{ flex: 1 }}
        />
        <button className="btn btnSecondary" disabled={searching || !email.trim()}>
          {searching ? "..." : "Найти"}
        </button>
      </form>
      {result && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: "#f3f4f6",
            borderRadius: 4,
            cursor: "pointer",
          }}
          onClick={() => onSelect(result.id, result.email)}
        >
          {result.email}
        </div>
      )}
    </div>
  );
}
