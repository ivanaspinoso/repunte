// Prueba del Paso 1 sobre Postgres embebido (PGlite) simulando auth de Supabase.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const ok = (m) => console.log('  ✓', m);
const fallo = (m) => { console.log('  ✗', m); process.exitCode = 1; };
async function debeFallar(sql, msg) {
  try { await db.exec(sql); fallo(msg + ' (NO falló)'); }
  catch { ok(msg); }
}

// --- Simulación mínima de Supabase ---
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

import { readdirSync } from 'node:fs';
const dir = new URL('../supabase/migrations/', import.meta.url);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(f, dir), 'utf8'));
}
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
console.log('Migración aplicada');

const ANA = '11111111-1111-1111-1111-111111111111';
const BETO = '22222222-2222-2222-2222-222222222222';
const IVANA = '99999999-9999-9999-9999-999999999999';

await db.exec(`
  insert into auth.users values ('${ANA}','ana@x.com'),('${BETO}','beto@x.com'),('${IVANA}','ivana@x.com');
  insert into admins values ('${IVANA}');
  insert into clientes (id,user_id,producto_id) select 'aaaaaaaa-0000-0000-0000-000000000001','${ANA}',id from productos where slug='repunte';
  insert into clientes (id,user_id,producto_id) select 'bbbbbbbb-0000-0000-0000-000000000002','${BETO}',id from productos where slug='repunte';
  insert into eventos (cliente_id,tipo) values ('aaaaaaaa-0000-0000-0000-000000000001','signup'),('bbbbbbbb-0000-0000-0000-000000000002','signup');
  insert into suscripciones (cliente_id,proveedor,id_externo,plan,monto) values ('aaaaaaaa-0000-0000-0000-000000000001','mercadopago','pre_123','pro',15000);
`);

console.log('\nIntegridad');
await debeFallar(`insert into clientes (user_id,producto_id) select '${ANA}',id from productos where slug='repunte'`, 'cliente duplicado (mismo usuario+producto) rechazado');
await debeFallar(`insert into eventos (cliente_id,tipo) values ('aaaaaaaa-0000-0000-0000-000000000001','evento_inventado')`, 'tipo de evento fuera de la lista rechazado');
await debeFallar(`update eventos set tipo='paid'`, 'UPDATE en eventos bloqueado (append-only)');
await debeFallar(`delete from eventos`, 'DELETE en eventos bloqueado (append-only)');
await debeFallar(`insert into suscripciones (cliente_id,proveedor,id_externo,plan) values ('bbbbbbbb-0000-0000-0000-000000000002','mercadopago','pre_123','pro')`, 'id_externo de suscripción duplicado rechazado');
await db.exec(`insert into webhooks_recibidos (proveedor,id_externo,payload) values ('mercadopago','evt_1','{}')`);
await debeFallar(`insert into webhooks_recibidos (proveedor,id_externo,payload) values ('mercadopago','evt_1','{}')`, 'webhook repetido rechazado (idempotencia)');

async function como(uid, fn) {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${uid}',true);`);
  try { return await fn(); } finally { await db.exec('rollback'); }
}
const cuenta = async (t) => (await db.query(`select count(*)::int n from ${t}`)).rows[0].n;

console.log('\nRLS como Ana (usuaria común)');
await como(ANA, async () => {
  (await cuenta('clientes')) === 1 ? ok('ve solo su cliente') : fallo('ve clientes ajenos');
  (await cuenta('eventos')) === 1 ? ok('ve solo sus eventos') : fallo('ve eventos ajenos');
  (await cuenta('suscripciones')) === 1 ? ok('ve su suscripción') : fallo('suscripciones mal');
  (await cuenta('ia_runs')) === 0 ? ok('no ve ia_runs') : fallo('ve ia_runs');
  (await cuenta('webhooks_recibidos')) === 0 ? ok('no ve webhooks') : fallo('ve webhooks');
  const r = await db.query(`update clientes set etapa='activo' returning id`);
  r.rows.length === 0 ? ok('no puede auto-activarse (update sin efecto)') : fallo('se auto-activó');
  const s = await db.query(`update suscripciones set estado='activa' returning id`);
  s.rows.length === 0 ? ok('no puede tocar su suscripción') : fallo('tocó su suscripción');
});
await como(ANA, () => debeFallar(`insert into eventos (cliente_id,tipo) values ('aaaaaaaa-0000-0000-0000-000000000001','paid')`, 'no puede insertar eventos (ej. un "paid" falso)'));
await como(ANA, () => debeFallar(`insert into tickets (cliente_id,canal,asunto) values ('bbbbbbbb-0000-0000-0000-000000000002','web','x')`, 'no puede abrir ticket a nombre de otro'));
await como(ANA, () => debeFallar(`insert into tickets (cliente_id,canal,asunto,escalado) values ('aaaaaaaa-0000-0000-0000-000000000001','web','x',true)`, 'no puede auto-escalar un ticket'));
await como(ANA, async () => {
  await db.exec(`insert into tickets (cliente_id,canal,asunto) values ('aaaaaaaa-0000-0000-0000-000000000001','web','Ayuda')`);
  ok('puede abrir un ticket propio');
});

console.log('\nRLS como Ivana (admin)');
await como(IVANA, async () => {
  (await cuenta('clientes')) === 2 ? ok('ve todos los clientes') : fallo('admin no ve todo');
  (await cuenta('eventos')) === 2 ? ok('ve todos los eventos') : fallo('admin no ve eventos');
});

console.log('\nRLS anónimo');
await db.exec(`begin; set local role anon;`);
(await cuenta('clientes')) === 0 ? ok('anon no ve clientes') : fallo('anon ve clientes');
(await cuenta('productos')) === 1 ? ok('anon ve el catálogo de productos') : fallo('anon no ve productos');
await db.exec('rollback');


// ------------------------------------------------------------------
console.log('\nPaso 3 — registrar_cliente');
const CARLA = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users values ('${CARLA}','carla@x.com')`);
const eventosDe = async (uid) => (await db.query(
  `select count(*)::int n from eventos e join clientes c on c.id=e.cliente_id where c.user_id=$1 and e.tipo='signup'`, [uid])).rows[0].n;

await db.exec('begin; set local role service_role;');
const r1 = (await db.query(`select * from registrar_cliente($1,'repunte','{"proveedor":"google"}')`, [CARLA])).rows[0];
await db.exec('commit');
r1.es_nuevo === true && r1.etapa === 'prueba' ? ok('primer login: crea cliente en etapa prueba') : fallo('primer login mal: ' + JSON.stringify(r1));
(await eventosDe(CARLA)) === 1 ? ok('registra 1 evento signup') : fallo('eventos signup != 1');

await db.exec('begin; set local role service_role;');
const r2 = (await db.query(`select * from registrar_cliente($1,'repunte')`, [CARLA])).rows[0];
await db.exec('commit');
r2.es_nuevo === false && r2.cliente_id === r1.cliente_id ? ok('segundo login: devuelve el mismo cliente, es_nuevo=false') : fallo('segundo login mal');
(await eventosDe(CARLA)) === 1 ? ok('no duplica el evento signup') : fallo('duplicó signup');

await db.exec('begin; set local role service_role;');
try { await db.query(`select * from registrar_cliente($1,'no-existe')`, [CARLA]); fallo('producto inexistente aceptado'); }
catch { ok('producto inexistente rechazado'); }
await db.exec('rollback');

await como(CARLA, () => debeFallar(`select * from registrar_cliente('${CARLA}','repunte')`, 'un usuario logueado NO puede llamarla'));
await db.exec('begin; set local role anon;');
try { await db.query(`select * from registrar_cliente('${CARLA}','repunte')`); fallo('anon pudo llamarla'); } catch { ok('anon NO puede llamarla'); }
await db.exec('rollback');

console.log(process.exitCode ? '\nHAY FALLOS' : '\nTodo OK');
