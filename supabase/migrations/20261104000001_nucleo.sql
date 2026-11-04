-- =====================================================================
-- Núcleo de automatización multi-producto — Paso 1
-- Tablas, enums, índices, RLS y garantías (append-only, idempotencia)
-- =====================================================================


-- ---------- Enums ----------
create type etapa_cliente as enum ('lead','prueba','activo','en_riesgo','cancelado');
create type proveedor_pago as enum ('mercadopago'); -- sumar otro: alter type proveedor_pago add value 'stripe';
create type estado_suscripcion as enum ('pendiente','activa','pago_fallido','solo_lectura','suspendida','cancelada');
create type tipo_evento as enum ('signup','activated','paid','payment_failed','limit_reached','churned');
create type estado_ticket as enum ('abierto','en_curso','resuelto');
create type prioridad_ticket as enum ('baja','media','alta','urgente');

-- ---------- Admins (reemplaza el email hardcodeado) ----------
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------- Productos ----------
create table productos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nombre text not null,
  created_at timestamptz not null default now()
);

-- ---------- Clientes ----------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  producto_id uuid not null references productos(id) on delete restrict,
  etapa etapa_cliente not null default 'prueba',
  activado_at timestamptz,
  health_score smallint check (health_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, producto_id)               -- un cliente por usuario y producto
);
create index clientes_producto_etapa_idx on clientes (producto_id, etapa);

-- ---------- Suscripciones ----------
create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  proveedor proveedor_pago not null,
  id_externo text,                             -- preapproval_id de MP
  estado estado_suscripcion not null default 'pendiente',
  plan text not null,
  monto numeric(12,2),                         -- necesario para MRR
  moneda char(3) not null default 'ARS',
  periodo_fin timestamptz,
  reintentos smallint not null default 0 check (reintentos >= 0),
  fallo_desde timestamptz,                     -- día 0 del ciclo de cobranza
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proveedor, id_externo)
);
create index suscripciones_cliente_idx on suscripciones (cliente_id);
create index suscripciones_estado_idx on suscripciones (estado) where estado in ('pago_fallido','solo_lectura');

-- ---------- Eventos (append-only) ----------
create table eventos (
  id bigint generated always as identity primary key,
  cliente_id uuid not null references clientes(id) on delete restrict,
  tipo tipo_evento not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index eventos_cliente_created_idx on eventos (cliente_id, created_at desc);
create index eventos_tipo_created_idx on eventos (tipo, created_at desc);

create or replace function bloquear_modificacion() returns trigger
language plpgsql as $$
begin
  raise exception 'La tabla % es append-only', tg_table_name;
end $$;

create trigger eventos_append_only
  before update or delete on eventos
  for each row execute function bloquear_modificacion();
create trigger eventos_no_truncate
  before truncate on eventos
  for each statement execute function bloquear_modificacion();

-- ---------- Idempotencia de webhooks ----------
create table webhooks_recibidos (
  id bigint generated always as identity primary key,
  proveedor proveedor_pago not null,
  id_externo text not null,                    -- x-request-id / data.id de MP
  payload jsonb not null,
  procesado_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (proveedor, id_externo)
);

-- ---------- IA ----------
create table ia_runs (
  id bigint generated always as identity primary key,
  cliente_id uuid references clientes(id) on delete restrict,
  tarea text not null,
  modelo text not null,
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  costo_usd numeric(10,6) not null default 0,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ia_runs_cliente_created_idx on ia_runs (cliente_id, created_at desc);

-- ---------- Tickets ----------
create table tickets (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete restrict,
  canal text not null,                         -- email | whatsapp | sistema
  estado estado_ticket not null default 'abierto',
  prioridad prioridad_ticket not null default 'media',
  asunto text not null,
  resumen_ia text,
  escalado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_escalados_idx on tickets (created_at desc) where escalado and estado <> 'resuelto';

-- ---------- updated_at ----------
create or replace function tocar_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger clientes_updated before update on clientes for each row execute function tocar_updated_at();
create trigger suscripciones_updated before update on suscripciones for each row execute function tocar_updated_at();
create trigger tickets_updated before update on tickets for each row execute function tocar_updated_at();

-- =====================================================================
-- RLS
-- Regla: el usuario LEE lo suyo. Todas las ESCRITURAS sensibles
-- (etapa, suscripciones, eventos, ia_runs) las hace el servidor con
-- service_role, que saltea RLS. Así nadie se auto-activa un plan.
-- =====================================================================
alter table admins              enable row level security;
alter table productos           enable row level security;
alter table clientes            enable row level security;
alter table suscripciones       enable row level security;
alter table eventos             enable row level security;
alter table webhooks_recibidos  enable row level security;
alter table ia_runs             enable row level security;
alter table tickets             enable row level security;

-- Helper: ¿este cliente es del usuario actual?
create or replace function es_mi_cliente(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from clientes where id = cid and user_id = auth.uid());
$$;

create policy admins_select on admins for select to authenticated using (es_admin());

create policy productos_select on productos for select to anon, authenticated using (true);

create policy clientes_select on clientes for select to authenticated
  using (user_id = auth.uid() or es_admin());

create policy suscripciones_select on suscripciones for select to authenticated
  using (es_mi_cliente(cliente_id) or es_admin());

create policy eventos_select on eventos for select to authenticated
  using (es_mi_cliente(cliente_id) or es_admin());

create policy ia_runs_select on ia_runs for select to authenticated using (es_admin());

create policy tickets_select on tickets for select to authenticated
  using (es_mi_cliente(cliente_id) or es_admin());
create policy tickets_insert on tickets for insert to authenticated
  with check (es_mi_cliente(cliente_id) and escalado = false);
create policy tickets_update_admin on tickets for update to authenticated
  using (es_admin()) with check (es_admin());

-- webhooks_recibidos: sin políticas → solo service_role.

-- ---------- Seed ----------
insert into productos (slug, nombre) values ('repunte', 'Repunte');
