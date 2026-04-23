# CONTEXTO DEL PROYECTO PARA CLAUDE CODE

> Este documento es el resumen completo del proyecto AgroSistema, su estado
> actual, decisiones tomadas y próximos pasos. Leelo entero antes de proponer
> cualquier cambio o implementación.

---

## 1. VISIÓN GENERAL DEL PROYECTO

### Qué es AgroSistema

Sistema web multi-tenant de gestión integral agropecuaria, instalable como PWA
desde el celular. Pensado para que empresas agropecuarias gestionen toda su
operación: campos, lotes, cultivos, stock de insumos, aplicaciones a lote,
labores, cosechas, ventas, costos y márgenes.

### Origen y objetivo del proyecto

- Lo desarrolla Julio (developer) junto con su padre (contador, usuario final clave).
- Arranca con dos empresas reales (las que maneja el padre como contador).
- A futuro se planea ofrecer como SaaS a otras empresas agropecuarias.
- El proyecto se llama "AgroSistema" provisoriamente.

### Usuarios objetivo y roles

- **super_admin**: dueño del sistema (Julio). Crea empresas y vincula usuarios.
- **admin_empresa**: dueño de la empresa cliente. Ve y administra todo de su(s) empresa(s).
- **contador**: rol del padre. Ve reportes financieros, márgenes, costos. Puede estar
  en varias empresas a la vez (ya está implementado en el modelo).
- **encargado_campo**: peón/encargado en el campo. Usa la PWA en el celular para
  cargar aplicaciones a lote. Interfaz ultrasimple, funciona offline.

---

## 2. STACK TECNOLÓGICO

### Frontend
- **Next.js 15** (App Router)
- **TypeScript** estricto
- **Tailwind CSS** para estilos
- **shadcn/ui** (componentes copiables, no librería pesada)
- **React Hook Form + Zod** para formularios y validación
- **Leaflet + react-leaflet** para mapas (polígonos de lotes con GeoJSON)
- **Recharts / Tremor** para gráficos del dashboard
- **serwist** para PWA (service worker)
- **Dexie.js** para IndexedDB local (offline-first del encargado)
- **html5-qrcode** para escaneo de códigos de barras desde el celular
- **lucide-react** para iconos
- **date-fns** para manejo de fechas
- **clsx + tailwind-merge** vía utility `cn()` en `lib/utils.ts`

### Backend
- **Supabase** (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **PostgreSQL 15 con PostGIS** (para polígonos GeoJSON de lotes)
- **Row Level Security (RLS)** nativo de PostgreSQL para multi-tenant
- **Edge Functions** (Deno/TypeScript) para lógica custom: OCR de facturas, IA, generación de reportes, etc.

### IA
- **Claude API (Anthropic)** para:
  - Asistente conversacional sobre datos de la empresa
  - OCR + parsing de facturas (modelo multimodal procesa el PDF directamente)

### Storage de archivos
- **Supabase Storage** al inicio (incluido en el plan).
- Migrar a **Cloudflare R2** si crece el tráfico (no cobra egreso).

### Hosting
- **Vercel** para el frontend (deploy automático desde GitHub).
- **Supabase Cloud** para backend/DB.

### Infraestructura adicional (cuando aplique)
- **Sentry** para monitoreo de errores en producción.
- **Resend** para emails transaccionales y reportes programados.
- **GitHub + GitHub Actions** para versionado y CI/CD.

---

## 3. PRINCIPIOS Y FILOSOFÍA DEL SISTEMA

Estos principios son **innegociables**. Todo lo que se desarrolle debe respetarlos.

### 3.1 Multi-tenancy por RLS
Cada tabla con datos de empresa tiene una columna `empresa_id` y una política
RLS que filtra automáticamente según el usuario autenticado. PostgreSQL ejecuta
el filtro en TODAS las queries. **Imposible filtrar datos de otra empresa por error.**

Las funciones helper centrales (definidas en migración 001) son:
- `user_has_empresa_access(empresa_uuid UUID)`
- `user_is_super_admin()`

Al crear nuevas tablas, **siempre** habilitar RLS y crear su política correspondiente.

### 3.2 Stock como derivado de movimientos
La tabla `stock` NUNCA se edita directamente. Toda variación pasa por
`movimientos_stock`, y un trigger actualiza el stock automáticamente. Esto
garantiza trazabilidad total y consistencia.

### 3.3 Costos congelados
Cuando se aplica un producto a un lote, el costo imputado es el del **momento
de la compra**, no el actual. Se guarda en `costo_unitario_ars_momento`. Los
reportes históricos no se distorsionan por cambios de precio.

### 3.4 Multi-moneda con cotización congelada
Las compras en USD guardan moneda original, cotización del día y total en ARS.
Los reportes históricos siempre muestran los valores correctos.

### 3.5 Cierre de períodos
Los períodos contables cerrados son inmutables. Cualquier modificación requiere
reapertura explícita con auditoría.

### 3.6 Offline-first para el encargado
La PWA guarda aplicaciones pendientes en IndexedDB cuando no hay conexión.
Un worker las sincroniza con Supabase cuando vuelve la red. **El encargado
nunca pierde una aplicación por falta de señal.**

### 3.7 Auditoría completa
Todo cambio importante en datos sensibles se registra en la tabla `auditoria`
con usuario, fecha, valores anteriores y nuevos. Imprescindible para uso contable.

### 3.8 Testing obligatorio en cálculos
Toda función de cálculo (stock, costos, márgenes, prorrateos, conversiones de
moneda) debe tener tests unitarios desde el día uno. **No hay excepciones.**

---

## 4. JERARQUÍA CONCEPTUAL DEL SISTEMA

```
Sistema (AgroSistema) - lo administra el super_admin (Julio)
└── Empresas (clientes)
    └── Unidades de Negocio (Agricultura, Ganadería, Tambo, etc.)
        └── Campos (físicos, con ubicación geográfica)
            └── Lotes (con polígono GeoJSON)
                └── Campañas (cultivo en período de tiempo)
                    ├── Aplicaciones (insumos al lote)
                    ├── Labores (trabajos sobre el lote)
                    ├── Cosechas (eventos de recolección)
                    └── Destinos de Producción (ventas/transferencias internas)
```

Todos los costos e ingresos se imputan a la **campaña**, no al lote. Un mismo
lote tiene múltiples campañas a lo largo de los años.

---

## 5. MODELO DE DATOS COMPLETO (v9)

El modelo tiene 35+ tablas. Está documentado en formato Mermaid en
`docs/MODELO_DATOS.mermaid`. Las migraciones SQL están en `supabase/migrations/`.

### Tablas principales por área

**Organizacional:**
- `empresas`, `usuarios_empresas` (vinculo a auth.users), `unidades_negocio`, `operarios`

**Geográfico/productivo:**
- `campos` (con PostGIS), `lotes` (con polígono GeoJSON), `campanias`

**Catálogo y stock:**
- `productos`, `presentaciones`, `partidas_producto` (trazabilidad)
- `depositos`, `stock`, `movimientos_stock` (trigger automático)

**Compras y proveedores:**
- `proveedores`, `contratistas`
- `compras`, `compras_items` (multi-moneda con cotización congelada)

**Operativo:**
- `aplicaciones`, `aplicaciones_items`, `devoluciones_stock`, `consumos_partida`
- `labores`, `labores_materiales`, `labores_mano_obra`
- `maquinarias`, `mantenimientos`
- `cosechas`, `destinos_produccion`, `precios_referencia`
- `mermas` (pérdidas en depósito o lote, con motivo)

**Administrativo y contable:**
- `gastos_generales`, `periodos_contables`

**Planificación y análisis:**
- `planes_campania`, `planes_campania_items`, `presupuestos_siembra`
- `analisis_sensibilidad`, `kpis_snapshots`

**Reportes y notificaciones:**
- `reportes_plantillas`, `reportes_suscripciones`, `reportes_generados`
- `alertas_configuracion`, `alertas_disparadas`

**IA y soporte:**
- `conversaciones_ia`, `mensajes_ia`
- `adjuntos` (polimórfica), `auditoria`

---

## 6. ESTADO ACTUAL DEL DESARROLLO

### Lo que está hecho

**Infraestructura:**
- Proyecto Next.js 15 + TypeScript creado en `apps/web/`
- Supabase configurado y conectado vía `.env.local`
- Cliente Supabase para browser y server (`apps/web/src/lib/supabase/`)
- Multi-tenancy con RLS configurado en migraciones

**Base de datos:**
- Migración **001_core_organizacional.sql** APLICADA: empresas, usuarios_empresas,
  unidades_negocio, operarios, campos, lotes, funciones RLS, triggers updated_at.
- Migración **002_productos_stock_compras.sql** APLICADA: productos, presentaciones,
  proveedores, contratistas, depositos, stock con trigger automático,
  movimientos_stock, compras, compras_items, partidas_producto.
- Migración **003_pendiente.sql**: stub. **Falta implementar el resto del modelo v9.**

**Datos iniciales:**
- Usuario `juliobornes10@gmail.com` creado en Supabase Auth (con auto-confirm).
- Empresa "Canciani" (CUIT provisorio `00-00000000-0`) creada.
- Usuario vinculado a Canciani como `super_admin`.
- Unidad de negocio "Agricultura" creada.
- Depósito Central creado.

**Frontend:**
- Layout raíz (`src/app/layout.tsx`) con metadata PWA.
- Página landing pública (`src/app/page.tsx`).
- Página de login (`src/app/login/page.tsx`) funcional con Supabase Auth.
- Dashboard básico (`src/app/app/page.tsx`) que muestra el email del usuario y empresas vinculadas.
- Tipos TypeScript base del modelo (`src/types/index.ts`).
- Estructura de IndexedDB con Dexie para offline (`src/lib/offline-db.ts`).
- Manifest PWA (`public/manifest.json`).

### Lo que NO está hecho todavía

**Migraciones pendientes (todas las del modelo v9 que no estén en 001 o 002).**

**Frontend, no se construyó nada de:**
- Layout privado con sidebar y header
- Selector de empresa activa
- Componentes UI base (button, input, table, modal, etc.)
- Gestión de empresas (CRUD)
- Ningún módulo funcional (campos, lotes, productos, stock, compras, etc.)
- Mapa con Leaflet
- Sincronización offline real
- OCR de facturas
- Reportes
- Asistente IA

---

## 7. PLAN DE DESARROLLO POR FASES

Ver `docs/PLAN_DESARROLLO.md` para el detalle completo. Resumen:

- **Fase 0** - Setup (HECHO en su mayoría): proyecto, Supabase, primer deploy
- **Fase 1** - MVP mínimo vendible (EN CURSO): CRUD básicos, stock, aplicaciones simples, PWA
- **Fase 2** - Usabilidad en el campo: mapa, código de barras, offline real, UI simplificada para encargado
- **Fase 3** - Contabilidad básica: cosechas, ventas, labores, mermas, márgenes, multi-moneda
- **Fase 4** - Valor agregado: OCR de facturas, dashboard KPIs, alertas, reportes programados
- **Fase 5** - Planificación y análisis: planes de campaña, presupuestos, sensibilidad, punto de equilibrio
- **Fase 6** - Avanzado: transferencias internas, precios pizarra, trazabilidad de partidas, cierre de períodos, asistente IA, mantenimiento de maquinaria
- **Fase 7** - Escalar como SaaS: landing pública, onboarding, Stripe, trials

---

## 8. ESTRUCTURA DEL PROYECTO

```
agrosistema/
├── README.md
├── package.json (raíz del monorepo, workspaces)
├── .gitignore
├── apps/
│   └── web/                          # Frontend Next.js + PWA
│       ├── package.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── postcss.config.mjs
│       ├── .env.local                # NEXT_PUBLIC_SUPABASE_URL y ANON_KEY
│       ├── public/
│       │   └── manifest.json
│       └── src/
│           ├── app/                  # App Router de Next.js (NO renombrar)
│           │   ├── layout.tsx        # Layout raíz
│           │   ├── globals.css
│           │   ├── page.tsx          # Landing pública
│           │   ├── login/
│           │   │   └── page.tsx
│           │   └── app/              # Zona privada (post-login)
│           │       └── page.tsx      # Dashboard
│           ├── components/           # POR CREAR
│           ├── lib/
│           │   ├── supabase/
│           │   │   ├── client.ts     # Cliente browser
│           │   │   └── server.ts     # Cliente server
│           │   └── offline-db.ts     # IndexedDB con Dexie
│           ├── hooks/                # POR CREAR
│           └── types/
│               └── index.ts          # Tipos del modelo
├── supabase/
│   └── migrations/
│       ├── 001_core_organizacional.sql        # APLICADA
│       ├── 002_productos_stock_compras.sql    # APLICADA
│       └── 003_pendiente.sql                  # Stub - POR IMPLEMENTAR
├── scripts/
│   └── seed.sql                      # Seed inicial (ya aplicado)
└── docs/
    ├── MODELO_DATOS.mermaid          # Modelo v9 completo
    ├── PLAN_DESARROLLO.md
    └── ARQUITECTURA.md
```

---

## 9. CONVENCIONES DE CÓDIGO

### Generales
- TypeScript estricto en todo (no `any` salvo necesidad real y comentada).
- Nombres en español para entidades del dominio (campania, lote, aplicacion).
- Nombres en inglés para conceptos técnicos (handler, props, state).
- Usar `async/await`, evitar `.then()` encadenados.
- Componentes server por defecto en Next.js 15. `'use client'` solo cuando necesario.

### Estructura de archivos React
- Una página por archivo `page.tsx`.
- Componentes con PascalCase (`EmpresaSelector.tsx`).
- Funciones helper con camelCase (`empresa-actual.ts` puede tener funciones).
- Hooks personalizados empiezan con `use` y van en `src/hooks/`.

### Supabase
- Usar `createClient` de `@/lib/supabase/server` en server components.
- Usar `createClient` de `@/lib/supabase/client` en client components.
- Confiar en RLS para filtrar datos. NO agregar `.eq('empresa_id', ...)` redundante salvo cuando sea necesario por performance o claridad.

### Estilos
- Tailwind CSS, evitar CSS custom salvo casos puntuales.
- Color primario: `green-600` / `green-700` (paleta Tailwind).
- Componentes UI base copiar patrón de shadcn/ui (no instalar la librería entera).

### Formularios
- React Hook Form + Zod para validación.
- Schemas Zod en archivos separados o al inicio del componente.

### Server Actions
- Usar Server Actions de Next.js 15 cuando se pueda, en lugar de API routes.
- Marcar archivos con `'use server'` cuando corresponda.

### Git
- Commits en español, presente, descriptivos: "Agrega selector de empresa en header"
- Branch principal: `main`.
- Hacer commits frecuentes y atómicos.

---

## 10. PRÓXIMO MÓDULO A IMPLEMENTAR: MÓDULO 1 - GESTIÓN DE EMPRESAS Y SELECTOR

### Objetivo
Permitir que el super_admin cree y administre empresas, y que cualquier usuario
pueda cambiar la empresa activa cuando pertenece a varias.

### Componentes a crear

1. **Layout privado** (`src/app/app/layout.tsx`):
   - Sidebar a la izquierda con navegación a módulos.
   - Header arriba con selector de empresa, email del usuario y botón de salir.
   - Sección "Admin" en el sidebar visible solo para super_admin.

2. **Componentes UI base** (`src/components/ui/`):
   - `button.tsx` con variantes (primary, secondary, ghost, danger) y sizes (sm, md, lg).
   - `input.tsx` con label y manejo de errores.
   - Eventualmente: `table.tsx`, `modal.tsx`, `select.tsx`.

3. **Utilidad `cn`** (`src/lib/utils.ts`):
   - Combinar clases con `clsx` y `tailwind-merge`.

4. **Gestión de empresa activa** (`src/lib/empresa-actual.ts`):
   - Server action `getEmpresaActiva()` que lee cookie y trae datos del usuario y empresas.
   - Server action `setEmpresaActiva(empresaId)` que setea la cookie.

5. **Componente selector de empresa** (`src/components/empresa-selector.tsx`):
   - Si hay una sola empresa: mostrar el nombre como texto.
   - Si hay múltiples: mostrar `<select>` para cambiar.

6. **Botón de logout** (`src/components/logout-button.tsx`):
   - Llama `supabase.auth.signOut()` y redirige a `/login`.

7. **Dashboard mejorado** (`src/app/app/page.tsx`, REEMPLAZAR):
   - Muestra empresa activa y rol.
   - Cards placeholder para KPIs (que se llenarán en Fase 4).

8. **Página de empresas** (`src/app/app/empresas/page.tsx`):
   - Solo accesible por super_admin (verificar rol antes de renderizar).
   - Listado de empresas existentes en tabla.
   - Formulario lateral para crear nueva empresa.

9. **Formulario de creación de empresa** (`src/app/app/empresas/crear-empresa-form.tsx`):
   - Client component con React Hook Form (o useState simple por ahora).
   - Inserta directamente en `empresas` (RLS solo permite a super_admin).
   - Refresca la página al éxito.

### Verificación post-implementación
- Login funciona y redirige al dashboard nuevo.
- Sidebar muestra los links de navegación.
- Header muestra "Empresa: Canciani" (porque es la única).
- Sección "Admin" → "Empresas" visible (porque sos super_admin).
- En `/app/empresas` se ve Canciani en la tabla.
- Crear una empresa nueva (ej: "Empresa Prueba", CUIT `30-99999999-9`) funciona.
- La nueva empresa aparece en la lista pero NO en el selector (porque el usuario no está vinculado a ella todavía, eso es del próximo módulo).
- Botón "Salir" desloguea correctamente.
- Acceder a `/app/empresas` con un usuario no super_admin muestra error de permisos.

---

## 11. CÓMO VAMOS A TRABAJAR

1. **Confirmá que entendiste el contexto** antes de codear nada.
2. **Implementá módulo por módulo**, no todo de una.
3. **Pedí confirmación antes de cambios grandes** o decisiones de arquitectura.
4. **Hacé commits frecuentes** con mensajes descriptivos en español.
5. **Cuando termines un módulo, listá qué probar** para verificar que funciona.
6. **Si encontrás algo del modelo v9 que no está claro**, preguntá antes de inventar.
7. **Si proponés mejoras al modelo**, justificalas con criterio agropecuario o técnico, no por capricho.
8. **Mantené coherencia con lo que ya está construido**: mismas convenciones, misma estética visual, mismos patrones de código.

---

## 12. INFORMACIÓN DEL ENTORNO LOCAL

- **Sistema operativo:** Windows
- **Path del proyecto:** `C:\PROYECTOS\agrosistema`
- **Frontend corre con:** `cd apps/web && npm run dev` → http://localhost:3000
- **Variables de entorno en:** `apps/web/.env.local` (ya configuradas)
- **Email del super_admin:** juliobornes10@gmail.com
- **Empresa de prueba:** "Canciani" (CUIT provisorio)

---

## 13. RECURSOS ÚTILES

- Documentación de Next.js 15: https://nextjs.org/docs
- Documentación de Supabase: https://supabase.com/docs
- Patrones de RLS en Supabase: https://supabase.com/docs/guides/auth/row-level-security
- Leaflet con React: https://react-leaflet.js.org/
- shadcn/ui (referencia de componentes): https://ui.shadcn.com/
- PostGIS docs: https://postgis.net/docs/

---

## INSTRUCCIÓN FINAL PARA CLAUDE CODE

Cuando termines de leer este documento:

1. Confirmá brevemente que entendiste el proyecto, su stack, su estado y sus principios.
2. Listá las dudas concretas si las hay.
3. NO empieces a codear hasta tener confirmación explícita del usuario.
4. Cuando esté confirmado, empezá implementando el **Módulo 1: Gestión de empresas
   y selector de empresa activa** según la sección 10 de este documento.
