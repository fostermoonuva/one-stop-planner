import { LogOut, X, Moon } from "lucide-react";

export function AccountMenu({
  username,
  syncStatus,
  onSignOut,
  onClose,
  darkMode,
  onToggleDarkMode,
}: {
  username: string;
  syncStatus: "idle" | "saving" | "error";
  onSignOut: () => void;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,.5)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-8 pt-3 glass-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 mb-4">
          <div className="w-10 h-1 rounded-full dark:bg-white/10 bg-black/15" />
        </div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="dark:text-stone-100 text-stone-900 font-bold text-base">Account</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center dark:bg-white/10 bg-black/8"
          >
            <X size={14} className="dark:text-stone-400 text-stone-700" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl px-4 py-4 mb-4 glass-card">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
          >
            {initials}
          </div>
          <div>
            <p className="dark:text-stone-100 text-stone-900 font-semibold">@{username}</p>
            <p style={{ fontSize: 11, color: syncStatus === "error" ? "#EF4444" : darkMode ? "#78716C" : "#78716C" }}>
              {syncStatus === "saving"
                ? "Saving…"
                : syncStatus === "error"
                  ? "Could not sync — will retry"
                  : "Synced to your account"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-2 dark:bg-indigo-500/20 bg-indigo-500/15 dark:text-indigo-400 text-indigo-600"
        >
          <Moon size={16} />
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>

        <button
          type="button"
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm dark:bg-red-500/20 bg-red-500/15 dark:text-red-400 text-red-600"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
