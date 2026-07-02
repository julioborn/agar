import Image from 'next/image';
import Link from 'next/link';
import { Mail, MessageCircle, Trash2 } from 'lucide-react';

export const metadata = {
  title: 'Soporte — AGAR',
  description: 'Contacto y soporte para usuarios de AGAR, sistema de gestión agropecuaria.',
};

const CONTACTO = 'juliobornes10@gmail.com';

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-[#4ade80] uppercase tracking-wide">{titulo}</h2>
      <div className="text-sm text-zinc-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function SoportePage() {
  return (
    <main
      className="min-h-screen bg-zinc-950 px-6 py-12"
      style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top) + 1rem))' }}
    >
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image src="/agar-final.png" alt="AGAR" width={120} height={48} className="h-12 w-auto" priority />
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white text-center">Soporte</h1>
        <p className="text-sm text-zinc-400 text-center mt-2 mb-8">
          ¿Tenés alguna pregunta o problema con AGAR? Estamos para ayudarte.
        </p>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6">

          <Seccion titulo="Contacto">
            <p>Para consultas, problemas técnicos o cualquier duda sobre el sistema, escribinos directamente:</p>
            <a
              href={`mailto:${CONTACTO}`}
              className="inline-flex items-center gap-2 text-[#4ade80] hover:underline"
            >
              <Mail className="w-4 h-4" />
              {CONTACTO}
            </a>
          </Seccion>

          <Seccion titulo="Preguntas frecuentes">
            <div className="space-y-4">
              <div>
                <p className="font-medium text-white">¿Cómo obtengo una cuenta?</p>
                <p>Las cuentas son gestionadas directamente por el administrador de AGAR. Contactanos por email para solicitar acceso.</p>
              </div>
              <div>
                <p className="font-medium text-white">¿Olvidé mi contraseña, qué hago?</p>
                <p>En la pantalla de inicio de sesión podés usar la opción "Olvidé mi contraseña" para recibirla por email, o contactarnos.</p>
              </div>
              <div>
                <p className="font-medium text-white">¿La app funciona sin conexión a internet?</p>
                <p>AGAR requiere conexión a internet para funcionar, ya que los datos se sincronizan en la nube en tiempo real.</p>
              </div>
              <div>
                <p className="font-medium text-white">¿Cómo escaneo un código QR o de barras?</p>
                <p>Dentro de la sección de remitos o stock, buscá el ícono de cámara para activar el escáner. La app te pedirá permiso para acceder a la cámara la primera vez.</p>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Eliminación de cuenta">
            <p>
              Si querés eliminar tu cuenta y todos tus datos, podés hacerlo desde la siguiente página o contactarnos por email.
            </p>
            <Link
              href="/eliminar-cuenta"
              className="inline-flex items-center gap-2 text-[#4ade80] hover:underline"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar mi cuenta
            </Link>
          </Seccion>

          <Seccion titulo="Tiempo de respuesta">
            <p>Respondemos consultas en un plazo de 24 a 48 horas hábiles.</p>
          </Seccion>

        </div>
      </div>
    </main>
  );
}
