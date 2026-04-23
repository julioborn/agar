# Arquitectura

## Principios clave

### 1. Multi-tenancy por RLS (Row Level Security)

Cada tabla con datos de empresa tiene `empresa_id` y una política RLS que verifica
que el usuario autenticado pertenezca a esa empresa. PostgreSQL ejecuta el filtro
automáticamente en TODAS las queries. Imposible filtrar datos de otra empresa por error.

Las funciones `user_has_empresa_access(uuid)` y `user_is_super_admin()` centralizan
la lógica de permisos.

### 2. Stock como derivado de movimientos

La tabla `stock` NUNCA se edita directamente. El único camino es insertar filas en
`movimientos_stock`, y un trigger actualiza el stock automáticamente. Esto garantiza:

- Trazabilidad total: toda variación tiene un registro con fecha, usuario y motivo.
- Consistencia: imposible tener stock sin movimiento que lo justifique.
- Auditoría: reconstruir el stock histórico a cualquier fecha es trivial.

### 3. Costos congelados

El campo `costo_unitario_ars_momento` en `aplicaciones_items` y similares guarda el
costo del producto AL MOMENTO DE LA COMPRA, no el actual. Esto preserva la verdad
histórica: un reporte del año pasado sigue mostrando los costos del año pasado.

### 4. Offline-first para el encargado

La PWA guarda aplicaciones pendientes en IndexedDB (Dexie) cuando no hay conexión.
Un service worker las sincroniza con Supabase cuando vuelve la señal. El encargado
nunca pierde una aplicación por falta de red.

### 5. Cierre de períodos

Los períodos contables cerrados son inmutables. Cualquier modificación requiere
reapertura explícita con auditoría. Implementado con política RLS + trigger de
validación.

## Componentes

```
┌─────────────────────────────────────────────┐
│  Cliente (PWA)                              │
│  Next.js + React + Tailwind                 │
│  - Páginas admin (contador, dueño)          │
│  - Páginas campo (encargado, offline)       │
│  - Mapas con Leaflet + polígonos GeoJSON    │
│  - IndexedDB local (Dexie)                  │
└──────────────┬──────────────────────────────┘
               │ HTTPS + JWT
               ▼
┌─────────────────────────────────────────────┐
│  Supabase                                   │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ PostgreSQL  │  │    Auth     │           │
│  │ + PostGIS   │  │    JWT      │           │
│  │ + RLS       │  └─────────────┘           │
│  └─────────────┘                            │
│  ┌─────────────┐  ┌─────────────┐           │
│  │   Storage   │  │   Edge Fns  │           │
│  │  (archivos) │  │ (OCR, IA,   │           │
│  └─────────────┘  │  reportes)  │           │
│                   └─────────────┘           │
└─────────────────────────────────────────────┘
```

## Flujos críticos

### Aplicación a lote (offline-first)

1. Encargado selecciona lote y producto en PWA.
2. Escanea código de barras (html5-qrcode).
3. Ingresa cantidad retirada.
4. Si hay red: llamada directa a Supabase, se inserta aplicación + items + movimiento.
5. Si NO hay red: se guarda en Dexie con estado 'pendiente_sync'.
6. Al volver la red, un worker lee pendientes y los sube en orden.

### Compra con OCR

1. Usuario sube PDF de factura.
2. Frontend llama Edge Function `/parse-invoice`.
3. Edge Function manda el PDF a Claude API (multimodal).
4. Claude devuelve JSON estructurado: proveedor, items, precios.
5. Frontend muestra formulario precargado para revisión.
6. Usuario confirma o corrige, se crea la compra.

### Reporte programado

1. Cron job de Supabase (pg_cron) corre cada hora.
2. Revisa `reportes_suscripciones` activas que toque ejecutar.
3. Para cada una, genera el reporte (Edge Function `/build-report`).
4. Sube el PDF/XLSX a Supabase Storage.
5. Registra en `reportes_generados`.
6. Envía notificación por email vía Resend.

## Seguridad

- Autenticación con Supabase Auth (JWT, rotación automática).
- RLS obligatorio en todas las tablas.
- Variables sensibles solo en `.env` del server (nunca `NEXT_PUBLIC_*`).
- HTTPS obligatorio en producción.
- Rate limiting en Edge Functions.
- Auditoría de todo cambio en tablas críticas (tabla `auditoria`).
