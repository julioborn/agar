# Plan de desarrollo por fases

El modelo completo (v9) es ambicioso. La clave del éxito es NO intentar hacer todo
de una. Dividí el desarrollo en fases cortas, cada una terminada y probada antes de
pasar a la siguiente. Cada fase debe ser usable por tu papá en una empresa real.

## Fase 0 — Setup (semana 1)

- [x] Crear repo en GitHub
- [ ] Crear proyecto en Supabase (región San Pablo)
- [ ] Aplicar migraciones 001 y 002
- [ ] Correr seed inicial
- [ ] Levantar frontend en local
- [ ] Primer deploy a Vercel conectado a GitHub
- [ ] Configurar Sentry para monitoreo de errores

## Fase 1 — MVP mínimo vendible (4-6 semanas)

Objetivo: registrar stock y aplicaciones. Con esto ya es útil.

- [ ] Completar migraciones restantes (ver 003_pendiente.sql)
- [ ] CRUD empresas, campos, lotes (sin mapa todavía, solo datos)
- [ ] CRUD productos, depósitos, presentaciones
- [ ] Carga manual de compras con items (sin OCR)
- [ ] Ver stock por depósito
- [ ] Crear aplicaciones simples (retirada / aplicada / devuelta)
- [ ] Trigger de stock funcionando correctamente
- [ ] Login y multi-empresa con selector
- [ ] PWA instalable (manifest + service worker)

## Fase 2 — Usabilidad en el campo (3-4 semanas)

- [ ] Mapa con Leaflet mostrando polígonos de lotes
- [ ] Editor de polígonos (dibujar en el mapa)
- [ ] Escaneo de código de barras para productos
- [ ] Funcionamiento offline con Dexie y cola de sincronización
- [ ] Interfaz simplificada para encargado de campo (3 toques max)

## Fase 3 — Contabilidad básica (3-4 semanas)

- [ ] Cosechas y destinos de producción (ventas externas)
- [ ] Labores propias y contratadas
- [ ] Mermas con motivos
- [ ] Cálculo automático de costo_directo y margen_bruto por campaña
- [ ] Reportes básicos en PDF (jsPDF o similar)
- [ ] Multi-moneda con cotización congelada

## Fase 4 — Valor agregado (3-4 semanas)

- [ ] OCR de facturas con Claude API (Edge Function)
- [ ] Dashboard ejecutivo con KPIs
- [ ] Alertas básicas (stock mínimo, producto por vencer)
- [ ] Reportes programados por email (Resend + cronjob en Supabase)

## Fase 5 — Planificación y análisis (4 semanas)

- [ ] Planes de campaña con presupuesto
- [ ] Presupuestos de siembra (plantillas por cultivo)
- [ ] Análisis de sensibilidad
- [ ] Punto de equilibrio calculado

## Fase 6 — Funciones avanzadas

- [ ] Transferencias internas entre unidades de negocio
- [ ] Precios pizarra con API automática
- [ ] Trazabilidad de partidas con FIFO
- [ ] Cierre de períodos contables
- [ ] Asistente IA conversacional sobre datos de la empresa
- [ ] Mantenimiento de maquinarias con costo real por hora

## Fase 7 — Escalar como SaaS

- [ ] Landing de venta pública
- [ ] Onboarding de nuevas empresas
- [ ] Stripe para cobro mensual
- [ ] Sistema de trials
- [ ] Documentación para usuarios finales

## Recomendaciones generales

1. **Cada PR con tests**. Desde el día uno. No hay excepciones en cálculos.
2. **Deployá seguido**. Pequeño, frecuente, roto-arreglado, no enormes releases.
3. **Probá con tu papá semanalmente**. Usuario real desde el principio.
4. **No agregues features que nadie pidió**. El modelo v9 ya tiene muchísimo.
5. **Registrá bugs en GitHub Issues**. No confíes en la memoria.
