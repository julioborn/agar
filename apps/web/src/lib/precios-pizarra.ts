export interface PreciosPizarra {
  fecha:   string | null;
  maiz:    number | null;
  sorgo:   number | null;
  soja:    number | null;
  trigo:   number | null;
  girasol: number | null;
  fuente:  'diario' | 'mensual' | 'datatable';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Número en formato AR: 257.954,89 → 257954.89 */
function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const c = s.trim();
  if (!c || /^[-—\s]+$/.test(c)) return null;
  const n = parseFloat(c.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return isNaN(n) || n === 0 ? null : n;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection':      'keep-alive',
  'Referer':         'https://consiagro.com.ar/mercados/',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'same-origin',
};

// ── Parsers ───────────────────────────────────────────────────────────────────

/** bd_pizarras_promedio.php → filas=meses, cols=Fecha,Trigo,Maíz,Sorgo,Soja,Girasol */
function parsePromedio(html: string): Omit<PreciosPizarra, 'fuente'> | null {
  try {
    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = trRx.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => stripTags(c[1]));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length < 2) return null;

    const hdr = rows[0];
    const iF  = hdr.findIndex(h => norm(h).includes('fecha'));
    const iM  = hdr.findIndex(h => norm(h).includes('maiz'));
    const iS  = hdr.findIndex(h => norm(h).includes('sorgo'));
    const iSj = hdr.findIndex(h => norm(h).includes('soja'));
    const iT  = hdr.findIndex(h => norm(h).includes('trigo'));
    const iG  = hdr.findIndex(h => norm(h).includes('girasol'));

    // Primera fila de datos = mes más reciente
    const row = rows[1];
    return {
      fecha:   row[iF  !== -1 ? iF  : 0] ?? null,
      maiz:    parseNum(row[iM  !== -1 ? iM  : 2]),
      sorgo:   parseNum(row[iS  !== -1 ? iS  : 3]),
      soja:    parseNum(row[iSj !== -1 ? iSj : 4]),
      trigo:   parseNum(row[iT  !== -1 ? iT  : 1]),
      girasol: parseNum(row[iG  !== -1 ? iG  : 5]),
    };
  } catch { return null; }
}

/** bd_pizarras_cuadro.php → filas=granos, cols=Grano,Rosario,BBlanca,Necochea,Dársena */
function parseCuadro(html: string): Omit<PreciosPizarra, 'fuente'> | null {
  try {
    const fechaMatch = html.match(/(?:Precios de|Fijados|Fecha)\s*:?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    const fecha = fechaMatch ? fechaMatch[1] : null;

    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = trRx.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => stripTags(c[1]));
      if (cells.length > 1) rows.push(cells);
    }
    if (rows.length < 2) return null;

    const hdrIdx = rows.findIndex(r => r.some(c => norm(c).includes('rosario')));
    if (hdrIdx === -1) return null;
    const iRosario = rows[hdrIdx].findIndex(h => norm(h).includes('rosario'));

    const precios: Record<string, number | null> = {};
    for (let i = hdrIdx + 1; i < rows.length; i++) {
      const grano = norm(rows[i][0] ?? '');
      const val   = parseNum(rows[i][iRosario]);
      if (grano && val != null) precios[grano] = val;
    }

    return { fecha, maiz: precios['maiz'] ?? null, sorgo: precios['sorgo'] ?? null,
             soja: precios['soja'] ?? null, trigo: precios['trigo'] ?? null, girasol: precios['girasol'] ?? null };
  } catch { return null; }
}

/** Respuesta JSON de DataTables: [[fecha,trigo,maiz,sorgo,soja,girasol], ...] */
function parseDataTable(json: any): Omit<PreciosPizarra, 'fuente'> | null {
  try {
    const rows: string[][] = json?.data ?? [];
    if (!rows.length) return null;
    // Buscar la primera fila con al menos un precio no vacío en maíz/sorgo/soja
    const row = rows.find(r => parseNum(r[2]) || parseNum(r[3]) || parseNum(r[4]));
    if (!row) return null;
    return {
      fecha: row[0] ?? null,
      trigo: parseNum(row[1]), maiz: parseNum(row[2]),
      sorgo: parseNum(row[3]), soja: parseNum(row[4]), girasol: parseNum(row[5]),
    };
  } catch { return null; }
}

// ── Fetch strategies ──────────────────────────────────────────────────────────

async function fetchHtml(url: string, extraHeaders?: Record<string, string>): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { ...BROWSER_HEADERS, ...extraHeaders },
    });
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

async function fetchHtmlViaProxy(url: string): Promise<string | null> {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

async function fetchDataTableJson(): Promise<any | null> {
  const body = new URLSearchParams({
    draw: '1', start: '0', length: '5',
    'order[0][column]': '0', 'order[0][dir]': 'desc',
    'search[value]': '', 'search[regex]': 'false',
  });
  try {
    const res = await fetch('https://www.consiagro.com.ar/files/bd_pizarras_historico.php', {
      method: 'POST',
      cache: 'no-store',
      headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body: body.toString(),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch { return null; }
}

// ── Exportado ─────────────────────────────────────────────────────────────────

export async function fetchPreciosPizarra(): Promise<PreciosPizarra | null> {
  const tryParse = (p: Omit<PreciosPizarra, 'fuente'> | null) =>
    p && (p.maiz || p.sorgo || p.soja) ? p : null;

  // 1. DataTables POST → JSON del histórico
  const dtJson = await fetchDataTableJson();
  if (dtJson) {
    const p = tryParse(parseDataTable(dtJson));
    if (p) return { ...p, fuente: 'datatable' };
  }

  // 2. Cuadro directo (precio del día)
  const cuadroHtml = await fetchHtml('https://www.consiagro.com.ar/files/bd_pizarras_cuadro.php');
  if (cuadroHtml) {
    const p = tryParse(parseCuadro(cuadroHtml));
    if (p) return { ...p, fuente: 'diario' };
  }

  // 3. Promedio directo (mensual)
  const promedioHtml = await fetchHtml('https://www.consiagro.com.ar/files/bd_pizarras_promedio.php');
  if (promedioHtml) {
    const p = tryParse(parsePromedio(promedioHtml));
    if (p) return { ...p, fuente: 'mensual' };
  }

  // 4. Promedio vía proxy allorigins.win
  const promedioProxy = await fetchHtmlViaProxy('https://www.consiagro.com.ar/files/bd_pizarras_promedio.php');
  if (promedioProxy) {
    const p = tryParse(parsePromedio(promedioProxy));
    if (p) return { ...p, fuente: 'mensual' };
  }

  return null;
}
