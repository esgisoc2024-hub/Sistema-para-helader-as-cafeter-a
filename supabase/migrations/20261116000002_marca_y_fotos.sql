-- Apariencia de cada local (logo y color) y fotos subidas al almacenamiento de Supabase.

alter table public.negocios
  add column logo_url text,
  add column color text not null default '#d94a64' check (color ~ '^#[0-9a-fA-F]{6}$');

-- El dueño solo puede editar su propio negocio (antes faltaba el "with check").
drop policy negocio_editar on public.negocios;
create policy negocio_editar on public.negocios for update to authenticated
  using (id = public.mi_negocio() and public.mi_rol() = 'duenio')
  with check (id = public.mi_negocio());

-- El cliente ve el logo y el color del local en la carta.
create or replace function public.carta_mesa(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mesa mesas; v_neg negocios; v_res jsonb;
begin
  select * into v_mesa from mesas where codigo = p_codigo and activa;
  if not found then return null; end if;
  select * into v_neg from negocios where id = v_mesa.negocio_id;
  select jsonb_build_object(
    'negocio', v_neg.nombre,
    'logo_url', v_neg.logo_url,
    'color', v_neg.color,
    'mesa', v_mesa.numero,
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre,
        'productos', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'precio', p.precio, 'foto_url', p.foto_url,
            'grupos', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'id', g.id, 'nombre', g.nombre, 'minimo', pg.minimo, 'maximo', pg.maximo,
                'opciones', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'nombre', o.nombre, 'precio_extra', o.precio_extra)
                              order by o.orden, o.nombre), '[]'::jsonb)
                             from opciones o where o.grupo_id = g.id and o.disponible)
              ) order by pg.orden, g.nombre), '[]'::jsonb)
              from producto_grupos pg join grupos_opciones g on g.id = pg.grupo_id
              where pg.producto_id = p.id)
          ) order by p.orden, p.nombre), '[]'::jsonb)
          from productos p
          where p.categoria_id = c.id and p.disponible
            and not exists (
              select 1 from producto_grupos pg where pg.producto_id = p.id and pg.minimo > 0
                and (select count(*) from opciones o where o.grupo_id = pg.grupo_id and o.disponible) < pg.minimo))
      ) order by c.orden, c.nombre)
      from categorias c where c.negocio_id = v_mesa.negocio_id), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;
