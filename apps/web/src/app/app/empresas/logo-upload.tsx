'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props {
  empresaId: string;
  logoUrl?: string | null;
}

export default function LogoUpload({ empresaId, logoUrl }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl ?? null);
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setLoading(true);

    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${empresaId}-${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('empresa-logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setPreview(logoUrl ?? null);
      setLoading(false);
      return;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('empresa-logos')
      .getPublicUrl(uploadData.path);

    await supabase
      .from('empresas')
      .update({ logo_url: publicUrl })
      .eq('id', empresaId);

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        title="Cambiar logo"
        className="group w-12 h-8 rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden hover:border-[#006836]/40 transition-colors disabled:opacity-50"
      >
        {preview ? (
          <Image src={preview} alt="logo" width={48} height={32} className="h-7 w-auto object-contain" />
        ) : (
          <ImagePlus className="w-4 h-4 text-zinc-300 group-hover:text-[#006836] transition-colors" />
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
