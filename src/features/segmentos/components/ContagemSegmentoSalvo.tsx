import { useContarSegmentoSalvo } from "@/features/segmentos/api/useSegmentos";

/** Contagem ao vivo de um segmento já salvo (lista de segmentos). */
export function ContagemSegmentoSalvo({ segmentoId }: { segmentoId: string }) {
  const { data: total, isLoading } = useContarSegmentoSalvo(segmentoId);
  if (isLoading) return <span className="text-muted-foreground">…</span>;
  return <span>{total ?? 0}</span>;
}
