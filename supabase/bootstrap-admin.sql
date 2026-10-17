-- First create your own user in Supabase: Authentication > Users > Add user.
-- Use a strong password, mark email confirmed, then replace the email below.
-- Run once in SQL Editor. No password is entered in SQL or in this repository.
do $$
declare
  admin_email text := 'REEMPLAZA_CON_TU_CORREO';
  admin_id uuid;
begin
  select id into admin_id from auth.users where lower(email)=lower(admin_email);
  if admin_id is null then raise exception 'Primero crea el usuario en Authentication y escribe su correo en este script'; end if;
  insert into public.app_users(id,email,display_name,role,active,must_change_password)
    values(admin_id,lower(admin_email),'Administrador','admin',true,false)
    on conflict(id) do update set role='admin',active=true,must_change_password=false;
  perform public.app_write_audit(admin_id,'admin_initialized');
end $$;
