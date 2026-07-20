-- Permite mirar a campanha numa cidade dentro do recorte (ex.: Arapiraca, em AL).
--
-- Sobre `alcance_a_definir`: quando a campanha é por cidade, o painel NÃO
-- estima o volume. Os números por cidade na base de origem são projetados, não
-- contados — a mesma cidade aparece com valores diferentes em recortes
-- aninhados (Goiana = 173.858 na base completa, 166.679 em PE e 277.788 no
-- cluster PE-C01, que está dentro dos dois), e a razão entre recortes é
-- idêntica para cidades distintas, sinal de escala aplicada por cima.
--
-- Em vez de exibir um número que não se sustenta, a segmentação por cidade é
-- feita pela ATONNS no momento do disparo, e o alcance fica registrado como
-- "a definir" até o relatório trazer o volume real.

alter table campanhas
  add column cidade text,
  add column alcance_a_definir boolean not null default false;

comment on column campanhas.cidade is
  'Cidade alvo dentro do recorte. NULL = recorte inteiro.';

comment on column campanhas.alcance_a_definir is
  'true quando o volume só será conhecido na segmentação/disparo (campanha por cidade).';

alter table campanhas
  add constraint cidade_nao_vazia
  check (cidade is null or length(trim(cidade)) > 0);

-- Coerência: ou o alcance é conhecido agora, ou fica para a segmentação.
alter table campanhas
  add constraint alcance_coerente
  check (
    (alcance_a_definir and alcance_contatos = 0) or
    (not alcance_a_definir)
  );
