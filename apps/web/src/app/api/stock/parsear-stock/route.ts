import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface StockItemExtraido {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario_neto: number | null;
}

export interface StockExtraido {
  proveedor_nombre: string | null;
  numero_factura: string | null;
  items: StockItemExtraido[];
}

const SYSTEM_PROMPT = `Sos un asistente especializado en análisis de facturas, remitos e inventarios de insumos agropecuarios argentinos.
Cuando recibas un documento, extraé la información y devolvé ÚNICAMENTE un JSON con esta estructura exacta, sin texto adicional ni markdown:

{
  "proveedor_nombre": "nombre del EMISOR/VENDEDOR, o null si no se puede determinar",
  "numero_factura": "número de factura o remito tal como aparece (ej: 0001-00012345), o null si no hay",
  "items": [
    {
      "descripcion": "nombre o descripción del producto tal como aparece",
      "cantidad": número mayor a 0,
      "unidad": "L" o "kg" o "tn" o "unidad" o "sobre" o "bolsa" u otra,
      "precio_unitario_neto": número sin IVA o null si no hay precio
    }
  ]
}

REGLA CRÍTICA — proveedor_nombre:
El campo "proveedor_nombre" es el nombre de la empresa que EMITIÓ/VENDIÓ (el proveedor, el que cobra).
NO es la empresa que recibe o compra los productos.
En una factura argentina:
- El EMISOR/VENDEDOR aparece en el ENCABEZADO superior: membrete, logo, razón social, CUIT del vendedor.
  Suele estar en la parte de arriba de la página, a veces como imagen/logo.
- El RECEPTOR/COMPRADOR aparece más abajo con etiquetas como "Señor:", "Sr./Sra.:", "Cliente:", "A:", "Razón social del comprador:", "CUIT del comprador:".
Buscá el nombre en el MEMBRETE SUPERIOR (incluso si es una imagen o logo). Si no podés leerlo, devolvé null.
NUNCA uses el nombre que aparece bajo "Señor:", "Cliente:" o "Comprador:" — ese es el receptor, no el proveedor.

Reglas adicionales:
1. Solo incluí productos con cantidad mayor a cero
2. Si el mismo producto aparece en múltiples filas, consolidá sumando cantidades
3. Unidades: L (litros), kg, tn, unidad, sobre, bolsa — inferir del contexto si no está claro
4. Precios NETOS sin IVA. Si no hay precios, null en precio_unitario_neto`;

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
    console.error('[parsear-stock]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function parsearPDF(file: File): Promise<NextResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Siempre enviamos el PDF completo como documento visual.
  // Así Claude puede leer tanto el texto como logos, membrete o nombres
  // que aparecen en imágenes dentro de la factura.
  const base64 = buffer.toString('base64');
  return await llamarClaudeConPDF(base64);
}

async function parsearExcel(file: File): Promise<NextResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El archivo no tiene datos.' }, { status: 400 });
  }

  const headers = Object.keys(rows[0]).map((h) => ({ original: h, lower: h.toLowerCase().trim() }));

  const PROD_PATTERNS = ['descripcion', 'descripción', 'desc', 'nombre', 'producto', 'product', 'name', 'item', 'articulo', 'artículo', 'denominacion', 'denominación'];
  const CANT_PATTERNS = ['stock', 'cantidad', 'cant', 'qty', 'quantity', 'litro', 'kg', 'tonelada', 'kilo', 'amount', 'existencia', 'saldo'];
  const UNIT_PATTERNS = ['unidad', 'unit', 'um', 'u.m.', 'medida'];

  const prodHeader = headers.find((h) => PROD_PATTERNS.some((p) => h.lower.includes(p)));
  const cantHeader = headers.find((h) => CANT_PATTERNS.some((p) => h.lower.includes(p)));
  const unitHeader = headers.find((h) => UNIT_PATTERNS.some((p) => h.lower.includes(p)));

  if (prodHeader && cantHeader) {
    const items: StockItemExtraido[] = rows
      .map((row) => {
        let unidad = 'unidad';
        if (unitHeader) {
          unidad = String(row[unitHeader.original] ?? 'unidad').trim() || 'unidad';
        } else {
          const c = cantHeader.lower;
          if (c.includes('litro') || c === 'l') unidad = 'L';
          else if (c.includes('kg') || c.includes('kilo')) unidad = 'kg';
          else if (c.includes('tn') || c.includes('tonelada')) unidad = 'tn';
        }
        return {
          descripcion: String(row[prodHeader.original] ?? '').trim(),
          cantidad: parseFloat(String(row[cantHeader.original] ?? '0').replace(',', '.')) || 0,
          unidad,
          precio_unitario_neto: null,
        };
      })
      .filter((item) => item.descripcion && item.cantidad > 0);

    if (items.length > 0) {
      return NextResponse.json({ stock: { proveedor_nombre: null, numero_factura: null, items } });
    }
  }

  // Fallback: enviar a Claude si no se detectaron columnas
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return await llamarClaude(`Inventario (contenido del archivo en CSV):\n\n${csv.slice(0, 10000)}`);
}

async function llamarClaude(contenido: string): Promise<NextResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: contenido }],
  });

  const text = response.content.find((c) => c.type === 'text')?.text ?? '';
  return interpretarRespuesta(text);
}

async function llamarClaudeConPDF(base64: string): Promise<NextResponse> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: 'Procesá este inventario y devolvé el JSON.' },
      ],
    }],
  });

  const text = response.content.find((c) => c.type === 'text')?.text ?? '';
  return interpretarRespuesta(text);
}

function interpretarRespuesta(text: string): NextResponse {
  const limpio = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  const parsear = (raw: string): StockExtraido | null => {
    try {
      const parsed = JSON.parse(raw);
      // Backward compat: si solo tiene items (formato viejo), wrappear
      if (Array.isArray(parsed.items)) {
        return {
          proveedor_nombre: parsed.proveedor_nombre ?? null,
          numero_factura: parsed.numero_factura ?? null,
          items: parsed.items.map((i: any) => ({
            descripcion: i.descripcion ?? '',
            cantidad: Number(i.cantidad) || 0,
            unidad: i.unidad ?? 'unidad',
            precio_unitario_neto: i.precio_unitario_neto ?? null,
          })),
        };
      }
      return null;
    } catch { return null; }
  };

  const stock = parsear(limpio) ?? (() => {
    const match = limpio.match(/\{[\s\S]*\}/);
    return match ? parsear(match[0]) : null;
  })();

  if (stock) return NextResponse.json({ stock });

  // Detectar si fue corte por límite de tokens
  const truncado = text.length > 10 && !text.trim().endsWith('}');
  console.error('[parsear-stock] Respuesta no parseable (truncada:', truncado, '):', text.slice(0, 300));
  return NextResponse.json(
    { error: truncado
        ? 'La factura tiene demasiados ítems y la respuesta quedó incompleta. Intentá con un archivo más corto o dividido en partes.'
        : 'No se pudo interpretar la respuesta de la IA. Revisá que el archivo sea una factura o inventario de productos.' },
    { status: 422 }
  );
}
