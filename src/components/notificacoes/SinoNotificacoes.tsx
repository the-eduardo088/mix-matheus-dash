/**
 * Sino de notificações — ícone no cabeçalho com contador e dropdown.
 *
 * Mostra notificações não lidas para o admin. Clique marca como lida.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  contarNotificacoesNaoLidas,
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  formatarDataHora,
  type Notificacao,
} from "@/lib/campanhas";

export function SinoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const queryClient = useQueryClient();

  const { data: naoLidas = 0 } = useQuery({
    queryKey: ["notificacoes", "naoLidas"],
    queryFn: () => contarNotificacoesNaoLidas(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: notificacoes = [] } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => listarNotificacoes(),
    enabled: aberto,
    staleTime: 10_000,
  });

  const marcarLidaMutation = useMutation({
    mutationFn: (id: string) => marcarNotificacaoLida({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  const marcarTodasMutation = useMutation({
    mutationFn: () => marcarTodasNotificacoesLidas(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    },
  });

  function toggle() {
    setAberto((v) => !v);
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition hover:text-foreground"
        aria-label={`Notificações${naoLidas > 0 ? ` (${naoLidas} não lidas)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--warning)] px-1 text-[10px] font-bold text-white">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 max-h-96 overflow-hidden rounded-xl border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-display text-sm font-semibold">Notificações</h3>
              {naoLidas > 0 && (
                <button
                  onClick={() => marcarTodasMutation.mutate()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-72">
              {notificacoes.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notificação
                </p>
              ) : (
                notificacoes.map((n) => (
                  <NotificacaoItem
                    key={n.id}
                    notificacao={n}
                    onMarcarLida={() => marcarLidaMutation.mutate(n.id)}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificacaoItem({
  notificacao: n,
  onMarcarLida,
}: {
  notificacao: Notificacao;
  onMarcarLida: () => void;
}) {
  const isPdfEditado = n.tipo === "pdf_editado";

  return (
    <div
      className={`flex items-start gap-3 border-b px-4 py-3 transition hover:bg-muted/50 ${
        !n.lida ? "bg-primary/5" : ""
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <div
          className={`grid h-8 w-8 place-items-center rounded-full ${
            isPdfEditado
              ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Bell className="h-4 w-4" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">{n.mensagem}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatarDataHora(n.criadoEm)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {n.campanhaId && (
          <Link
            to="/campanha/$id"
            params={{ id: n.campanhaId }}
            onClick={onMarcarLida}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Ver campanha"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        {!n.lida && (
          <button
            onClick={onMarcarLida}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Marcar como lida"
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
