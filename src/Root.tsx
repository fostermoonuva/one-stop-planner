import App from "./app/App";
import { AuthScreen } from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0B0B10", color: "#7878A4", fontFamily: "'Inter', sans-serif" }}
    >
      Loading…
    </div>
  );
}

function SetupRequired() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: "#0B0B10", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-white font-bold text-lg">Supabase not configured</h1>
        <p style={{ fontSize: 14, color: "#7878A4", lineHeight: 1.6 }}>
          Copy <code style={{ color: "#818CF8" }}>.env.example</code> to <code style={{ color: "#818CF8" }}>.env</code>,
          add your project URL and anon key, run the SQL in <code style={{ color: "#818CF8" }}>supabase/schema.sql</code>,
          then restart <code style={{ color: "#818CF8" }}>npm run dev</code>.
        </p>
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
