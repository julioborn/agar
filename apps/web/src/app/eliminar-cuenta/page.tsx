import Image from 'next/image';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export const metadata = {
  title: 'Eliminar cuenta — agar',
  description: 'Cómo solicitar la eliminación de tu cuenta y datos asociados en agar.',
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

export default function EliminarCuentaPage() {
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

        <h1 className="text-2xl font-bold text-white text-center">Eliminar cuenta y datos</h1>
        <p className="text-xs text-zinc-500 text-center mt-1 mb-8">Última actualización: {ACTUALIZADO}</p>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6">

          <Seccion titulo="Cómo solicitar la eliminación">
            <p>
              Para solicitar la eliminación de tu cuenta y los datos personales asociados, escribinos
              desde el email con el que te registraste a{' '}
              <a href={`mailto:${CONTACTO}?subject=Eliminar%20cuenta`} className="text-[#4ade80] hover:underline">
                {CONTACTO}
              </a>{' '}
              indicando que querés eliminar tu cuenta. Vamos a procesar la solicitud y confirmarte por
              email cuando esté completa, dentro de un plazo máximo de 30 días.
            </p>
          </Seccion>

          <Seccion titulo="Qué se elimina">
            <p>
              Tu cuenta de acceso (email y credenciales) y tu vínculo con la empresa a la que pertenecías
              en agar. Una vez eliminada, no vas a poder volver a iniciar sesión con esa cuenta.
            </p>
          </Seccion>

          <Seccion titulo="Qué se conserva">
            <p>
              agar es un sistema usado por empresas, no por usuarios individuales de forma aislada: los
              datos operativos que ingresaste (campos, lotes, costos, producción, compras, etc.) pertenecen
              a la empresa y suelen ser compartidos con otros usuarios de la misma cuenta empresarial, por
              lo que no se eliminan junto con tu cuenta personal.
            </p>
            <p>
              Si además querés solicitar la baja completa de los datos de tu empresa, indicalo en el mismo
              email y lo coordinamos con quien sea el administrador de esa cuenta. También podemos conservar
              cierta información cuando exista una obligación legal o contable de hacerlo (por ejemplo,
              registros fiscales).
            </p>
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
