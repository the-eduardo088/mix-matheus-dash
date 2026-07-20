-- As 24 h de antecedência deixam de BLOQUEAR e passam a AVISAR.
--
-- A regra original (001_init.sql) recusava no banco qualquer campanha agendada
-- para menos de 24 h. Na prática isso impedia casos legítimos — encarte de
-- última hora, correção de campanha já aprovada, disparo combinado por fora.
--
-- A janela continua existindo como recomendação (aprovação de template pela
-- Meta e aquecimento de números levam tempo), mas quem decide é o admin no
-- momento da aprovação, não uma constraint. O painel sinaliza a campanha
-- agendada com pouca antecedência para que ele revise sabendo disso.
--
-- Não há coluna nova: a condição é derivada de agendada_para vs criada_em.

alter table campanhas drop constraint if exists antecedencia_minima;
