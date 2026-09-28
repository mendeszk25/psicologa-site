-- TEST ADMIN MODE — TEMPORÁRIO, SEM AUTENTICAÇÃO.
--
-- Esta migration libera SOMENTE RPCs de configuração da agenda para anon/authenticated.
-- Ela NÃO libera SELECT/UPDATE em appointments e NÃO altera as políticas RLS existentes.
-- Enquanto estas RPCs estiverem concedidas a anon, qualquer pessoa tecnicamente capaz de
-- chamá-las poderá alterar disponibilidade/configurações. Use apenas durante testes.
-- Quando o admin real for ativado, revogue os grants anon ou remova estas funções.

create or replace function public.admin_test_get_settings()
returns table (
  duration_minutes integer,
  interval_minutes integer,
  minimum_notice_hours integer,
  booking_horizon_days integer,
  timezone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.duration_minutes,
    s.interval_minutes,
    s.minimum_notice_hours,
    s.booking_horizon_days,
    s.timezone
  from public.booking_settings s
  where s.id = 1;
$$;

create or replace function public.admin_test_update_settings(
  p_duration_minutes integer,
  p_interval_minutes integer,
  p_minimum_notice_hours integer,
  p_booking_horizon_days integer,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timezone text := nullif(btrim(coalesce(p_timezone, '')), '');
begin
  if (p_duration_minutes is not null and (p_duration_minutes < 15 or p_duration_minutes > 240))
     or (p_interval_minutes is not null and (p_interval_minutes < 0 or p_interval_minutes > 120))
     or (p_minimum_notice_hours is not null and (p_minimum_notice_hours < 0 or p_minimum_notice_hours > 720))
     or (p_booking_horizon_days is not null and (p_booking_horizon_days < 1 or p_booking_horizon_days > 365)) then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_settings';
  end if;

  if v_timezone is not null and not exists (
    select 1 from pg_timezone_names where name = v_timezone
  ) then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_settings';
  end if;

  update public.booking_settings
  set duration_minutes = p_duration_minutes,
      interval_minutes = p_interval_minutes,
      minimum_notice_hours = p_minimum_notice_hours,
      booking_horizon_days = p_booking_horizon_days,
      timezone = v_timezone
  where id = 1;
end;
$$;

create or replace function public.admin_test_list_availability(p_modality text)
returns table (
  id uuid,
  weekday smallint,
  modality text,
  start_time time,
  end_time time,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_modality not in ('presencial','online') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_modality';
  end if;

  return query
  select r.id, r.weekday, r.modality, r.start_time, r.end_time, r.is_active
  from public.availability_rules r
  where r.modality = p_modality
  order by r.weekday, r.start_time;
end;
$$;

create or replace function public.admin_test_create_availability(
  p_weekday smallint,
  p_modality text,
  p_start_time time,
  p_end_time time,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_weekday is null or p_weekday < 0 or p_weekday > 6 then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_day';
  end if;
  if p_modality not in ('presencial','online') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_modality';
  end if;
  if p_start_time is null or p_end_time is null or p_start_time >= p_end_time then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_time';
  end if;

  if coalesce(p_is_active, true) and exists (
    select 1
    from public.availability_rules r
    where r.weekday = p_weekday
      and r.modality = p_modality
      and r.is_active
      and p_start_time < r.end_time
      and p_end_time > r.start_time
  ) then
    raise exception using errcode = 'P0001', message = 'admin_test_overlap';
  end if;

  insert into public.availability_rules (weekday, modality, start_time, end_time, is_active)
  values (p_weekday, p_modality, p_start_time, p_end_time, coalesce(p_is_active, true))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'admin_test_overlap';
end;
$$;

create or replace function public.admin_test_update_availability(
  p_id uuid,
  p_weekday smallint,
  p_modality text,
  p_start_time time,
  p_end_time time,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null then
    raise exception using errcode = 'P0001', message = 'admin_test_rule_not_found';
  end if;
  if p_weekday is null or p_weekday < 0 or p_weekday > 6 then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_day';
  end if;
  if p_modality not in ('presencial','online') then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_modality';
  end if;
  if p_start_time is null or p_end_time is null or p_start_time >= p_end_time then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_time';
  end if;

  if coalesce(p_is_active, false) and exists (
    select 1
    from public.availability_rules r
    where r.id <> p_id
      and r.weekday = p_weekday
      and r.modality = p_modality
      and r.is_active
      and p_start_time < r.end_time
      and p_end_time > r.start_time
  ) then
    raise exception using errcode = 'P0001', message = 'admin_test_overlap';
  end if;

  update public.availability_rules
  set weekday = p_weekday,
      modality = p_modality,
      start_time = p_start_time,
      end_time = p_end_time,
      is_active = coalesce(p_is_active, false)
  where id = p_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'admin_test_rule_not_found';
  end if;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'admin_test_overlap';
end;
$$;

create or replace function public.admin_test_delete_availability(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.availability_rules where id = p_id;
end;
$$;

create or replace function public.admin_test_list_blocks()
returns table (
  id uuid,
  blocked_date date,
  start_time time,
  end_time time
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.blocked_date, b.start_time, b.end_time
  from public.blocked_periods b
  where b.blocked_date >= current_date
  order by b.blocked_date, b.start_time nulls first;
$$;

create or replace function public.admin_test_create_block(
  p_blocked_date date,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_blocked_date is null then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_date';
  end if;

  if (p_start_time is null) <> (p_end_time is null) then
    raise exception using errcode = 'P0001', message = 'admin_test_partial_block';
  end if;
  if p_start_time is not null and p_start_time >= p_end_time then
    raise exception using errcode = 'P0001', message = 'admin_test_invalid_time';
  end if;

  insert into public.blocked_periods (blocked_date, start_time, end_time)
  values (p_blocked_date, p_start_time, p_end_time)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_test_delete_block(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocked_periods where id = p_id;
end;
$$;

revoke all on function public.admin_test_get_settings() from public;
revoke all on function public.admin_test_update_settings(integer, integer, integer, integer, text) from public;
revoke all on function public.admin_test_list_availability(text) from public;
revoke all on function public.admin_test_create_availability(smallint, text, time, time, boolean) from public;
revoke all on function public.admin_test_update_availability(uuid, smallint, text, time, time, boolean) from public;
revoke all on function public.admin_test_delete_availability(uuid) from public;
revoke all on function public.admin_test_list_blocks() from public;
revoke all on function public.admin_test_create_block(date, time, time) from public;
revoke all on function public.admin_test_delete_block(uuid) from public;

grant execute on function public.admin_test_get_settings() to anon, authenticated;
grant execute on function public.admin_test_update_settings(integer, integer, integer, integer, text) to anon, authenticated;
grant execute on function public.admin_test_list_availability(text) to anon, authenticated;
grant execute on function public.admin_test_create_availability(smallint, text, time, time, boolean) to anon, authenticated;
grant execute on function public.admin_test_update_availability(uuid, smallint, text, time, time, boolean) to anon, authenticated;
grant execute on function public.admin_test_delete_availability(uuid) to anon, authenticated;
grant execute on function public.admin_test_list_blocks() to anon, authenticated;
grant execute on function public.admin_test_create_block(date, time, time) to anon, authenticated;
grant execute on function public.admin_test_delete_block(uuid) to anon, authenticated;
