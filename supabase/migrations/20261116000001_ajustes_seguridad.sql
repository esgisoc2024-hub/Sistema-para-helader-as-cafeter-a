-- Recomendaciones del asesor de seguridad de Supabase.
-- Las funciones del cliente (carta_mesa, crear_pedido, estado_mesa, llamar_desde_mesa) quedan
-- públicas a propósito: quien escanea el QR no tiene cuenta.
alter function public.tg_pedido_horas() set search_path = public;
revoke execute on function public.mi_negocio() from public, anon;
revoke execute on function public.mi_rol() from public, anon;
grant execute on function public.mi_negocio() to authenticated;
grant execute on function public.mi_rol() to authenticated;
