import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  usuario: User | null;
  carregando: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, usuario: null, carregando: true });

/** Mantém a sessão do Supabase Auth sincronizada em contexto React. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<AuthState>({
    session: null,
    usuario: null,
    carregando: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEstado({ session, usuario: session?.user ?? null, carregando: false });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      setEstado({ session, usuario: session?.user ?? null, carregando: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}

/** Sessão do usuário logado. `carregando` é true só na checagem inicial. */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
