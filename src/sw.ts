/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
self.addEventListener("activate", () => {
  void self.clients.claim();
});

interface PayloadNotificacao {
  titulo: string;
  corpo: string;
  url: string;
}

/** Exibe a notificação do SO quando chega um push (PRD §6.14). */
self.addEventListener("push", (evento) => {
  if (!evento.data) return;

  let dados: PayloadNotificacao;
  try {
    dados = evento.data.json() as PayloadNotificacao;
  } catch {
    return;
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/favicon.svg",
      data: { url: dados.url },
    }),
  );
});

/** Clicar na notificação foca uma aba existente ou abre uma nova, na URL certa. */
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = (evento.notification.data as { url?: string } | undefined)?.url ?? "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ("focus" in cliente) {
          void (cliente as WindowClient).navigate(url);
          return cliente.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
