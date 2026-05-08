-- =============================================================================
-- AGROSISTEMA — Seed de plantillas predefinidas
-- Carga 109 productos y 83 tipos de labor en la empresa activa.
-- Ejecutar en Supabase → SQL Editor (una sola vez).
-- =============================================================================

DO $$
DECLARE
  eid UUID;
BEGIN
  SELECT id INTO eid FROM empresas LIMIT 1;

  -- ===========================================================================
  -- PRODUCTOS
  -- nombre = presentacion comercial | principio_activo = producto generico
  -- ===========================================================================

  INSERT INTO productos (empresa_id, nombre, categoria, unidad_base, principio_activo, stock_minimo) VALUES

  -- HERBICIDAS
  (eid, 'Glifosato 48% SL',              'agroquimico', 'L',       'Glifosato',                200),
  (eid, 'Glifosato 66.2% SL',            'agroquimico', 'L',       'Glifosato',                100),
  (eid, '2,4-D Amina 72% SL',            'agroquimico', 'L',       '2,4-D',                     50),
  (eid, '2,4-D Ester 100% EC',           'agroquimico', 'L',       '2,4-D',                     30),
  (eid, 'Atrazina 50% SC',               'agroquimico', 'L',       'Atrazina',                 100),
  (eid, 'Dicamba 57.7% SL',              'agroquimico', 'L',       'Dicamba',                   20),
  (eid, 'Cletodim 12% EC',               'agroquimico', 'L',       'Cletodim',                  20),
  (eid, 'Haloxifop-R 10.8% EC',          'agroquimico', 'L',       'Haloxifop-R metil',         10),
  (eid, 'Fluroxipir 20% EC',             'agroquimico', 'L',       'Fluroxipir',                10),
  (eid, 'Metsulfuron metil 60% WG',      'agroquimico', 'kg',      'Metsulfuron',                2),
  (eid, 'Imazetapir 10% SL',             'agroquimico', 'L',       'Imazetapir',                20),
  (eid, 'Imazamox 4% SL',               'agroquimico', 'L',       'Imazamox',                  10),
  (eid, 'Clorimuron etil 25% WG',        'agroquimico', 'kg',      'Clorimuron etil',            1),
  (eid, 'Flumioxazin 50% WG',            'agroquimico', 'kg',      'Flumioxazin',                2),
  (eid, 'S-Metolacloro 96% EC',          'agroquimico', 'L',       'S-Metolacloro',             20),
  (eid, 'Acetoclor 90% EC',              'agroquimico', 'L',       'Acetoclor',                 30),
  (eid, 'Pendimetalina 33% EC',          'agroquimico', 'L',       'Pendimetalina',             20),
  (eid, 'Paraquat 27.6% SL',             'agroquimico', 'L',       'Paraquat',                  20),
  (eid, 'Saflufenacil 70% WG',           'agroquimico', 'kg',      'Saflufenacil',               1),
  (eid, 'Florpirauxifeno 2.9% EC',       'agroquimico', 'L',       'Florpirauxifeno-bencilo',    5),

  -- FUNGICIDAS
  (eid, 'Azoxistrobina 25% SC',          'agroquimico', 'L',       'Azoxistrobina',             10),
  (eid, 'Trifloxistrobina 50% WG',       'agroquimico', 'kg',      'Trifloxistrobina',           2),
  (eid, 'Piraclostrobina 25% EC',        'agroquimico', 'L',       'Piraclostrobina',           10),
  (eid, 'Tebuconazol 43% SC',            'agroquimico', 'L',       'Tebuconazol',               10),
  (eid, 'Protioconazol 41.5% EC',        'agroquimico', 'L',       'Protioconazol',             10),
  (eid, 'Ciproconazol 10% EC',           'agroquimico', 'L',       'Ciproconazol',               5),
  (eid, 'Epoxiconazol 12.5% SC',         'agroquimico', 'L',       'Epoxiconazol',               5),
  (eid, 'Difenoconazol 25% EC',          'agroquimico', 'L',       'Difenoconazol',              5),
  (eid, 'Fluxapyroxad 10% SC',           'agroquimico', 'L',       'Fluxapyroxad',               5),
  (eid, 'Boscalid 50% WG',              'agroquimico', 'kg',      'Boscalid',                   1),
  (eid, 'Mancozeb 80% WP',              'agroquimico', 'kg',      'Mancozeb',                   5),
  (eid, 'Carbendazim 50% SC',            'agroquimico', 'L',       'Carbendazim',                5),
  (eid, 'Propiconazol 25% EC',           'agroquimico', 'L',       'Propiconazol',               5),
  (eid, 'Iprodiona 50% SC',              'agroquimico', 'L',       'Iprodiona',                  5),
  (eid, 'Benzovindiflupir 10% SC',       'agroquimico', 'L',       'Benzovindiflupir',           3),

  -- INSECTICIDAS
  (eid, 'Clorpirifos 48% EC',            'agroquimico', 'L',       'Clorpirifos',               20),
  (eid, 'Lambdacialotrina 10% EC',       'agroquimico', 'L',       'Lambdacialotrina',          10),
  (eid, 'Cipermetrina 25% EC',           'agroquimico', 'L',       'Cipermetrina',              10),
  (eid, 'Endosulfan 35% EC',             'agroquimico', 'L',       'Endosulfan',                10),
  (eid, 'Imidacloprid 35% SC',           'agroquimico', 'L',       'Imidacloprid',              10),
  (eid, 'Tiametoxam 25% WG',             'agroquimico', 'kg',      'Tiametoxam',                 1),
  (eid, 'Clorantraniliprol 20% SC',      'agroquimico', 'L',       'Clorantraniliprol',          5),
  (eid, 'Metamidofos 60% SL',            'agroquimico', 'L',       'Metamidofos',               10),
  (eid, 'Dimetoato 50% EC',              'agroquimico', 'L',       'Dimetoato',                 10),
  (eid, 'Bifentrina 10% EC',             'agroquimico', 'L',       'Bifentrina',                 5),
  (eid, 'Deltametrina 10% EC',           'agroquimico', 'L',       'Deltametrina',               5),
  (eid, 'Clorfenapir 24% SC',            'agroquimico', 'L',       'Clorfenapir',                3),
  (eid, 'Spinosad 48% SC',               'agroquimico', 'L',       'Spinosad',                   2),
  (eid, 'Emamectina benzoato 1.9% EC',   'agroquimico', 'L',       'Emamectina benzoato',        2),
  (eid, 'Flubendiamide 48% SC',          'agroquimico', 'L',       'Flubendiamide',              2),

  -- ACARICIDAS
  (eid, 'Abamectina 1.8% EC',            'agroquimico', 'L',       'Abamectina',                 5),
  (eid, 'Propargite 67.8% EC',           'agroquimico', 'L',       'Propargite',                 5),
  (eid, 'Hexitiazox 10% WP',             'agroquimico', 'kg',      'Hexitiazox',                 1),
  (eid, 'Clofentezin 50% SC',            'agroquimico', 'L',       'Clofentezin',                2),
  (eid, 'Spiromesifen 24% SC',           'agroquimico', 'L',       'Spiromesifen',               2),

  -- COADYUVANTES
  (eid, 'Aceite vegetal metilado',        'agroquimico', 'L',       'Metil ester aceite vegetal', 20),
  (eid, 'Siliconado + humectante',        'agroquimico', 'L',       'Silicona organomodificada',  10),
  (eid, 'Adherente-dispersante',          'agroquimico', 'L',       'Polioxietileno',             10),
  (eid, 'Sulfato de amonio granulado',    'agroquimico', 'kg',      'Sulfato de amonio AMS',      20),
  (eid, 'Urea granulada (coadyuvante)',   'agroquimico', 'kg',      'Urea (adjuvante)',            10),

  -- CURASEMILLAS (no biologicos)
  (eid, 'Imidacloprid 35% FS (CS)',       'agroquimico', 'L',       'Imidacloprid',               5),
  (eid, 'Tiram 42% + Carboxin 37.5% FS', 'agroquimico', 'L',       'Tiram + Carboxin',           5),
  (eid, 'Fludioxonil 2.5% FS',           'agroquimico', 'L',       'Fludioxonil',                3),
  (eid, 'Tiametoxam 35% FS (CS)',         'agroquimico', 'L',       'Tiametoxam',                 5),
  (eid, 'Metalaxil-M 32% FS',            'agroquimico', 'L',       'Metalaxil-M',                3),

  -- INOCULANTES BIOLOGICOS
  (eid, 'Rhizobium soja liquido',         'inoculante',  'L',       'Bradyrhizobium japonicum',   5),
  (eid, 'Rhizobium soja turba',           'inoculante',  'kg',      'Bradyrhizobium japonicum',   2),
  (eid, 'Azospirillum trigo/maiz',        'inoculante',  'L',       'Azospirillum brasilense',    5),
  (eid, 'Trichoderma harzianum',          'inoculante',  'L',       'Trichoderma harzianum',      3),
  (eid, 'Bacillus subtilis FS',           'inoculante',  'L',       'Bacillus subtilis',          3),
  (eid, 'Inoculante soja + Mo + Co',      'inoculante',  'L',       'Bradyrhizobium + micronutr', 5),

  -- FERTILIZANTES
  (eid, 'Urea granulada 46-0-0',          'fertilizante','kg',      'Urea',                    2000),
  (eid, 'UAN solucion 32% N',             'fertilizante','L',       'UAN',                     1000),
  (eid, 'Sulfato de amonio 21-0-0-24S',   'fertilizante','kg',      'Sulfato de amonio',       1000),
  (eid, 'DAP 18-46-0',                    'fertilizante','kg',      'Fosfato diamonico',       1000),
  (eid, 'MAP 11-52-0',                    'fertilizante','kg',      'Fosfato monoamonico',     1000),
  (eid, 'SFT 0-46-0',                     'fertilizante','kg',      'Superfosfato triple',     1000),
  (eid, 'NPK 15-15-15 granulado',         'fertilizante','kg',      'NPK solido',              1000),
  (eid, 'Azufre 90% microgranulado',      'fertilizante','kg',      'Azufre elemental',           0),
  (eid, 'Yeso agricola sulfato Ca',        'fertilizante','kg',      'Yeso agricola',           1000),
  (eid, 'Boro 10% soluble',               'fertilizante','kg',      'Boro',                       5),
  (eid, 'Zinc quelatado 14%',             'fertilizante','kg',      'Zinc EDTA',                  5),
  (eid, 'Manganeso quelatado 13%',        'fertilizante','kg',      'Manganeso EDTA',             3),
  (eid, 'NPK foliar + micronutrientes',   'fertilizante','L',       'Fertilizante foliar',        20),
  (eid, 'Urea + inhibidor NBPT',          'fertilizante','kg',      'Nitrogeno estabilizado',  1000),

  -- SEMILLAS
  (eid, 'Semilla soja RR1',               'semilla',     'kg',      'Glycine max',              500),
  (eid, 'Semilla soja RR2 Pro',           'semilla',     'kg',      'Glycine max',              500),
  (eid, 'Semilla soja IPRO',              'semilla',     'kg',      'Glycine max',              500),
  (eid, 'Semilla maiz RR TG',             'semilla',     'kg',      'Zea mays',                 200),
  (eid, 'Semilla maiz MGRR2 Pro',         'semilla',     'kg',      'Zea mays',                 200),
  (eid, 'Semilla girasol CL',             'semilla',     'kg',      'Helianthus annuus',        100),
  (eid, 'Semilla girasol IMI',            'semilla',     'kg',      'Helianthus annuus',        100),
  (eid, 'Semilla trigo pan',              'semilla',     'kg',      'Triticum aestivum',       1000),
  (eid, 'Semilla cebada cervecera',       'semilla',     'kg',      'Hordeum vulgare',         1000),
  (eid, 'Semilla sorgo granifero',        'semilla',     'kg',      'Sorghum bicolor',          200),
  (eid, 'Semilla maiz pisingallo',        'semilla',     'kg',      'Zea mays everta',          100),

  -- BIOESTIMULANTES / VARIOS
  (eid, 'Aminoacidos 40% foliar',         'otro',        'L',       'Hidrolizado proteico',      10),
  (eid, 'Algas marinas extracto',         'otro',        'L',       'Ascophyllum nodosum',       10),
  (eid, 'Humatos de potasio 12%',         'otro',        'L',       'Acidos humicos + fulvicos',  5),
  (eid, 'Fosfito de potasio 30%',         'otro',        'L',       'Fosfito K',                 10),
  (eid, 'Calcio boro foliar',             'otro',        'L',       'Ca+B quelato',               5),
  (eid, 'Potasio foliar 60%',             'otro',        'L',       'Sulfato de potasio SOP',     5),
  (eid, 'Hidrogel absorbente',            'otro',        'kg',      'Poliacrilamida',             5),
  (eid, 'Aceite mineral 96% EC',          'otro',        'L',       'Aceite mineral',            10),
  (eid, 'Fenoxaprop etil 7.5% EC',        'otro',        'L',       'Fenoxaprop etil',            5);

  -- ===========================================================================
  -- TIPOS DE LABOR
  -- nombre | descripcion = "Categoria . Epoca/etapa"
  -- ===========================================================================

  INSERT INTO tipos_labor (empresa_id, nombre, descripcion) VALUES

  -- LABOREO Y PREPARACION
  (eid, 'Subsolado profundo',                       'Laboreo . Pre-siembra'),
  (eid, 'Cincel rigido',                            'Laboreo . Pre-siembra'),
  (eid, 'Cincel vibratorio',                        'Laboreo . Pre-siembra'),
  (eid, 'Rastra de discos pesada',                  'Laboreo . Pre-siembra'),
  (eid, 'Rastra de discos liviana',                 'Laboreo . Pre-siembra / Post-cosecha'),
  (eid, 'Arado de vertedera',                       'Laboreo . Ocasional'),
  (eid, 'Vibrocultivador',                          'Laboreo . Pre-siembra'),
  (eid, 'Fresado o rotovator',                      'Laboreo . Ocasional'),
  (eid, 'Siembra directa (SD)',                     'Siembra . Primavera / Otono'),
  (eid, 'Siembra convencional',                     'Siembra . Primavera / Otono'),

  -- SIEMBRA
  (eid, 'Siembra de soja',                          'Siembra . Octubre / Diciembre'),
  (eid, 'Siembra de maiz temprano',                 'Siembra . Septiembre / Octubre'),
  (eid, 'Siembra de maiz tardio',                   'Siembra . Noviembre / Diciembre'),
  (eid, 'Siembra de girasol',                       'Siembra . Septiembre / Octubre'),
  (eid, 'Siembra de trigo',                         'Siembra . Mayo / Julio'),
  (eid, 'Siembra de cebada',                        'Siembra . Mayo / Junio'),
  (eid, 'Siembra de sorgo',                         'Siembra . Noviembre / Diciembre'),
  (eid, 'Siembra de maiz pisingallo',               'Siembra . Septiembre / Octubre'),
  (eid, 'Siembra de pastura',                       'Siembra . Primavera / Otono'),
  (eid, 'Resiembra (resiembra parcial)',             'Siembra . Segun falla de implantacion'),

  -- APLICACIONES (PULVERIZACION)
  (eid, 'Pulverizacion herbicida presiembre',       'Aplicacion . Pre-siembra'),
  (eid, 'Pulverizacion herbicida postemergencia',   'Aplicacion . Post-siembra'),
  (eid, 'Pulverizacion fungicida foliar',           'Aplicacion . Durante cultivo'),
  (eid, 'Pulverizacion insecticida foliar',         'Aplicacion . Durante cultivo'),
  (eid, 'Pulverizacion acaricida',                  'Aplicacion . Durante cultivo'),
  (eid, 'Aplicacion coadyuvante',                   'Aplicacion . Durante cultivo'),
  (eid, 'Pulverizacion dessecante',                 'Aplicacion . Pre-cosecha'),
  (eid, 'Aplicacion bioestimulante foliar',         'Aplicacion . Durante cultivo'),
  (eid, 'Curasemilla quimico',                      'Aplicacion . Pre-siembra'),
  (eid, 'Inoculacion de semilla',                   'Aplicacion . Pre-siembra'),

  -- FERTILIZACION
  (eid, 'Fertilizacion base al voleo',              'Fertilizacion . Pre-siembra o siembra'),
  (eid, 'Fertilizacion base en banda',              'Fertilizacion . A la siembra'),
  (eid, 'Fertilizacion nitrogenada voleo solida',   'Fertilizacion . Macollaje / V3-V6'),
  (eid, 'Fertilizacion nitrogenada liquida UAN',    'Fertilizacion . Macollaje / V3-V6'),
  (eid, 'Fertirrigacion (si aplica)',               'Fertilizacion . Segun cultivo y riego'),
  (eid, 'Aplicacion yeso agricola',                 'Fertilizacion . Pre-siembra o en cultivo'),
  (eid, 'Fertilizacion foliar micronutrientes',     'Fertilizacion . Durante cultivo'),

  -- COSECHA
  (eid, 'Cosecha de soja',                          'Cosecha . Marzo / Abril'),
  (eid, 'Cosecha de maiz',                          'Cosecha . Marzo / Abril'),
  (eid, 'Cosecha de girasol',                       'Cosecha . Febrero / Marzo'),
  (eid, 'Cosecha de trigo',                         'Cosecha . Noviembre / Diciembre'),
  (eid, 'Cosecha de cebada',                        'Cosecha . Noviembre'),
  (eid, 'Cosecha de sorgo',                         'Cosecha . Marzo / Abril'),
  (eid, 'Cosecha de maiz pisingallo',               'Cosecha . Febrero / Marzo'),
  (eid, 'Swatheo o hilerado',                       'Cosecha . Pre-cosecha girasol/canola'),
  (eid, 'Picado de rastrojos',                      'Post-cosecha . Segun cultivo'),
  (eid, 'Rolado de rastrojos',                      'Post-cosecha . Segun cultivo'),

  -- ACONDICIONAMIENTO Y ALMACENAJE
  (eid, 'Secado artificial de granos',              'Pos-cosecha . Segun humedad'),
  (eid, 'Secado natural / aireacion',               'Pos-cosecha . Segun humedad'),
  (eid, 'Ensacado de granos',                       'Pos-cosecha . Segun logistica'),
  (eid, 'Embolsado de granos (silo bolsa)',         'Pos-cosecha . Inmediatamente post-cosecha'),
  (eid, 'Extraccion silo bolsa',                    'Pos-cosecha . Segun comercializacion'),
  (eid, 'Limpieza y clasificacion de granos',       'Pos-cosecha . Segun calidad'),
  (eid, 'Acopio en bin o silo chacra',              'Pos-cosecha . Segun infraestructura'),
  (eid, 'Carga y descarga camion',                  'Logistica . Segun movimiento'),

  -- SUELO Y MEJORAMIENTO
  (eid, 'Analisis de suelo quimico',                'Suelo . Pre-campana'),
  (eid, 'Analisis de suelo fisico',                 'Suelo . Pre-campana'),
  (eid, 'Calicata / muestreo perfil',               'Suelo . Pre-campana'),
  (eid, 'Aplicacion correctivos acidos',            'Suelo . Pre-campana'),
  (eid, 'Terraplenado / sistematizacion',           'Suelo . Pre-campana'),
  (eid, 'Zanjeado o drenaje',                       'Suelo . Pre-campana'),
  (eid, 'Descompactacion profunda',                 'Suelo . Pre-campana'),
  (eid, 'Nivelacion topografica',                   'Suelo . Segun necesidad'),

  -- RIEGO
  (eid, 'Riego por aspersion pivote central',       'Riego . Segun demanda hidrica'),
  (eid, 'Riego por goteo',                          'Riego . Segun demanda hidrica'),
  (eid, 'Riego gravitacional por canales',          'Riego . Segun demanda hidrica'),
  (eid, 'Mantenimiento sistema de riego',           'Riego . Pre-campana'),

  -- PASTURAS Y GANADERIA
  (eid, 'Siembra de pasturas perennes',             'Pasturas . Primavera / Otono'),
  (eid, 'Fertilizacion de pasturas',                'Pasturas . Segun estado y especie'),
  (eid, 'Pastoreo diferido / stock en pie',         'Pasturas . Otono'),
  (eid, 'Confeccion de reservas forrajeras',        'Pasturas . Primavera / Otono'),

  -- TRANSPORTE Y LOGISTICA
  (eid, 'Flete corto campo-acopio (camion)',        'Transporte . Post-cosecha'),
  (eid, 'Flete con acoplado propio',                'Transporte . Post-cosecha / durante campana'),
  (eid, 'Flete largo a puerto',                     'Transporte . Segun mercado'),
  (eid, 'Transporte de insumos a campo',            'Transporte . Previo a campana'),
  (eid, 'Traslado de maquinaria',                   'Transporte . Cambios de lotes'),

  -- MONITOREO Y APOYO
  (eid, 'Monitoreo de cultivos y plagas',           'Monitoreo . Todo el ciclo'),
  (eid, 'Muestreo y analisis de suelo',             'Monitoreo . Pre-campana'),
  (eid, 'Monitoreo con drones (NDVI)',              'Monitoreo . Todo el ciclo'),
  (eid, 'Calibracion de sembradora',               'Planificacion . Pre-siembra'),
  (eid, 'Calibracion de pulverizadora',            'Planificacion . Pre-aplicacion'),
  (eid, 'Registro y gestion de lotes',             'Planificacion . Todo el ciclo'),
  (eid, 'Mantenimiento de maquinaria',              'Mantenimiento . Entrezafra'),
  (eid, 'Mantenimiento de infraestructura rural',   'Mantenimiento . Entrezafra');

  RAISE NOTICE 'Seed completado: 109 productos y 83 tipos de labor cargados para empresa %', eid;

END $$;
