export interface PreciosPizarra {
  fecha:   string | null;
  maiz:    number | null;
  sorgo:   number | null;
  soja:    number | null;
  trigo:   number | null;
  girasol: number | null;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const clean = s.trim().replace(/[^\d,.-]/g, '');
  if (!clean || /^[-]+$/.test(clean)) return null;
  // Formato AR: punto = miles, coma = decimal  (ej: 80.000 o 80.000,50)
  const n = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

export function parsePizarraHTML(html: string): PreciosPizarra | null {
  try {
    // Aislar sección Rosario (tab-1)
    let section = html;
    const startIdx = html.search(/id\s*=\s*["']tab-1["']/i);
    const endIdx   = html.search(/id\s*=\s*["']tab-2["']/i);
    if (startIdx !== -1) {
      section = html.slice(startIdx, endIdx !== -1 ? endIdx : undefined);
    }

    // Extraer todas las filas con celdas
    const trRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let m: RegExpExecArray | null;
    while ((m = trRx.exec(section)) !== null) {
      const cells = [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map(c => stripTags(c[1]));
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length < 2) return null;

    // Detectar índices por encabezado
    const header = rows[0];
    const iF  = header.findIndex(h => norm(h).includes('fecha'));
    const iM  = header.findIndex(h => norm(h).includes('maiz'));
    const iS  = header.findIndex(h => norm(h).includes('sorgo'));
    const iSj = header.findIndex(h => norm(h).includes('soja'));
    const iT  = header.findIndex(h => norm(h).includes('trigo'));
    const iG  = header.findIndex(h => norm(h).includes('girasol'));

    // Primera fila de datos = precio más reciente
    const row = rows[1];

    return {
      fecha:   row[iF  !== -1 ? iF  : 0] ?? null,
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

const CONSIAGRO_URL = 'https://www.consiagro.com.ar/files/bd_pizarras_historico.php';

export async function fetchPreciosPizarra(): Promise<PreciosPizarra | null> {
  try {
    const res = await fetch(CONSIAGRO_URL, {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AgroSistema/1.0)' },
    });
    if (!res.ok) return null;
    return parsePizarraHTML(await res.text());
  } catch {
    return null;
  }
}
