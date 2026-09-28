-- CORREÇÃO DE PRODUÇÃO — remove o modo de teste do admin e fecha o acesso anônimo.
--
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase, no projeto que já
-- recebeu supabase/schema.sql (e possivelmente as migrations 20260922_*).
--
-- O QUE ESTE ARQUIVO FAZ:
--   1. Revoga explicitamente o EXECUTE de `anon` e `authenticated` em todas as
--      funções `admin_test_*` (defesa em profundidade, mesmo que o passo 2 já
--      as remova).
--   2. Remove (DROP) definitivamente essas funções de teste do banco — todas
--      as assinaturas que já existiram em versões anteriores do projeto.
--   3. Reafirma, de forma idempotente, as permissões corretas das tabelas e
--      funções de produção (appointments, availability_rules,
--      blocked_periods, booking_settings, book_appointment,
--      get_available_slots, get_available_days).
--
-- O QUE ESTE ARQUIVO **NÃO** FAZ:
--   - Não apaga nem altera nenhum agendamento existente em `appointments`.
--   - Não apaga `availability_rules` nem `blocked_periods` já cadastrados.
--   - Não altera `booking_settings.admin_user_id` (o vínculo da administradora
--     com sua conta de login continua o mesmo).
--   - Não cria uma tabela `admin_users` nova: o projeto já resolve "quem é
--     admin" com `booking_settings.admin_user_id` + `is_booking_admin()`,
--     que é exatamente esse mesmo mecanismo (auth.uid() comparado a um id
--     de administrador salvo no banco). Como só existe uma profissional
--     usando o painel, não há necessidade de uma tabela separada.
--
-- Depois de rodar esta migration, `anon` deixa de conseguir:
--   - listar agendamentos (nome, telefone, e-mail, data, horário, status);
--   - alterar status de agendamentos;
--   - ler/alterar configurações da agenda, disponibilidade e bloqueios.
--
-- `anon` continua conseguindo (e precisa continuar, para o site público funcionar):
--   - consultar dias/horários disponíveis (get_available_days / get_available_slots);
--   - criar um novo agendamento (book_appointment).
--
-- Essas duas coisas seguem retornando apenas o necessário (datas/horários
-- livres, e a confirmação do próprio agendamento que a pessoa acabou de
-- criar) — nunca dados de outros clientes.

-- ============================================================
-- 1) Revogar EXECUTE das funções de teste (defesa em profundidade)
-- ============================================================

do $$
begin
  revoke all on function public.admin_test_list_appointments(date, date) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_update_appointment_status(uuid, text) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_get_settings() from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_update_settings(integer, integer, integer, integer, text) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_list_availability(text) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_delete_availability(uuid) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_list_blocks() from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_create_block(date, time, time) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_delete_block(uuid) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

-- admin_test_create_availability / admin_test_update_availability existiram com
-- duas assinaturas diferentes ao longo do projeto (time vs. text nos horários).
-- Revogamos as duas para cobrir qualquer estado em que o banco esteja.

do $$
begin
  revoke all on function public.admin_test_create_availability(smallint, text, time, time, boolean) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_create_availability(integer, text, text, text, boolean) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_update_availability(uuid, smallint, text, time, time, boolean) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

do $$
begin
  revoke all on function public.admin_test_update_availability(uuid, integer, text, text, text, boolean) from public, anon, authenticated;
exception when undefined_function then null;
end $$;

-- ============================================================
-- 2) Remover definitivamente as funções de teste
-- ============================================================

drop function if exists public.admin_test_list_appointments(date, date);
drop function if exists public.admin_test_update_appointment_status(uuid, text);
drop function if exists public.admin_test_get_settings();
drop function if exists public.admin_test_update_settings(integer, integer, integer, integer, text);
drop function if exists public.admin_test_list_availability(text);
drop function if exists public.admin_test_delete_availability(uuid);
drop function if exists public.admin_test_list_blocks();
drop function if exists public.admin_test_create_block(date, time, time);
drop function if exists public.admin_test_delete_block(uuid);

-- As duas assinaturas possíveis de create/update_availability:
drop function if exists public.admin_test_create_availability(smallint, text, time, time, boolean);
drop function if exists public.admin_test_create_availability(integer, text, text, text, boolean);
drop function if exists public.admin_test_update_availability(uuid, smallint, text, time, time, boolean);
drop function if exists public.admin_test_update_availability(uuid, integer, text, text, text, boolean);

-- ============================================================
-- 3) Reafirmar as permissões corretas de produção (idempotente)
-- ============================================================

-- Nenhum acesso direto de anon às tabelas privadas. E para `authenticated`,
-- revogamos tudo primeiro e re-concedemos apenas o mínimo necessário — assim
-- qualquer permissão excedente que tenha sido concedida durante testes
-- também é removida, não só as usadas pelo modo de teste.
revoke all on public.booking_settings from anon, authenticated;
revoke all on public.availability_rules from anon, authenticated;
revoke all on public.blocked_periods from anon, authenticated;
revoke all on public.appointments from anon, authenticated;

-- `authenticated` só pode operar nessas tabelas através das políticas RLS
-- (que exigem is_booking_admin()); o grant abaixo é necessário para que o
-- Postgres sequer avalie a política — sem RLS aprovando, o grant não basta.
grant select, update on public.booking_settings to authenticated;
grant select, insert, update, delete on public.availability_rules to authenticated;
grant select, insert, update, delete on public.blocked_periods to authenticated;
grant select, update on public.appointments to authenticated;

-- Garante que as políticas de administração continuam exigindo is_booking_admin().
drop policy if exists booking_settings_admin on public.booking_settings;
create policy booking_settings_admin
on public.booking_settings
for all
to authenticated
using (public.is_booking_admin())
with check (public.is_booking_admin());

drop policy if exists availability_rules_admin on public.availability_rules;
create policy availability_rules_admin
on public.availability_rules
for all
to authenticated
using (public.is_booking_admin())
with check (public.is_booking_admin());

drop policy if exists blocked_periods_admin on public.blocked_periods;
create policy blocked_periods_admin
on public.blocked_periods
for all
to authenticated
using (public.is_booking_admin())
with check (public.is_booking_admin());

drop policy if exists appointments_admin on public.appointments;
create policy appointments_admin
on public.appointments
for all
to authenticated
using (public.is_booking_admin())
with check (public.is_booking_admin());

-- Reafirma RLS ligado (não faz nada se já estiver).
alter table public.booking_settings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.appointments enable row level security;

-- As duas únicas funções que o site público (anon) pode continuar chamando:
-- consultar disponibilidade e criar um agendamento. Ambas já só retornam o
-- estritamente necessário (ver supabase/schema.sql).
grant execute on function public.get_available_slots(date, text) to anon, authenticated;
grant execute on function public.get_available_days(date, text) to anon, authenticated;
grant execute on function public.book_appointment(text, text, text, date, time, text) to anon, authenticated;

-- Função auxiliar que só informa (true/false) se já existe uma administradora
-- configurada — nunca retorna o UUID, e-mail ou qualquer dado sensível.
grant execute on function public.is_booking_admin_configured() to anon, authenticated;
revoke all on function public.is_booking_admin_configured() from public;

revoke all on function public.is_booking_admin() from public;
grant execute on function public.is_booking_admin() to authenticated;

notify pgrst, 'reload schema';
