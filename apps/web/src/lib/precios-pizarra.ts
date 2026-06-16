export interface PreciosPizarra {
  fecha:   string | null;
  maiz:    number | null;
  sorgo:   number | null;
  soja:    number | null;
  trigo:   number | null;
  girasol: number | null;
  fuente:  'diario' | 'mensual';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const clean = s.trim();
  if (!clean || /^[-—\s]+$/.test(clean)) return null;
  // Formato AR: 257.954,89 → quito puntos, cambio coma por punto
  const normalized = clean.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) || n === 0 ? null : n;
}

function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
}

/**
 * Parser para bd_pizarras_cuadro.php
 * Estructura: filas = granos (Maíz, Sorgo, Soja…), columnas = bolsas (Rosario, BBlanca…)
 * Devuelve los precios de la columna Rosario para cada grano.
 */
function parseCuadro(html: string): Omit<PreciosPizarra, 'fuente'> | null {
  try {
    // Extraer todas las filas
    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = trRx.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map(c => stripTags(c[1]));
      if (cells.length > 1) rows.push(cells);
    }

    if (rows.length < 2) return null;

    // Extraer la fecha del HTML (texto "Precios de DD-MM-YYYY" o "Fijados DD-MM-YYYY")
    const fechaMatch = html.match(/(?:Precios de|Fijados)\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    const fecha = fechaMatch ? fechaMatch[1] : null;

    // Encontrar la fila de encabezados (la que tiene "Rosario")
    const headerIdx = rows.findIndex(r => r.some(c => norm(c).includes('rosario')));
    if (headerIdx === -1) return null;

    const header = rows[headerIdx];
    const iRosario = header.findIndex(h => norm(h).includes('rosario'));
    if (iRosario === -1) return null;

    // Construir mapa grano → precio Rosario
    const precios: Record<string, number | null> = {};
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const grano = norm(row[0] ?? '');
      const valor = parseNum(row[iRosario]);
      if (grano && valor != null) precios[grano] = valor;
    }

    return {
      fecha,
      maiz:    precios['maiz']    ?? null,
      sorgo:   precios['sorgo']   ?? null,
      soja:    precios['soja']    ?? null,
      trigo:   precios['trigo']   ?? null,
      girasol: precios['girasol'] ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Parser para bd_pizarras_promedio.php
 * Estructura: filas = fechas (promedios mensuales), columnas = Fecha,Trigo,Maíz,Sorgo,Soja,Girasol
 * Solo Rosario. Tomamos la primera fila de datos (más reciente).
 */
function parsePromedio(html: string): Omit<PreciosPizarra, 'fuente'> | null {
  try {
    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = trRx.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map(c => stripTags(c[1]));
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length < 2) return null;

    // Detectar índices por nombre de columna
    const header = rows[0];
    const iF  = header.findIndex(h => norm(h).includes('fecha'));
    const iM  = header.findIndex(h => norm(h).includes('maiz'));
    const iS  = header.findIndex(h => norm(h).includes('sorgo'));
    const iSj = header.findIndex(h => norm(h).includes('soja'));
    const iT  = header.findIndex(h => norm(h).includes('trigo'));
    const iG  = header.findIndex(h => norm(h).includes('girasol'));

    // Primera fila de datos = período más reciente
    const row = rows[1];
    const fecha = row[iF !== -1 ? iF : 0] ?? null;

    return {
      fecha,
      maiz:    parseNum(row[iM  !== -1 ? iM  : 2]),
      sorgo:   parseNum(row[iS  !== -1 ? iS  : 3]),
      soja:    parseNum(row[iSj !== -1 ? iSj : 4]),
      trigo:   parseNum(row[iT  !== -1 ? iT  : 1]),
      girasol: parseNum(row[iG  !== -1 ? iG  : 5]),
    };
  } catch {
    return null;
  }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Referer': 'https://consiagro.com.ar/mercados/',
};

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      headers: HEADERS,
    });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

export async function fetchPreciosPizarra(): Promise<PreciosPizarra | null> {
  // 1. Intentar cuadro diario (precio de hoy o último día hábil)
  const cuadroHtml = await tryFetch('https://www.consiagro.com.ar/files/bd_pizarras_cuadro.php');
  if (cuadroHtml) {
    const parsed = parseCuadro(cuadroHtml);
    const hasData = parsed && (parsed.maiz || parsed.sorgo || parsed.soja);
    if (hasData) return { ...parsed!, fuente: 'diario' };
  }

  // 2. Fallback: promedios mensuales (siempre disponible)
  const promedioHtml = await tryFetch('https://www.consiagro.com.ar/files/bd_pizarras_promedio.php');
  if (promedioHtml) {
    const parsed = parsePromedio(promedioHtml);
    const hasData = parsed && (parsed.maiz || parsed.sorgo || parsed.soja);
    if (hasData) return { ...parsed!, fuente: 'mensual' };
  }

  return null;
}
