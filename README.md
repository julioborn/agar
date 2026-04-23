# AgroSistema

Sistema web multi-tenant de gestión agropecuaria (PWA instalable).

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **Base de datos**: PostgreSQL 15 con PostGIS (polígonos de lotes)
- **Multi-tenancy**: Row Level Security (RLS) nativo de PostgreSQL
- **Mapas**: Leaflet + react-leaflet
- **PWA/Offline**: serwist + Dexie.js (IndexedDB)
- **Gráficos**: Recharts / Tremor
- **Formularios**: React Hook Form + Zod
- **IA**: Claude API (Anthropic) para asistente y OCR de facturas
- **Hosting**: Vercel (frontend) + Supabase (backend/DB)

## Estructura del repositorio

```
agrosistema/
├── apps/web/              # Aplicación Next.js (frontend + PWA)
│   ├── src/
│   │   ├── app/           # App Router de Next.js
│   │   ├── components/    # Componentes React
│   │   ├── lib/supabase/  # Clientes de Supabase (browser + server)
│   │   ├── hooks/         # Hooks React personalizados
│   │   └── types/         # Tipos TypeScript del modelo
│   └── public/            # Assets estáticos + manifest PWA
├── supabase/
│   └── migrations/        # Migraciones SQL versionadas (schema completo + RLS)
├── scripts/               # Scripts de seed y utilidades
└── docs/                  # Documentación técnica
```

## Requisitos previos

- Node.js 20+
- Cuenta gratis en [Supabase](https://supabase.com)
- Supabase CLI: `npm install -g supabase`

## Puesta en marcha (paso a paso)

### 1. Crear proyecto en Supabase

1. Ir a https://supabase.com → New project
2. Elegir región cercana (San Pablo o Virginia para Argentina)
3. Guardar el password de la DB

### 2. Configurar el proyecto local

```bash
# Clonar/descomprimir
cd agrosistema/apps/web
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con los valores del panel de Supabase
# (Project Settings → API)
```

### 3. Aplicar migraciones a Supabase

```bash
# Desde la raíz del proyecto
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push
```

O copiar el contenido de `supabase/migrations/*.sql` y pegarlo en
Supabase Studio → SQL Editor → Run.

### 4. Cargar datos iniciales (seed)

```bash
# Desde Supabase Studio → SQL Editor ejecutar:
scripts/seed.sql
```

Usuario admin creado: `admin@agrosistema.com` / `admin1234` (cambiar en producción).

### 5. Arrancar el frontend

```bash
cd apps/web
npm run dev
```

Abrir http://localhost:3000

## Filosofía del proyecto

### Multi-tenancy por RLS

Toda tabla que contiene datos de empresa tiene una columna `empresa_id` y
una política RLS que filtra automáticamente según el usuario autenticado.
**Imposible** que un usuario vea datos de una empresa a la que no pertenece.

### Stock como fuente de verdad

La tabla `stock` NUNCA se edita directamente. Todos los cambios pasan por
`movimientos_stock`. Un trigger en PostgreSQL recalcula el stock automáticamente
en cada movimiento. Trazabilidad total garantizada.

### Costos congelados

Cuando se aplica un producto a un lote, el costo que se imputa es el del
momento de la compra (no el actual). Así los reportes históricos no se
distorsionan por cambios de precio.

### Cierre de períodos

Los períodos contables cerrados no se pueden modificar sin un proceso
explícito de reapertura con auditoría.

## Fases de desarrollo sugeridas

Ver `docs/PLAN_DESARROLLO.md`.

## Modelo de datos

Ver `docs/MODELO_DATOS.mermaid` (v9 completo).

## Licencia

Privado.
