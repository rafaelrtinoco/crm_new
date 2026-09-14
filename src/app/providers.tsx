import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/features/auth/api/useAuth";
import { useEmpresaAtual } from "@/features/onboarding/api/useEmpresas";
import { VocabularioContext, mesclarVocabulario, vocabularioPadrao } from "@/lib/vocabulario";

/** Resolve o vocabulário da empresa selecionada; cai pro padrão genérico sem empresa. */
function VocabularioProvider({ children }: { children: ReactNode }) {
  const { atual } = useEmpresaAtual();
  const vocabulario = atual ? mesclarVocabulario(atual.vocabulario) : vocabularioPadrao;
  return <VocabularioContext.Provider value={vocabulario}>{children}</VocabularioContext.Provider>;
}

/** Providers globais da aplicação. */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <VocabularioProvider>{children}</VocabularioProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
