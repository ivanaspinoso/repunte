-- =====================================================================
-- Paso 3 — Alta automática de clientes
-- registrar_cliente(): crea el cliente en etapa 'prueba' y su evento
-- 'signup' en UNA transacción. Idempotente: si el usuario ya es cliente
-- de ese producto, no crea nada ni duplica el evento.
-- Solo la puede ejecutar el servidor (service_role).
-- =====================================================================

create or replace function registrar_cliente(
  p_user_id uuid,
  p_producto_slug text,
  p_payload jsonb default '{}'::jsonb
)
returns table (cliente_id uuid, etapa etapa_cliente, es_nuevo boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id uuid;
  v_cliente_id  uuid;
begin
  select id into v_producto_id from productos where slug = p_producto_slug;
  if v_producto_id is null then
    raise exception 'Producto inexistente: %', p_producto_slug using errcode = 'P0002';
  end if;

  insert into clientes (user_id, producto_id, etapa)
  values (p_user_id, v_producto_id, 'prueba')
  on conflict (user_id, producto_id) do nothing
  returning id into v_cliente_id;

  if v_cliente_id is not null then
    insert into eventos (cliente_id, tipo, payload)
    values (v_cliente_id, 'signup', p_payload);

    return query select v_cliente_id, 'prueba'::etapa_cliente, true;
  else
    return query
      select c.id, c.etapa, false
      from clientes c
      where c.user_id = p_user_id and c.producto_id = v_producto_id;
  end if;
end;
$$;

-- Nadie desde el navegador: ni anon ni authenticated.
revoke all on function registrar_cliente(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function registrar_cliente(uuid, text, jsonb) to service_role;
