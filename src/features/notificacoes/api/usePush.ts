import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Converte a chave pública VAPID (base64url) pro formato que `PushManager.subscribe` espera. */
function paraUint8Array(base64url: string): Uint8Array {
  const preenchimento = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = window.atob(base64);
  // `new Uint8Array(length)` (não `Uint8Array.from`) garante um buffer
  // ArrayBuffer "de verdade" — TS strict rejeita ArrayBufferLike
  // genérico (que inclui SharedArrayBuffer) como BufferSource.
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) {
    bytes[i] = bruto.charCodeAt(i);
  }
  return bytes;
}

export type EstadoPush = "indisponivel" | "negada" | "inativa" | "ativa";

/** Ativar/desativar push do navegador (PRD §6.14) — assina o PushManager e guarda em `push_subscriptions`. */
export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>("inativa");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function verificar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setEstado("indisponivel");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("negada");
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      setEstado(inscricao ? "ativa" : "inativa");
    }
    void verificar();
  }, []);

  async function ativar() {
    setErro(null);
    setCarregando(true);
    try {
      const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!chavePublica) {
        throw new Error("Notificações push não configuradas neste ambiente.");
      }

      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado("negada");
        return;
      }

      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast justificado: lib.dom.d.ts tipa Uint8Array como genérico
        // sobre ArrayBufferLike (inclui SharedArrayBuffer), que não bate
        // com BufferSource — é só um gap de tipagem do TS 5.7, o valor
        // em si é sempre um Uint8Array normal.
        applicationServerKey: paraUint8Array(chavePublica) as BufferSource,
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão inválida.");

      const json = inscricao.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          usuario_id: user.id,
          endpoint: inscricao.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent,
        },
        { onConflict: "usuario_id,endpoint" },
      );
      if (error) throw error;

      setEstado("ativa");
    } catch {
      setErro("Não foi possível ativar as notificações. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function desativar() {
    setErro(null);
    setCarregando(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      if (inscricao) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", inscricao.endpoint);
        await inscricao.unsubscribe();
      }
      setEstado("inativa");
    } catch {
      setErro("Não foi possível desativar as notificações. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return { estado, carregando, erro, ativar, desativar };
}
