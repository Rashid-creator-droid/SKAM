export type ApiError = { error: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return text as any;
  }
}

export async function postJson<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await readJson<ApiError>(res);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return readJson<T>(res);
}

export async function getJson<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const data = await readJson<ApiError>(res);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return readJson<T>(res);
}

export async function putJson<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await readJson<ApiError>(res);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return readJson<T>(res);
}

export async function deleteJson<T>(
  path: string,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const data = await readJson<ApiError>(res);
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return readJson<T>(res);
}

