// Script de un solo uso: crea una empresa demo aislada + usuario de prueba
// para que Google Play (u otro revisor) pueda acceder a la app sin tocar
// datos reales de producción. Lee credenciales de .env.local.
//
// Uso: node scripts/create-demo-reviewer.mjs

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envFile.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = 'googleplay.reviewer@agar.ar';
const PASSWORD = 'T3Z4kxP8ZaN#';
const CUIT = '30-99999999-9';

async function main() {
  // 1. Empresa demo aislada
  let { data: empresa } = await supabase
    .from('empresas')
    .select('id')
    .eq('cuit', CUIT)
    .maybeSingle();

  if (!empresa) {
    const { data, error } = await supabase
      .from('empresas')
      .insert({ nombre: 'Demo Google Play', cuit: CUIT, subdominio: 'demo-playstore', moneda_base: 'ARS' })
      .select('id')
      .single();
    if (error) throw error;
    empresa = data;
  }
  console.log('Empresa demo:', empresa.id);

  // 2. Usuario reviewer
  const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  let usuario = lista?.users?.find((u) => u.email === EMAIL);

  if (usuario) {
    await supabase.auth.admin.updateUserById(usuario.id, { password: PASSWORD, email_confirm: true });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    usuario = data.user;
  }
  console.log('Usuario reviewer:', usuario.id);

  // 3. Vincular como admin_empresa (acceso completo, solo a esta empresa demo)
  const { error: errVinc } = await supabase
    .from('usuarios_empresas')
    .upsert({ usuario_id: usuario.id, empresa_id: empresa.id, rol: 'admin_empresa' }, { onConflict: 'usuario_id,empresa_id' });
  if (errVinc) throw errVinc;

  // 4. Configuración básica
  await supabase.from('configuracion_empresa').upsert({
    empresa_id: empresa.id,
    precio_combustible: 1200,
    tipo_combustible: 'gasoil',
  });

  // 5. Datos mínimos para que la app no se vea vacía
  // (insert solo si no existe — sin asumir constraints UNIQUE que pueden no estar)
  async function insertIfMissing(table, match, row) {
    const { data: existing } = await supabase.from(table).select('id').match(match).maybeSingle();
    if (existing) return existing;
    const { data, error } = await supabase.from(table).insert(row).select('id').single();
    if (error) throw error;
    return data;
  }

  await insertIfMissing(
    'unidades_negocio',
    { empresa_id: empresa.id, nombre: 'Agricultura' },
    { empresa_id: empresa.id, nombre: 'Agricultura', tipo: 'agricultura' },
  );

  await insertIfMissing(
    'depositos',
    { empresa_id: empresa.id, nombre: 'Depósito Central' },
    { empresa_id: empresa.id, nombre: 'Depósito Central', tipo: 'central' },
  );

  for (const p of [
    { nombre: 'Glifosato 48%', categoria: 'agroquimico', unidad_base: 'L', stock_minimo: 200, requiere_trazabilidad: true },
    { nombre: 'Urea', categoria: 'fertilizante', unidad_base: 'kg', stock_minimo: 1000, requiere_trazabilidad: false },
    { nombre: 'Soja DM 4670', categoria: 'semilla', unidad_base: 'kg', stock_minimo: 500, requiere_trazabilidad: true },
  ]) {
    await insertIfMissing(
      'productos',
      { empresa_id: empresa.id, nombre: p.nombre },
      { empresa_id: empresa.id, ...p },
    );
  }

  const campo = await insertIfMissing(
    'campos',
    { empresa_id: empresa.id, nombre: 'Campo Demo' },
    { empresa_id: empresa.id, nombre: 'Campo Demo', hectareas_totales: 250 },
  );

  await insertIfMissing(
    'lotes',
    { campo_id: campo.id, nombre: 'Lote 1' },
    { campo_id: campo.id, nombre: 'Lote 1', hectareas: 120 },
  );

  console.log('\n✅ Listo.');
  console.log('Email:    ', EMAIL);
  console.log('Password: ', PASSWORD);
  console.log('Empresa:  Demo Google Play');
}

main().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exit(1);
});
