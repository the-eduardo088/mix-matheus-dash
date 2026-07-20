-- Fundação do painel: usuários, sessões, arquivos, campanhas e relatórios.
--
-- Papéis:
--   · cliente — gente do Mix Mateus. Cria campanha e vê as próprias.
--   · admin   — ATONNS. Vê todas, aprova/recusa e anexa o relatório.

-- ── Usuários ────────────────────────────────────────────────────────────────
-- E-mail guardado sempre em minúsculas (normalizado na aplicação), o que
-- dispensa a extensão citext e mantém a unicidade real.
create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null unique,
  senha_hash  text        not null,
  nome        text        not null,
  papel       text        not null check (papel in ('admin', 'cliente')),
  ativo       boolean     not null default true,
  criado_em   timestamptz not null default now(),
  constraint email_minusculo check (email = lower(email))
);

-- ── Sessões ─────────────────────────────────────────────────────────────────
-- Guarda o HASH do token, nunca o token em si: se o banco vazar, os cookies
-- em circulação continuam inúteis para quem leu o dump.
create table sessoes (
  token_hash text        primary key,
  usuario_id uuid        not null references usuarios (id) on delete cascade,
  expira_em  timestamptz not null,
  criado_em  timestamptz not null default now()
);

create index sessoes_usuario_idx on sessoes (usuario_id);
create index sessoes_expira_idx on sessoes (expira_em);

-- ── Arquivos ────────────────────────────────────────────────────────────────
-- O binário fica no disco (UPLOADS_DIR); aqui mora só o metadado e o caminho
-- relativo. Serve tanto para o anexo da campanha quanto para o do relatório.
create table arquivos (
  id            uuid primary key default gen_random_uuid(),
  nome_original text        not null,
  mime          text        not null,
  tamanho       bigint      not null check (tamanho > 0),
  kind          text        not null check (kind in ('imagem', 'video', 'audio', 'documento')),
  caminho       text        not null unique,
  criado_por    uuid        references usuarios (id) on delete set null,
  criado_em     timestamptz not null default now()
);

-- ── Campanhas ───────────────────────────────────────────────────────────────
create table campanhas (
  id               uuid primary key default gen_random_uuid(),
  nome             text        not null check (length(trim(nome)) > 0),
  -- Recorte da base (geral | PE | PE-C01 …) e seu alcance CONGELADO na criação:
  -- a base é reextraída periodicamente, e o relatório precisa ser comparado
  -- com o alcance que valia no dia do disparo.
  scope_id         text        not null,
  scope_rotulo     text        not null,
  alcance_contatos integer     not null default 0 check (alcance_contatos >= 0),
  alcance_pessoas  integer     not null default 0 check (alcance_pessoas >= 0),
  copy             text        not null check (length(trim(copy)) between 1 and 1024),
  midia_id         uuid        references arquivos (id) on delete set null,
  agendada_para    timestamptz not null,
  status           text        not null default 'aguardando_aprovacao'
                     check (status in ('rascunho', 'aguardando_aprovacao', 'aprovada', 'recusada', 'cancelada')),
  motivo_recusa    text,
  criada_por       uuid        not null references usuarios (id) on delete restrict,
  revisada_por     uuid        references usuarios (id) on delete set null,
  revisada_em      timestamptz,
  criada_em        timestamptz not null default now(),
  atualizada_em    timestamptz not null default now(),

  -- A regra das 24 h também no banco, não só no formulário: qualquer caminho
  -- que crie campanha (script, importação, API futura) esbarra nela.
  constraint antecedencia_minima check (agendada_para >= criada_em + interval '24 hours'),
  -- Recusa exige justificativa — senão o cliente não sabe o que corrigir.
  constraint recusa_justificada check (status <> 'recusada' or length(trim(coalesce(motivo_recusa, ''))) > 0)
);

create index campanhas_status_idx on campanhas (status);
create index campanhas_criada_por_idx on campanhas (criada_por);
create index campanhas_agendada_idx on campanhas (agendada_para desc);

-- ── Relatórios ──────────────────────────────────────────────────────────────
-- Preenchidos pelo admin depois do disparo. Todas as métricas são opcionais:
-- vale anexar só o PDF da plataforma, só os números, ou os dois.
create table relatorios (
  id            uuid primary key default gen_random_uuid(),
  campanha_id   uuid        not null unique references campanhas (id) on delete cascade,
  entregues     integer     check (entregues >= 0),
  lidas         integer     check (lidas >= 0),
  respostas     integer     check (respostas >= 0),
  falhas        integer     check (falhas >= 0),
  observacoes   text,
  anexo_id      uuid        references arquivos (id) on delete set null,
  criado_por    uuid        not null references usuarios (id) on delete restrict,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ── Carimbo automático de atualização ───────────────────────────────────────
-- Duas funções em vez de uma genérica: as colunas têm gênero diferente
-- (campanha atualizadA, relatório atualizadO) e plpgsql não atribui campo por
-- nome dinâmico sem gambiarra.
create or replace function campanhas_toca() returns trigger as $$
begin
  new.atualizada_em := now();
  return new;
end;
$$ language plpgsql;

create or replace function relatorios_toca() returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

create trigger campanhas_toca_atualizacao
  before update on campanhas
  for each row execute function campanhas_toca();

create trigger relatorios_toca_atualizacao
  before update on relatorios
  for each row execute function relatorios_toca();
