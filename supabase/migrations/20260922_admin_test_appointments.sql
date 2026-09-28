-- TEST ADMIN MODE — CONSULTAS NO PAINEL SEM LOGIN (TEMPORÁRIO)
--
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase enquanto adminTestMode=true.
-- Mantém RLS e NÃO concede SELECT/UPDATE direto em public.appointments.
-- As funções abaixo expõem apenas os campos necessários para a agenda e somente
-- consultas de hoje até no máximo 120 dias no futuro.
--
-- IMPORTANTE: por não haver autenticação no modo de teste, qualquer pessoa que consiga
-- chamar estas RPCs com a chave pública poderá acessar os dados retornados. Use somente
-- durante testes. Quando o admin real for ativado, revogue o acesso de anon a estas funções.

create or replace function public.admin_test_list_appointments(
  p_start_date date,
  p_end_date date
)
returns table (
  id uuid,
  client_name text,
  client_phone text,
  client_email text,
  appointment_date date,
  start_time time,
  modality text,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_start_date is null or p_end_date is null
     or p_start_date > p_end_date
     or p_start_date < current_date
     or p_end_date > current_date + 120 then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_date_range';
  end if;

  return query
  select
    a.id,
    a.client_name,
    a.client_phone,
    a.client_email,
    a.appointment_date,
    a.start_time,
    a.modality,
    a.status
  from public.appointments a
  where a.appointment_date between p_start_date and p_end_date
  order by a.appointment_date, a.start_time;
end;
$$;

create or replace function public.admin_test_update_appointment_status(
  p_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
begin
  if p_id is null or p_status not in ('confirmed', 'completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_status';
  end if;

  select a.status
    into v_current_status
  from public.appointments a
  where a.id = p_id
  for update;

  if v_current_status is null then
    raise exception using errcode = 'P0001', message = 'admin_test_appointment_not_found';
  end if;

  if v_current_status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_transition';
  end if;

  if v_current_status = 'pending' and p_status not in ('confirmed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_transition';
  end if;

  if v_current_status = 'confirmed' and p_status not in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_transition';
  end if;

  update public.appointments
  set status = p_status
  where id = p_id;
end;
$$;

revoke all on function public.admin_test_list_appointments(date, date) from public;
revoke all on function public.admin_test_update_appointment_status(uuid, text) from public;

grant execute on function public.admin_test_list_appointments(date, date) to anon, authenticated;
grant execute on function public.admin_test_update_appointment_status(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
