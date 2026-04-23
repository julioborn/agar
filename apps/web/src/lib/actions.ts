'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function setEmpresaActiva(empresaId: string) {
  const cookieStore = await cookies();
  cookieStore.set('agro_empresa_id', empresaId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 días
    path: '/',
  });
  revalidatePath('/app', 'layout');
}
