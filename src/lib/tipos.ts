export type Rol = "duenio" | "mozo" | "barra";
export type EstadoPedido = "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";
export type EstadoMesa = "libre" | "ocupada" | "pide_cuenta";
export type MedioPago = "efectivo" | "qr" | "tarjeta";

export interface Usuario { id: string; negocio_id: string; nombre: string; rol: Rol }
export interface Negocio { id: string; nombre: string; direccion: string | null; codigo_equipo: string; logo_url: string | null; color: string;
  portada_url: string | null; portada_tipo: "imagen" | "video" | null;
  estado: "prueba" | "activo" | "suspendido" }
export interface Mesa { id: string; negocio_id: string; numero: number; codigo: string; estado: EstadoMesa; llamado_at: string | null; activa: boolean }
export interface Categoria { id: string; nombre: string; orden: number }
export interface Producto {
  id: string; categoria_id: string; nombre: string; descripcion: string | null; precio: number;
  foto_url: string | null; disponible: boolean; orden: number;
}
export interface GrupoOpciones { id: string; nombre: string; orden: number }
export interface Opcion { id: string; grupo_id: string; nombre: string; precio_extra: number; disponible: boolean; orden: number }
export interface ProductoGrupo { producto_id: string; grupo_id: string; minimo: number; maximo: number; orden: number }
export interface OpcionElegida { grupo: string; nombre: string; extra: number }
export interface ItemPedido { id: string; nombre_producto: string; cantidad: number; precio_unitario: number; opciones: OpcionElegida[]; nota: string | null }
export interface Pedido {
  id: string; mesa_id: string; cuenta_id: string; numero_mesa: number; estado: EstadoPedido; origen: "qr" | "mozo";
  total: number; creado_at: string; preparando_at: string | null; listo_at: string | null; entregado_at: string | null;
  items_pedido?: ItemPedido[];
}

// Lo que devuelve carta_mesa() para el cliente
export interface GrupoPublico {
  id: string; nombre: string; minimo: number; maximo: number;
  opciones: { id: string; nombre: string; precio_extra: number }[];
}
export interface ProductoPublico {
  id: string; nombre: string; descripcion: string | null; precio: number; foto_url: string | null; grupos: GrupoPublico[];
}
export interface CartaPublica {
  suspendido?: boolean;
  negocio: string; mesa: number; logo_url: string | null; color: string | null;
  portada_url: string | null; portada_tipo: "imagen" | "video" | null;
  categorias: { id: string; nombre: string; productos: ProductoPublico[] }[];
}
export interface EstadoMesaPublico {
  mesa: number; estado_mesa: EstadoMesa; llamado: boolean; total: number;
  pedidos: { id: string; estado: EstadoPedido; creado_at: string; total: number; items: { nombre: string; cantidad: number; opciones: OpcionElegida[] }[] }[];
}
