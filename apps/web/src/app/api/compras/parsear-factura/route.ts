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
const SYSTEM_PROMPT = `Sos un asistente especializado en análisis de facturas de insumos agropecuarios argentinas.
Cuando recibas el contenido de una factura, extraé la información y devolvé ÚNICAMENTE un JSON con esta estructura exacta, sin texto adicional ni markdown:

{
  "proveedor_nombre": "nombre del proveedor/emisor",
  "proveedor_cuit": "CUIT sin guiones ni espacios, o null",
  "fecha": "YYYY-MM-DD",
  "numero_factura": "número como aparece en la factura",
  "moneda": "ARS" o "USD",
  "cotizacion_usd": número o null,
  "subtotal_neto": número sin IVA en la moneda de la factura,
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

Reglas estrictas:
1. Si el mismo artículo (mismo código o misma descripción) aparece en múltiples líneas, CONSOLIDÁ sumando cantidades y subtotales
2. Todos los importes deben ser NETOS, sin IVA ni percepciones
3. Si la factura está en pesos pero indica cotización del dólar, guardá la cotización en "cotizacion_usd"
4. Si la factura está en USD, "moneda" = "USD" y los importes van en USD
5. "subtotal_neto" de la cabecera = suma de todos los subtotales netos de los ítems`;

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

// ── PDF: extrae texto primero (gratis), solo usa visión si es PDF escaneado ──

async function parsearPDF(file: File): Promise<NextResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Paso 1: extraer texto con pdf-parse (gratis, corre en el servidor)
  let textoExtraido = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    textoExtraido = data.text?.trim() ?? '';
  } catch {
    // Si pdf-parse falla (PDF protegido, raro), textoExtraido queda vacío
  }

  // Paso 2: si hay texto suficiente, mandar solo texto a Claude (70-80% más barato)
  if (textoExtraido.length > 150) {
    return await llamarClaude(`Factura (texto extraído del PDF):\n\n${textoExtraido}`);
  }

  // Paso 3: fallback a visión para PDFs escaneados (imagen, sin texto embebido)
  console.log('[parsear-factura] PDF sin texto embebido, usando visión');
  const base64 = buffer.toString('base64');
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
    max_tokens: 1024,
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
    max_tokens: 1024,
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

function interpretarRespuesta(text: string): NextResponse {
  const limpio = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    const factura: FacturaExtraida = JSON.parse(limpio);
    return NextResponse.json({ factura });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo interpretar la respuesta de la IA. Revisá el archivo.', raw: text },
      { status: 422 }
    );
  }
}
