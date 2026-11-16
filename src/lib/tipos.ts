export type Rol = "duenio" | "mozo" | "barra";
export type EstadoPedido = "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";
export type EstadoMesa = "libre" | "ocupada" | "pide_cuenta";
export type MedioPago = "efectivo" | "qr" | "tarjeta";

export interface Usuario { id: string; negocio_id: string; nombre: string; rol: Rol }
export interface Negocio { id: string; nombre: string; direccion: string | null; codigo_equipo: string }
export interface Mesa { id: string; negocio_id: string; numero: number; codigo: string; estado: EstadoMesa; llamado_at: string | null; activa: boolean }
export interface Categoria { id: string; nombre: string; orden: number }
export interface Producto {
  id: string; categoria_id: string; nombre: string; descripcion: string | null; precio: number;
  foto_url: string | null; disponible: boolean; max_sabores: number; orden: number;
}
export interface Sabor { id: string; nombre: string; disponible: boolean }
export interface ItemPedido { id: string; nombre_producto: string; cantidad: number; precio_unitario: number; sabores: string[]; nota: string | null }
export interface Pedido {
  id: string; mesa_id: string; cuenta_id: string; numero_mesa: number; estado: EstadoPedido; origen: "qr" | "mozo";
  total: number; creado_at: string; preparando_at: string | null; listo_at: string | null; entregado_at: string | null;
  items_pedido?: ItemPedido[];
}

// Lo que devuelve carta_mesa() para el cliente
export interface CartaPublica {
  negocio: string; mesa: number;
  categorias: { id: string; nombre: string; productos: { id: string; nombre: string; descripcion: string | null; precio: number; foto_url: string | null; max_sabores: number }[] }[];
  sabores: { id: string; nombre: string }[];
}
export interface EstadoMesaPublico {
  mesa: number; estado_mesa: EstadoMesa; llamado: boolean; total: number;
  pedidos: { id: string; estado: EstadoPedido; creado_at: string; total: number; items: { nombre: string; cantidad: number; sabores: string[] }[] }[];
}
