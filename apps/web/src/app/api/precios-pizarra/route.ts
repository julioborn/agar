import { NextResponse } from 'next/server';
import { fetchPreciosPizarra } from '@/lib/precios-pizarra';

export async function GET() {
  const precios = await fetchPreciosPizarra();
  if (!precios) {
    return NextResponse.json(
      { error: 'No se pudo obtener la pizarra de Rosario' },
      { status: 502 },
    );
  }
  return NextResponse.json(precios);
}
