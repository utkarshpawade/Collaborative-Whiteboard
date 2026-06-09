"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getErrorMessage } from "../lib/api";
import { clearToken, getToken, setToken } from "../lib/auth";

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setSignedIn(Boolean(getToken()));
  }, []);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post("/signin", { username: email, password });
      setToken(res.data.token);
      setSignedIn(true);
    } catch (err) {
      setError(getErrorMessage(err, "Sign in failed"));
    } finally {
      setBusy(false);
    }
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const slug = roomId.trim();
    if (slug) router.push(`/room/${encodeURIComponent(slug)}`);
  }

  function handleSignOut() {
    clearToken();
    setSignedIn(false);
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <h1 style={{ marginBottom: 16 }}>Chat rooms</h1>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        {signedIn ? (
          <>
            <form onSubmit={handleJoin} style={{ display: "flex", gap: 8 }}>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                type="text"
                placeholder="Room name"
                required
                style={{ flex: 1, padding: 10 }}
              />
              <button type="submit" style={{ padding: 10 }}>
                Join room
              </button>
            </form>
            <button
              type="button"
              onClick={handleSignOut}
              style={{ marginTop: 12, padding: 8 }}
            >
              Sign out
            </button>
          </>
        ) : (
          <form onSubmit={handleAuth} style={{ display: "grid", gap: 8 }}>
            <p style={{ opacity: 0.7, margin: 0 }}>
              Sign in with the account you created in the drawing app.
            </p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              style={{ padding: 10 }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              style={{ padding: 10 }}
            />
            <button type="submit" disabled={busy} style={{ padding: 10 }}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
