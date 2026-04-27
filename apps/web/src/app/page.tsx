import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="max-w-md text-center">
        <Image src="/agar6.png" alt="agar" width={220} height={220} className="mx-auto" priority />
        <div className="flex justify-center">
          <Link href="/login" className="px-6 py-3 bg-[#006836] text-white rounded-lg font-medium hover:bg-green-700">
            Ingresar
          </Link>
        </div>
      </div>
    </main>
  );
}
