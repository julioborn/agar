import Dexie, { Table } from 'dexie';

// Base de datos local para funcionamiento offline del encargado de campo.
// Cuando el celular no tiene señal, las aplicaciones se guardan acá y se
// sincronizan con Supabase cuando vuelve la conexión.

export interface AplicacionPendiente {
  id?: number;
  localId: string;
  campaniaId: string;
  fecha: string;
  tipo: string;
  items: Array<{
    productoId: string;
    depositoOrigenId: string;
    cantidadRetirada: number;
    cantidadAplicada?: number;
    cantidadDevuelta?: number;
  }>;
  observaciones?: string;
  estado: 'pendiente_sync' | 'sincronizado' | 'error';
  intentos: number;
  creadaEn: number;
  ultimoError?: string;
}

export class AgroLocalDB extends Dexie {
  aplicacionesPendientes!: Table<AplicacionPendiente, number>;

  constructor() {
    super('AgroLocal');
    this.version(1).stores({
      aplicacionesPendientes: '++id, localId, estado, creadaEn',
    });
  }
}

export const localDB = new AgroLocalDB();
