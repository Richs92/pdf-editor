-- Run in the SQL Editor of the Supabase project connected to Netlify.
-- Keeps all users, permissions, and activity records.
begin;
alter table public.app_permissions drop constraint if exists app_permissions_module_check;
alter table public.app_permissions add constraint app_permissions_module_check check (module in ('contracts','cfe','water','predial','bank'));
alter table public.app_audit drop constraint if exists app_audit_module_check;
alter table public.app_audit add constraint app_audit_module_check check (module in ('contracts','cfe','water','predial','bank'));
commit;
