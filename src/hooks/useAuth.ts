import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  signInWithUsername,
  signOut as authSignOut,
  signUpWithUsername,
  usernameFromSession,
} from "../lib/auth";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    const { session: newSession } = await signUpWithUsername(username, password);
    if (newSession) {
      setSession(newSession);
      return;
    }
    // When email confirmation is off, sign in immediately after sign up
    const { session: signedIn } = await signInWithUsername(username, password);
    setSession(signedIn);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { session: newSession } = await signInWithUsername(username, password);
    setSession(newSession);
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
  }, []);

  const username = usernameFromSession(session);

  return {
    configured: isSupabaseConfigured,
    session,
    userId: session?.user?.id ?? null,
    username,
    loading,
    signUp,
    signIn,
    signOut,
  };
}
