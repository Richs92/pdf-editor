-- Run once in a new Supabase project's SQL editor.
-- App data is accessible only through server functions, never by the browser.
begin;
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'user' check (role in ('admin','user')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.app_permissions (
  user_id uuid not null references public.app_users(id) on delete cascade,
  module text not null check (module in ('contracts','cfe','water','predial')),
  primary key(user_id,module)
);
create table if not exists public.app_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null,
  module text check (module in ('contracts','cfe','water','predial')),
  target_id uuid,
  source text not null check(source in ('server','browser')),
  details jsonb not null default '{}'::jsonb
);
create index if not exists app_audit_time on public.app_audit(occurred_at desc,id desc);
create index if not exists app_audit_actor on public.app_audit(actor_id,occurred_at desc);
alter table public.app_users enable row level security;
alter table public.app_permissions enable row level security;
alter table public.app_audit enable row level security;
revoke all on public.app_users, public.app_permissions, public.app_audit from anon, authenticated;
grant select,insert,update,delete on public.app_users, public.app_permissions to service_role;
grant select,insert on public.app_audit to service_role;
grant usage,select on sequence public.app_audit_id_seq to service_role;

create or replace function public.app_require_admin(p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.app_users where id=p_actor and role='admin' and active and not must_change_password) then
    raise exception 'Administrador requerido' using errcode='42501';
  end if;
end; $$;

create or replace function public.app_write_audit(p_actor uuid,p_action text,p_module text default null,p_target uuid default null,p_source text default 'server',p_details jsonb default '{}'::jsonb,p_email text default null) returns void
language plpgsql security definer set search_path=public as $$
declare actor_email text;
begin
  if p_actor is not null then select email into actor_email from public.app_users where id=p_actor; end if;
  insert into public.app_audit(actor_id,actor_email,action,module,target_id,source,details)
    values(p_actor,coalesce(actor_email,p_email),p_action,p_module,p_target,p_source,p_details);
end; $$;

create or replace function public.app_provision_user(p_actor uuid,p_id uuid,p_email text,p_name text,p_modules text[]) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.app_require_admin(p_actor);
  insert into public.app_users(id,email,display_name) values(p_id,p_email,p_name);
  insert into public.app_permissions(user_id,module) select p_id,unnest(p_modules);
  perform public.app_write_audit(p_actor,'user_created',null,p_id,'server',jsonb_build_object('email',p_email,'modules',p_modules));
end; $$;

create or replace function public.app_update_user(p_actor uuid,p_id uuid,p_name text,p_active boolean,p_modules text[]) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.app_require_admin(p_actor);
  if not exists(select 1 from public.app_users where id=p_id and role='user') then raise exception 'Solo se pueden administrar usuarios normales'; end if;
  update public.app_users set display_name=p_name,active=p_active where id=p_id;
  delete from public.app_permissions where user_id=p_id;
  insert into public.app_permissions(user_id,module) select p_id,unnest(p_modules);
  perform public.app_write_audit(p_actor,'user_updated',null,p_id,'server',jsonb_build_object('active',p_active,'modules',p_modules,'display_name',p_name));
end; $$;

create or replace function public.app_password_changed(p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update public.app_users set must_change_password=false where id=p_actor and active;
  if not found then raise exception 'Usuario no disponible'; end if;
  perform public.app_write_audit(p_actor,'password_changed');
end; $$;

create or replace function public.app_password_reset(p_actor uuid,p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.app_require_admin(p_actor);
  update public.app_users set must_change_password=true where id=p_id and role='user';
  if not found then raise exception 'Usuario no disponible'; end if;
  perform public.app_write_audit(p_actor,'password_reset',null,p_id);
end; $$;

-- No API role may alter historical events. Record corrections as new events.
create or replace function public.app_audit_immutable() returns trigger
language plpgsql set search_path=public as $$ begin raise exception 'El registro de actividad no se puede modificar'; end; $$;
drop trigger if exists app_audit_no_change on public.app_audit;
create trigger app_audit_no_change before update or delete on public.app_audit for each row execute function public.app_audit_immutable();

revoke all on function public.app_require_admin(uuid) from public,anon,authenticated;
revoke all on function public.app_write_audit(uuid,text,text,uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.app_provision_user(uuid,uuid,text,text,text[]) from public,anon,authenticated;
revoke all on function public.app_update_user(uuid,uuid,text,boolean,text[]) from public,anon,authenticated;
revoke all on function public.app_password_changed(uuid) from public,anon,authenticated;
revoke all on function public.app_password_reset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.app_require_admin(uuid), public.app_write_audit(uuid,text,text,uuid,text,jsonb,text), public.app_provision_user(uuid,uuid,text,text,text[]), public.app_update_user(uuid,uuid,text,boolean,text[]), public.app_password_changed(uuid), public.app_password_reset(uuid,uuid) to service_role;
commit;
