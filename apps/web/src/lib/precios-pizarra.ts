export interface PreciosPizarra {
  fecha:   string | null;
  maiz:    number | null;
  sorgo:   number | null;
  soja:    number | null;
  trigo:   number | null;
  girasol: number | null;
}

const BCR_URL = 'https://www.bcr.com.ar/es/mercados/mercado-de-granos/cotizaciones/cotizaciones-locales-0';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parsea número en formato BCR: "$ 460.000,00"
 * Punto = miles, coma = decimal (convención argentina)
 */
function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const clean = s.trim();
  if (!clean || /^[-—$\s]+$/.test(clean)) return null;
  // Quitar símbolo $, espacios, quitar puntos de miles, cambiar coma decimal por punto
  const normalized = clean
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) || n === 0 ? null : n;
}

/** Normaliza texto para comparación sin tildes ni mayúsculas */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

// ── Parser BCR ────────────────────────────────────────────────────────────────

/**
 * Parsea la tabla de la página BCR cotizaciones-locales-0.
 *
 * Estructura esperada:
 *   Fila 0 (header): [vacío/título], DD/MM/YYYY, DD/MM/YYYY, ...
 *   Filas 1..N (datos): [nombre grano], precio1, precio2, ...
 *   Granos: Soja, Sorgo, Girasol, Trigo, Maíz
 *   Columnas de precio ordenadas de más reciente a más antiguo (izquierda → derecha)
 */
function parseBCR(html: string): PreciosPizarra | null {
  try {
    // Extraer todas las filas de la tabla
    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = trRx.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map(c => stripTags(c[1]));
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length < 2) return null;

    // Encontrar la fila de encabezados (contiene fechas DD/MM/YYYY)
    const DATE_RX = /\d{1,2}\/\d{1,2}\/\d{4}/;
    const headerIdx = rows.findIndex(r => r.some(c => DATE_RX.test(c)));
    if (headerIdx === -1) return null;

    // La fecha más reciente es la primera columna de fecha (después de la col. de nombre)
    const latestDate = rows[headerIdx].find(c => DATE_RX.test(c)) ?? null;

    // Para cada grano, tomar el primer precio no nulo (columna más reciente primero)
    const prices: Record<string, number | null> = {};
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;
      const grano = norm(row[0]);
      if (!grano) continue;
      // Buscar el primer precio válido entre las columnas de datos
      for (let j = 1; j < row.length; j++) {
        const val = parseNum(row[j]);
        if (val != null) { prices[grano] = val; break; }
      }
    }

    // Verificar que obtuvimos al menos algún precio
    const hasSomething = ['maiz', 'sorgo', 'soja'].some(g => prices[g] != null);
    if (!hasSomething) return null;

    return {
      fecha:   latestDate,
      maiz:    prices['maiz']    ?? null,
      sorgo:   prices['sorgo']   ?? null,
      soja:    prices['soja']    ?? null,
      trigo:   prices['trigo']   ?? null,
      girasol: prices['girasol'] ?? null,
    };
  } catch {
    return null;
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchPreciosPizarra(): Promise<PreciosPizarra | null> {
  try {
    const res = await fetch(BCR_URL, {
      next: { revalidate: 3600 },
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer':         'https://www.bcr.com.ar/',
      },
    });
    if (!res.ok) return null;
    return parseBCR(await res.text());
  } catch {
    return null;
  }
}
