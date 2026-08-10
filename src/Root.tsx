import App from "./app/App";
import { AuthScreen } from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#FAF8F5] dark:bg-[#0E1412] text-[#1C2421] dark:text-[#F0F4F2]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#D1D8D5] dark:border-[#1E2A25] border-t-[#2D5A27] dark:border-t-[#4ADE80] animate-spin mx-auto mb-4" />
        <p className="text-[#52605B] dark:text-[#6E8C7D] text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}

function SetupRequired() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 bg-[#FAF8F5] dark:bg-[#0E1412] text-[#1C2421] dark:text-[#F0F4F2]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="max-w-md">
        <div className="rounded-2xl p-6 bg-white/88 dark:bg-[#17211D]/75 backdrop-blur-md border border-[rgba(28,36,33,0.08)] dark:border-[rgba(74,222,128,0.15)] shadow-sm shadow-[#1C2421]/5 dark:shadow-black/20">
          <h1 className="text-[#1C2421] dark:text-[#F0F4F2] font-bold text-lg mb-3">Supabase not configured</h1>
          <p className="text-[#52605B] dark:text-[#6E8C7D] text-sm leading-relaxed">
            Copy <code className="px-1.5 py-0.5 rounded bg-[#F1F4F1] dark:bg-[#1E2A25] text-[#1C2421] dark:text-[#F0F4F2] font-mono text-xs">.env.example</code> to <code className="px-1.5 py-0.5 rounded bg-[#F1F4F1] dark:bg-[#1E2A25] text-[#1C2421] dark:text-[#F0F4F2] font-mono text-xs">.env</code>,
            add your project URL and anon key, run the SQL in <code className="px-1.5 py-0.5 rounded bg-[#F1F4F1] dark:bg-[#1E2A25] text-[#1C2421] dark:text-[#F0F4F2] font-mono text-xs">supabase/schema.sql</code>,
            then restart <code className="px-1.5 py-0.5 rounded bg-[#F1F4F1] dark:bg-[#1E2A25] text-[#1C2421] dark:text-[#F0F4F2] font-mono text-xs">npm run dev</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Root() {
  const { configured, session, userId, username, loading, signIn, signUp, signOut } = useAuth();

  if (!configured) return <SetupRequired />;
  if (loading) return <LoadingScreen />;
  if (!session || !userId || !username) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  return <App userId={userId} username={username} onSignOut={signOut} />;
}
