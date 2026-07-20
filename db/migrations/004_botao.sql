-- Botão de call-to-action que vai no disparo do WhatsApp.
--
-- Uma mensagem pode levar um botão de link (ex.: "Ver ofertas" → https://…).
-- São dois campos que andam juntos: o rótulo do botão e a URL de destino.

alter table campanhas
  add column botao_texto text,
  add column botao_url text;

comment on column campanhas.botao_texto is 'Rótulo do botão de link no WhatsApp. NULL = sem botão.';
comment on column campanhas.botao_url is 'URL de destino do botão. NULL = sem botão.';

-- Os dois juntos ou nenhum: botão sem URL não clica, URL sem rótulo não aparece.
alter table campanhas
  add constraint botao_completo
  check (
    (botao_texto is null and botao_url is null) or
    (length(trim(botao_texto)) > 0 and botao_url ~* '^https?://')
  );
