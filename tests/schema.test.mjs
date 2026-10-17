import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const ADMIN='00000000-0000-4000-8000-000000000001',USER='00000000-0000-4000-8000-000000000002';
test('migración PostgreSQL: RLS, administración transaccional y log inmutable',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);insert into auth.users values('${ADMIN}','admin@example.test'),('${USER}','staff@example.test');`);
  const setup=await readFile('supabase/setup.sql','utf8');await db.exec(setup);await db.exec(setup); // repeatable
  await db.exec("alter table public.app_permissions drop constraint app_permissions_module_check;alter table public.app_permissions add constraint app_permissions_module_check check(module in ('contracts','cfe','water','predial'));alter table public.app_audit drop constraint app_audit_module_check;alter table public.app_audit add constraint app_audit_module_check check(module in ('contracts','cfe','water','predial'));");
  const migration=await readFile('supabase/add-bank.sql','utf8');await db.exec(migration);await db.exec(migration);
  const bootstrap=(await readFile('supabase/bootstrap-admin.sql','utf8')).replace('REEMPLAZA_CON_TU_CORREO','admin@example.test');await db.exec(bootstrap);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.app_users'));
  await assert.rejects(db.query('select * from public.app_audit'));
  await assert.rejects(db.query(`select public.app_write_audit(null,'fake')`));
  await db.exec('reset role;set role service_role');
  await db.query('select public.app_provision_user($1,$2,$3,$4,$5)',[ADMIN,USER,'staff@example.test','Staff',['cfe']]);
  await assert.rejects(db.query('select public.app_update_user($1,$2,$3,$4,$5)',[USER,USER,'Malicious',true,['contracts']]));
  await db.query('select public.app_update_user($1,$2,$3,$4,$5)',[ADMIN,USER,'Staff renamed',true,['water','predial']]);
  let result=await db.query('select module from public.app_permissions where user_id=$1 order by module',[USER]);assert.deepEqual(result.rows.map(r=>r.module),['predial','water']);
  await assert.rejects(db.query('select public.app_update_user($1,$2,$3,$4,$5)',[ADMIN,USER,'Invalid update',true,['fake']]));
  result=await db.query('select module from public.app_permissions where user_id=$1 order by module',[USER]);assert.deepEqual(result.rows.map(r=>r.module),['predial','water']); // failed operation rolls back delete
  await db.query('select public.app_update_user($1,$2,$3,$4,$5)',[ADMIN,USER,'Bank permitted',true,['bank']]);
  await db.query("select public.app_write_audit($1,'module_opened','bank')",[ADMIN]);
  await db.query('select public.app_password_changed($1)',[USER]);
  await db.query('select public.app_password_reset($1,$2)',[ADMIN,USER]);
  result=await db.query('select must_change_password from public.app_users where id=$1',[USER]);assert.equal(result.rows[0].must_change_password,true);
  const logs=await db.query('select action,actor_email,source from public.app_audit order by id');
  assert.ok(logs.rows.some(row=>row.action==='user_created'&&row.actor_email==='admin@example.test'));
  assert.ok(logs.rows.some(row=>row.action==='password_changed'&&row.actor_email==='staff@example.test'));
  await assert.rejects(db.query('delete from public.app_audit'));
  await db.exec('reset role');await assert.rejects(db.query("update public.app_audit set action='tampered'"));
 }finally{await db.close();}
});
