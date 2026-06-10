import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ItemExtraido {
  codigo_proveedor: string | null;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario_neto: number;
  subtotal_neto: number;
}

export interface FacturaExtraida {
  tipo_documento: 'factura' | 'remito';
  proveedor_nombre: string;
  proveedor_cuit: string | null;
  fecha: string;
  numero_factura: string;
  moneda: 'ARS' | 'USD';
  cotizacion_usd: number | null;
  subtotal_neto: number;
  items: ItemExtraido[];
}

// Prompt con cache_control: se cachea en Anthropic (gratis en lecturas repetidas)
const SYSTEM_PROMPT = `Sos un asistente especializado en análisis de documentos de compra de insumos agropecuarios argentinos.
Cuando recibas un documento, extraé la información y devolvé ÚNICAMENTE un JSON con esta estructura exacta, sin texto adicional ni markdown:

{
  "tipo_documento": "factura" o "remito",
  "proveedor_nombre": "nombre del EMISOR/VENDEDOR (ver regla crítica abajo)",
  "proveedor_cuit": "CUIT del EMISOR sin guiones ni espacios, o null",
  "fecha": "YYYY-MM-DD",
  "numero_factura": "número como aparece en el documento",
  "moneda": "ARS" o "USD",
  "cotizacion_usd": número o null,
  "subtotal_neto": número sin IVA en la moneda del documento,
  "items": [
    {
      "codigo_proveedor": "código del artículo o null",
      "descripcion": "descripción tal como aparece en la factura",
      "cantidad": número,
      "unidad": "L" o "kg" o "unidad" o "sobre" o "bolsa" o "tn" u otro,
      "precio_unitario_neto": número sin IVA,
      "subtotal_neto": número sin IVA
    }
  ]
}

REGLA — tipo_documento:
- "factura" si el encabezado del documento dice FACTURA (A, B, C, E, M, etc.) o TICKET FISCAL.
- "remito" si dice REMITO, NOTA DE ENTREGA, REMITO DE ENTREGA, X, REMITO X, o similar.
  Los remitos típicamente no tienen IVA discriminado y sirven para acreditar entrega de mercadería.
  Si hay dudas, preferí "factura".

REGLA CRÍTICA — proveedor_nombre y proveedor_cuit:
Son los datos del EMISOR (quien VENDE y emite la factura), NO del comprador.
En una factura argentina:
- El EMISOR aparece en el MEMBRETE SUPERIOR: logo, razón social, CUIT del vendedor, domicilio del vendedor.
  Puede estar como imagen/logo en la parte superior de la hoja.
- El COMPRADOR/RECEPTOR aparece más abajo con etiquetas como "Señor:", "Sr./Sra.:", "Cliente:", "A:", "Razón social del comprador:", "CUIT del comprador:".
Tomá el nombre y CUIT del MEMBRETE SUPERIOR. NUNCA uses los datos bajo "Señor:" / "Cliente:" / "Comprador:" — ese es el receptor.
Si el nombre del emisor está en un logo imagen que no podés leer, devolvé null en proveedor_nombre.

Reglas adicionales:
1. Si el mismo artículo aparece en múltiples líneas, CONSOLIDÁ sumando cantidades y subtotales
2. Todos los importes deben ser NETOS, sin IVA ni percepciones
3. Si la factura está en pesos pero indica cotización del dólar, guardá la cotización en "cotizacion_usd"
4. Si la factura está en USD, "moneda" = "USD" y los importes van en USD
5. "subtotal_neto" de la cabecera = suma de todos los subtotales netos de los ítems
6. CRÍTICO — lectura de números en facturas ARGENTINAS:
   Las facturas argentinas usan PUNTO como separador de miles y COMA como separador decimal.
   Ejemplos de lectura correcta:
   - "1.500,75"  → 1500.75  (mil quinientos con 75 centavos)
   - "100,000"   → 100.0    (cien litros, la coma es decimal)
   - "1.000"     → 1000     (mil unidades, el punto es separador de miles)
   - "2.500,00"  → 2500.0   (dos mil quinientos)
   - "50,500"    → 50.5     (cincuenta con medio litro)
   NO interpretes la coma como separador de miles como se hace en inglés.
7. CRÍTICO — formato de números en el JSON de respuesta: usá SIEMPRE punto como separador decimal y SIN separador de miles.
   ✓ Correcto: 3425.10   ✗ Incorrecto: 3.425,10 o 3.425.10 o 3425,10`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'pdf') return await parsearPDF(file);
    if (['xlsx', 'xls', 'csv'].includes(ext)) return await parsearExcel(file);

    return NextResponse.json({ error: 'Formato no soportado. Usá PDF, Excel (.xlsx/.xls) o CSV.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    console.error('[parsear-factura]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── PDF: siempre en modo documento visual ────────────────────────────────────
// Claude lee texto E imágenes del PDF, captando logos, membretes y nombres
// que aparecen como imagen en la factura (no solo texto embebido).

async function parsearPDF(file: File): Promise<NextResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return await llamarClaudeConPDF(base64);
}

// ── Excel/CSV: convertir a texto y mandar a Claude ──────────────────────────

async function parsearExcel(file: File): Promise<NextResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return await llamarClaude(`Factura (contenido del Excel en formato CSV):\n\n${csv.slice(0, 10000)}`);
}

// ── Llamadas a Claude ────────────────────────────────────────────────────────

async function llamarClaude(contenido: string): Promise<NextResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // El prompt de sistema se cachea: la segunda factura en adelante es ~90% más barata
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: contenido }],
  });

  const text = response.content.find((c) => c.type === 'text')?.text ?? '';
  return interpretarRespuesta(text);
}

async function llamarClaudeConPDF(base64: string): Promise<NextResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: 'Procesá esta factura y devolvé el JSON.' },
        ],
      },
    ],
  });

  const text = response.content.find((c) => c.type === 'text')?.text ?? '';
  return interpretarRespuesta(text);
}

// ── Parser de respuesta ──────────────────────────────────────────────────────

function normalizarNumerosJSON(json: string): string {
  return json.replace(/(\d{1,3}(?:\.\d{3})+)[,.](\d{1,2})(?=\s*[,\]\}\n])/g, (_, entero, decimal) => {
    return entero.replace(/\./g, '') + '.' + decimal;
  });
}

function interpretarRespuesta(text: string): NextResponse {
  const limpio = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  const parsear = (raw: string) => {
    try { return JSON.parse(raw) as FacturaExtraida; } catch { return null; }
  };

  const factura = parsear(limpio)
    ?? parsear(normalizarNumerosJSON(limpio))
    ?? (() => { const m = limpio.match(/\{[\s\S]*\}/); return m ? (parsear(m[0]) ?? parsear(normalizarNumerosJSON(m[0]))) : null; })();

  if (factura) return NextResponse.json({ factura });

  return NextResponse.json(
    { error: 'No se pudo interpretar la respuesta de la IA. Revisá el archivo.', raw: text.slice(0, 300) },
    { status: 422 }
  );
}
