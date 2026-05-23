import { useState } from "react";
import { Target } from "lucide-react";

const inputCls = "w-full rounded-xl px-4 py-3 text-white text-sm outline-none";
const inputSty = { backgroundColor: "rgba(255,255,255,.07)", caretColor: "#6366F1" } as const;

type Mode = "signin" | "signup";

export function AuthScreen({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (username: string, password: string) => Promise<void>;
  onSignUp: (username: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await onSignUp(username, password);
      else await onSignIn(username, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(
        msg.toLowerCase().includes("failed to fetch")
          ? "Cannot reach Supabase. Save .env with your project URL and API key, restart npm run dev, and check supabase.com that the project is active."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#05050A", fontFamily: "'Inter', sans-serif" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{ backgroundColor: "#0B0B10", boxShadow: "0 0 80px rgba(0,0,0,.85)" }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
          >
            <Target size={28} className="text-white" />
          </div>
          <h1 className="text-white font-bold text-xl">One Stop Planner</h1>
          <p style={{ fontSize: 13, color: "#4E4E72" }}>
            {mode === "signin" ? "Sign in to load your planner" : "Create an account to save your data"}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5" style={{ fontSize: 10, fontWeight: 700, color: "#4E4E72", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Username
            </p>
            <input
              className={inputCls}
              style={inputSty}
              autoComplete="username"
              placeholder="e.g. foster"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div>
            <p className="mb-1.5" style={{ fontSize: 10, fontWeight: 700, color: "#4E4E72", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Password
            </p>
            <input
              type="password"
              className={inputCls}
              style={inputSty}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          {mode === "signup" && (
            <div>
              <p className="mb-1.5" style={{ fontSize: 10, fontWeight: 700, color: "#4E4E72", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Confirm password
              </p>
              <input
                type="password"
                className={inputCls}
                style={inputSty}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm rounded-xl px-3 py-2" style={{ backgroundColor: "rgba(239,68,68,.12)", color: "#F87171" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full py-3.5 rounded-2xl font-bold text-sm text-white disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          className="w-full text-sm font-semibold"
          style={{ color: "#818CF8" }}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
