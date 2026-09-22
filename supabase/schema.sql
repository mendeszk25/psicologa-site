-- Silvana Delacio — agendamento
-- Rode este arquivo no SQL Editor do Supabase em um projeto novo ou já existente.
-- Não há dados clínicos neste esquema: apenas disponibilidade e dados mínimos de contato.

create extension if not exists pgcrypto;

create table if not exists public.booking_settings (
  id integer primary key default 1 check (id = 1),
  admin_user_id uuid null references auth.users(id) on delete set null,
  duration_minutes integer null check (duration_minutes between 15 and 240),
  interval_minutes integer null check (interval_minutes between 0 and 120),
  minimum_notice_hours integer null check (minimum_notice_hours between 0 and 720),
  booking_horizon_days integer null check (booking_horizon_days between 1 and 365),
  timezone text null,
  updated_at timestamptz not null default now()
);

insert into public.booking_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),
  modality text not null check (modality in ('presencial','online','ambos')),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_time_order check (start_time < end_time),
  constraint availability_unique_rule unique (weekday, modality, start_time, end_time)
);

create table if not exists public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null,
  start_time time null,
  end_time time null,
  created_at timestamptz not null default now(),
  constraint blocked_period_pair check (
    (start_time is null and end_time is null)
    or
    (start_time is not null and end_time is not null and start_time < end_time)
  )
);

create index if not exists blocked_periods_date_idx
  on public.blocked_periods (blocked_date);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(btrim(client_name)) between 2 and 120),
  client_phone text not null check (client_phone ~ '^[1-9][0-9]{9,14}$'),
  client_email text null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  modality text not null check (modality in ('presencial','online')),
  status text not null default 'pending' check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_time_order check (start_time < end_time)
);

create index if not exists appointments_date_idx
  on public.appointments (appointment_date, start_time);

-- Evita duas reservas começando exatamente no mesmo horário enquanto estiverem ativas.
-- A função de reserva abaixo também valida sobreposição de intervalos.
create unique index if not exists appointments_unique_active_start
  on public.appointments (appointment_date, start_time)
  where status in ('pending','confirmed');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists booking_settings_updated_at on public.booking_settings;
create trigger booking_settings_updated_at
before update on public.booking_settings
for each row execute function public.set_updated_at();

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create or replace function public.is_booking_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and auth.uid() = (select admin_user_id from public.booking_settings where id = 1);
$$;

revoke all on function public.is_booking_admin() from public;
grant execute on function public.is_booking_admin() to authenticated;

alter table public.booking_settings enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.appointments enable row level security;

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

revoke all on public.booking_settings from anon, authenticated;
revoke all on public.availability_rules from anon, authenticated;
revoke all on public.blocked_periods from anon, authenticated;
revoke all on public.appointments from anon, authenticated;

grant select, update on public.booking_settings to authenticated;
grant select, insert, update, delete on public.availability_rules to authenticated;
grant select, insert, update, delete on public.blocked_periods to authenticated;
grant select, update on public.appointments to authenticated;

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
        and c.start_t < a.end_time
        and c.end_t > a.start_time
    )
  order by c.start_t;
end;
$$;

revoke all on function public.get_available_slots(date, text) from public;
grant execute on function public.get_available_slots(date, text) to anon, authenticated;

create or replace function public.get_available_days(
  p_month_start date,
  p_modality text
)
returns table (available_date date)
language sql
stable
security definer
set search_path = public
as $$
  with month_days as (
    select d::date as day
    from generate_series(
      date_trunc('month', p_month_start)::date,
      (date_trunc('month', p_month_start) + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d
  )
  select day
  from month_days
  where exists (
    select 1 from public.get_available_slots(day, p_modality) s limit 1
  )
  order by day;
$$;

revoke all on function public.get_available_days(date, text) from public;
grant execute on function public.get_available_days(date, text) to anon, authenticated;

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

