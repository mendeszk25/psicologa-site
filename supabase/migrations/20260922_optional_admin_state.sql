-- Migração pequena para projetos que já executaram supabase/schema.sql.
-- Permite que /admin descubra apenas se existe um administrador configurado,
-- sem expor UUID, e-mail, senha ou qualquer dado privado.

create or replace function public.is_booking_admin_configured()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.booking_settings
    where id = 1 and admin_user_id is not null
  );
$$;

revoke all on function public.is_booking_admin_configured() from public;
grant execute on function public.is_booking_admin_configured() to anon, authenticated;
