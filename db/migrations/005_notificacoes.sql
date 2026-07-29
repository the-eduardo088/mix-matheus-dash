-- Notificações para o admin quando um PDF é editado.
--
-- Mantém um histórico simples: quem editou, quando, e qual campanha.

create table notificacoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid        not null references usuarios (id) on delete cascade,
  campanha_id   uuid        references campanhas (id) on delete set null,
  tipo          text        not null check (tipo in ('pdf_editado')),
  mensagem      text        not null,
  lida          boolean     not null default false,
  criado_em     timestamptz not null default now()
);

create index notificacoes_usuario_idx on notificacoes (usuario_id, lida, criado_em desc);
