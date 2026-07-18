import Image from 'next/image';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export const metadata = {
  title: 'Política de Privacidad — agar',
  description: 'Política de privacidad de agar, sistema de gestión agropecuaria.',
};

const CONTACTO = 'juliobornes10@gmail.com';
const ACTUALIZADO = '23 de junio de 2026';

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-[#4ade80] uppercase tracking-wide">{titulo}</h2>
      <div className="text-sm text-zinc-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <main
      className="min-h-screen bg-zinc-950 px-6 py-12"
      style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}
    >
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image src="/agar-final.png" alt="agar" width={120} height={48} className="h-12 w-auto" priority />
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white text-center">Política de Privacidad</h1>
        <p className="text-xs text-zinc-500 text-center mt-1 mb-8">Última actualización: {ACTUALIZADO}</p>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6">

          <Seccion titulo="¿Qué es agar?">
            <p>
              agar es un sistema de gestión agropecuaria que permite a empresas del sector
              administrar campos, lotes, cultivos, maquinaria, insumos, costos y producción.
              Es una aplicación multiempresa: cada empresa accede únicamente a sus propios datos.
            </p>
          </Seccion>

          <Seccion titulo="Datos que recolectamos">
            <p><strong className="text-white">Cuenta de usuario:</strong> email y contraseña (gestionados de forma segura por nuestro proveedor de autenticación, Supabase), nombre y rol dentro de la empresa.</p>
            <p><strong className="text-white">Datos operativos:</strong> la información que cada empresa ingresa para usar el sistema — campos y lotes (incluyendo su ubicación geográfica), cultivos, campañas, maquinaria, proveedores, compras, stock, costos, producción, remitos y referencias de precio.</p>
            <p><strong className="text-white">Documentos e imágenes:</strong> facturas u otros archivos que el usuario decida subir al sistema.</p>
            <p><strong className="text-white">Cámara:</strong> se usa exclusivamente para escanear códigos QR o de barras dentro de la app (por ejemplo, en remitos o stock). No accedemos a la galería de fotos ni almacenamos imágenes del escaneo.</p>
            <p><strong className="text-white">Cookies de sesión:</strong> usadas únicamente para mantener la sesión iniciada. No utilizamos cookies de publicidad ni de seguimiento de terceros.</p>
          </Seccion>

          <Seccion titulo="Para qué usamos estos datos">
            <p>
              Exclusivamente para brindar el servicio: autenticar usuarios, mostrar y procesar
              la información que cada empresa ingresa, y generar reportes, costos y estadísticas
              dentro de su propia cuenta. No usamos los datos para publicidad ni los vendemos a terceros.
            </p>
          </Seccion>

          <Seccion titulo="Con quién compartimos datos">
            <p>Usamos los siguientes proveedores para operar agar, que procesan datos en nuestro nombre:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="text-white">Supabase</strong> — base de datos, autenticación y almacenamiento de archivos.</li>
              <li><strong className="text-white">Vercel</strong> — hosting de la aplicación web.</li>
              <li><strong className="text-white">Anthropic (Claude API)</strong> — funciones de asistente y lectura automática de facturas, solo cuando el usuario las utiliza.</li>
            </ul>
            <p>
              También consultamos cotizaciones públicas (dólar oficial, precios de granos en la Bolsa
              de Comercio de Rosario) para mostrar referencias de precio; estas consultas no envían
              datos personales a esos sitios.
            </p>
          </Seccion>

          <Seccion titulo="Seguridad">
            <p>
              La base de datos aplica seguridad a nivel de fila (Row Level Security): cada empresa
              solo puede acceder a su propia información, nunca a la de otras empresas usuarias del sistema.
            </p>
          </Seccion>

          <Seccion titulo="Tus derechos">
            <p>
              Podés solicitar acceso, corrección o eliminación de tus datos y los de tu empresa
              en cualquier momento escribiéndonos. Al eliminar una cuenta, se elimina también la
              información asociada.
            </p>
          </Seccion>

          <Seccion titulo="Menores de edad">
            <p>agar no está dirigido a menores de 18 años y no recolectamos intencionalmente datos de menores.</p>
          </Seccion>

          <Seccion titulo="Cambios a esta política">
            <p>Si actualizamos esta política, lo reflejaremos en la fecha de esta misma página.</p>
          </Seccion>

          <Seccion titulo="Contacto">
            <a
              href={`mailto:${CONTACTO}`}
              className="inline-flex items-center gap-2 text-[#4ade80] hover:underline"
            >
              <Mail className="w-4 h-4" />
              {CONTACTO}
            </a>
          </Seccion>

        </div>
      </div>
    </main>
  );
}
