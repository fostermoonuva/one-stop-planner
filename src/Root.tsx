import App from "./app/App";
import { AuthScreen } from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#F4F7FA] dark:bg-[#0B0F19]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-stone-300 dark:border-stone-700 border-t-stone-900 dark:border-t-stone-100 animate-spin mx-auto mb-4" />
        <p className="text-stone-500 dark:text-stone-400 text-sm font-medium">Loading…</p>
      </div>
    </div>
  );
}

function SetupRequired() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 bg-[#F4F7FA] dark:bg-[#0B0F19]"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="max-w-md">
        <div className="rounded-2xl p-6 bg-white/70 dark:bg-stone-900/70 backdrop-blur-md border border-stone-200/60 dark:border-stone-700/60 shadow-sm shadow-stone-900/5 dark:shadow-black/20">
          <h1 className="text-stone-900 dark:text-stone-100 font-bold text-lg mb-3">Supabase not configured</h1>
          <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
            Copy <code className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-xs">.env.example</code> to <code className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-xs">.env</code>,
            add your project URL and anon key, run the SQL in <code className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-xs">supabase/schema.sql</code>,
            then restart <code className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-xs">npm run dev</code>.
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
