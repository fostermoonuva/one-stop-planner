import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const AUTH_EMAIL_DOMAIN = "one-stop-planner.local";

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  return email.split("@")[0] ?? email;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username);
  if (u.length < 3) return "Username must be at least 3 characters";
  if (u.length > 24) return "Username must be at most 24 characters";
  if (!/^[a-z0-9_]+$/.test(u)) return "Use letters, numbers, and underscores only";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  return null;
}

export async function signUpWithUsername(username: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured. Add keys to .env");
  const nameErr = validateUsername(username);
  if (nameErr) throw new Error(nameErr);
  const passErr = validatePassword(password);
  if (passErr) throw new Error(passErr);

  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: normalizeUsername(username) },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithUsername(username: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured. Add keys to .env");
  const nameErr = validateUsername(username);
  if (nameErr) throw new Error(nameErr);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function usernameFromSession(session: Session | null): string | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata?.username;
  if (typeof meta === "string" && meta) return meta;
  if (session.user.email) return emailToUsername(session.user.email);
  return null;
}
