-- Usuarios del equipo creados por el dueño (sin email): se identifican con un nombre de usuario
-- dentro de su local. La cuenta la crea la función "equipo" (necesita permisos de administrador de Supabase).
-- Para iniciar sesión se arma un email interno: <usuario>.<código del local>@equipo.mesamatch.app

alter table public.usuarios add column usuario text check (usuario ~ '^[a-z0-9._-]{3,30}$');
create unique index usuarios_usuario_por_negocio on public.usuarios (negocio_id, usuario) where usuario is not null;

-- El dueño solo puede cambiar el nombre y el rol de su equipo (no el usuario ni el local).
revoke update on public.usuarios from authenticated, anon;
grant update (nombre, rol) on public.usuarios to authenticated;
