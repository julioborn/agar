'use server';

import {
  crearAplicacion as _crearAplicacion,
  type AplicacionData,
} from '@/app/app/cultivos/actions';

export async function crearAplicacion(data: AplicacionData) {
  return _crearAplicacion(data);
}
