import { LogOut, X } from "lucide-react";

export function AccountMenu({
  username,
  syncStatus,
  onSignOut,
  onClose,
}: {
  username: string;
  syncStatus: "idle" | "saving" | "error";
  onSignOut: () => void;
  onClose: () => void;
}) {
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div
      className="absolute inset-0 z-50 flex items-end"
      style={{ backgroundColor: "rgba(0,0,0,.72)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-8 pt-3"
        style={{ backgroundColor: "#181824" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 mb-4">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.14)" }} />
        </div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-base">Account</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,.1)" }}
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl px-4 py-4 mb-4" style={{ backgroundColor: "rgba(255,255,255,.05)" }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}
          >
            {initials}
          </div>
          <div>
            <p className="text-white font-semibold">@{username}</p>
            <p style={{ fontSize: 11, color: syncStatus === "error" ? "#F87171" : "#4E4E72" }}>
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
          onClick={() => {
            onSignOut();
            onClose();
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm"
          style={{ backgroundColor: "rgba(239,68,68,.15)", color: "#F87171" }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}
