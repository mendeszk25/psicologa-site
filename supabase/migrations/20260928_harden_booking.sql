-- Endurecimento do agendamento público (rode UMA VEZ no SQL Editor do Supabase).
-- 1) get_available_slots passa a respeitar a pausa entre atendimentos também
--    contra consultas já marcadas (antes só respeitava o horário exato).
-- 2) book_appointment limita a 3 agendamentos ativos e futuros por telefone,
--    evitando que alguém ocupe a agenda toda.
-- Não apaga nem altera dados existentes.

create or replace function public.get_available_slots(
  p_date date,
  p_modality text
)
returns table (slot_time time)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_duration integer;
  v_interval integer;
  v_notice integer;
  v_horizon integer;
  v_timezone text;
begin
  if p_modality not in ('presencial','online') then
    return;
  end if;

  select duration_minutes, interval_minutes, minimum_notice_hours, booking_horizon_days, timezone
    into v_duration, v_interval, v_notice, v_horizon, v_timezone
  from public.booking_settings
  where id = 1;

  -- A agenda pública só funciona depois que o admin definir todas as configurações essenciais.
  if v_duration is null or v_interval is null or v_notice is null or v_horizon is null or nullif(btrim(v_timezone), '') is null then
    return;
  end if;

  if p_date < (now() at time zone v_timezone)::date
     or p_date > ((now() at time zone v_timezone)::date + v_horizon) then
    return;
  end if;

  return query
  with candidate_slots as (
    select
      gs::time as start_t,
      (gs + make_interval(mins => v_duration))::time as end_t
    from public.availability_rules r
    cross join lateral generate_series(
      timestamp '2000-01-01' + r.start_time,
      timestamp '2000-01-01' + r.end_time - make_interval(mins => v_duration),
      make_interval(mins => v_duration + v_interval)
    ) gs
    where r.is_active
      and r.weekday = extract(dow from p_date)::smallint
      and r.modality in (p_modality, 'ambos')
  )
  select distinct c.start_t
  from candidate_slots c
  where ((p_date + c.start_t) at time zone v_timezone) >= (now() + make_interval(hours => v_notice))
    and not exists (
      select 1
      from public.blocked_periods b
      where b.blocked_date = p_date
        and (
          b.start_time is null
          or (c.start_t < b.end_time and c.end_t > b.start_time)
        )
    )
    and not exists (
      select 1
      from public.appointments a
      where a.appointment_date = p_date
        and a.status in ('pending','confirmed')
        and c.start_t < a.end_time + make_interval(mins => v_interval)
        and c.end_t + make_interval(mins => v_interval) > a.start_time
    )
  order by c.start_t;
end;
$$;

revoke all on function public.get_available_slots(date, text) from public;
grant execute on function public.get_available_slots(date, text) to anon, authenticated;

create or replace function public.book_appointment(
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_date date,
  p_start_time time,
  p_modality text
)
returns table (
  appointment_id uuid,
  appointment_date date,
  appointment_time time,
  appointment_modality text,
  appointment_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration integer;
  v_phone text;
  v_name text;
  v_email text;
  v_id uuid;
begin
  v_name := btrim(coalesce(p_client_name, ''));
  v_phone := regexp_replace(coalesce(p_client_phone, ''), '[^0-9]', '', 'g');
  v_email := nullif(btrim(coalesce(p_client_email, '')), '');

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_name';
  end if;
  if v_phone !~ '^[1-9][0-9]{9,14}$' then
    raise exception using errcode = 'P0001', message = 'invalid_phone';
  end if;
  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = 'P0001', message = 'invalid_email';
  end if;
  if p_modality not in ('presencial','online') then
    raise exception using errcode = 'P0001', message = 'invalid_modality';
  end if;

  select duration_minutes into v_duration
  from public.booking_settings where id = 1;
  if v_duration is null then
    raise exception using errcode = 'P0001', message = 'booking_not_configured';
  end if;

  -- Evita que uma mesma pessoa (ou robô) reserve vários horários e esvazie a agenda.
  if (
    select count(*) from public.appointments a
    where a.client_phone = v_phone
      and a.status in ('pending','confirmed')
      and a.appointment_date >= current_date
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'too_many_bookings';
  end if;

  -- Serializa tentativas concorrentes para o mesmo início de horário.
  -- Serializa reservas do mesmo dia para também impedir sobreposição concorrente entre horários diferentes.
  perform pg_advisory_xact_lock(hashtext(p_date::text));

  if not exists (
    select 1
    from public.get_available_slots(p_date, p_modality) s
    where s.slot_time = p_start_time
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  insert into public.appointments (
    client_name, client_phone, client_email,
    appointment_date, start_time, end_time, modality, status
  ) values (
    v_name, v_phone, v_email,
    p_date, p_start_time, (p_start_time + make_interval(mins => v_duration))::time,
    p_modality, 'pending'
  )
  returning id into v_id;

  return query
  select v_id, p_date, p_start_time, p_modality, 'pending'::text;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
end;
$$;

revoke all on function public.book_appointment(text, text, text, date, time, text) from public;
grant execute on function public.book_appointment(text, text, text, date, time, text) to anon, authenticated;

notify pgrst, 'reload schema';
