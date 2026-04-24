'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ImagePlus, X } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const field = 'w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006836]/40 disabled:opacity-50';

export default function CrearEmpresaForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nombre,     setNombre]     = useState('');
  const [cuit,       setCuit]       = useState('');
  const [moneda,     setMoneda]     = useState('ARS');
  const [logoFile,   setLogoFile]   = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [exito,      setExito]      = useState(false);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function quitarLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !cuit.trim()) return;
    setLoading(true); setError(null);

    const supabase = createClient();
    let logo_url: string | undefined;

    if (logoFile) {
      const ext = logoFile.name.split('.').pop() ?? 'png';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('empresa-logos')
        .upload(path, logoFile, { upsert: true });

      if (uploadError) {
        setError('Error al subir el logo: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: { publicUrl } } = supabase
        .storage
        .from('empresa-logos')
        .getPublicUrl(uploadData.path);

      logo_url = publicUrl;
    }

    const { error: insertError } = await supabase
      .from('empresas')
      .insert({ nombre: nombre.trim(), cuit: cuit.trim(), moneda_base: moneda, logo_url });

    setLoading(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'Ya existe una empresa con ese CUIT.' : insertError.message);
      return;
    }

    setExito(true);
    setNombre(''); setCuit(''); setMoneda('ARS'); quitarLogo();
    setTimeout(() => { setExito(false); router.refresh(); }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nombre</label>
        <input type="text" placeholder="Canciani SA" value={nombre}
          onChange={(e) => setNombre(e.target.value)} required disabled={loading} className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">CUIT</label>
        <input type="text" placeholder="30-12345678-9" value={cuit}
          onChange={(e) => setCuit(e.target.value)} required disabled={loading} className={field} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Moneda base</label>
        <select value={moneda} onChange={(e) => setMoneda(e.target.value)} disabled={loading} className={field}>
          <option value="ARS">ARS — Pesos argentinos</option>
          <option value="USD">USD — Dólares</option>
        </select>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">Logo</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleLogoChange}
          disabled={loading}
          className="hidden"
        />
        {logoPreview ? (
          <div className="flex items-center gap-3">
            <div className="w-24 h-14 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden">
              <Image src={logoPreview} alt="preview" width={96} height={56} className="h-12 w-auto object-contain" />
            </div>
            <button
              type="button"
              onClick={quitarLogo}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Quitar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-300 rounded-lg text-sm text-zinc-500 hover:border-[#006836]/50 hover:text-[#006836] transition-colors disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4" />
            Subir logo
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {exito && (
        <p className="text-xs text-[#006836] flex items-center gap-1">
          <Check className="w-3.5 h-3.5" /> Empresa creada correctamente.
        </p>
      )}
      <button type="submit" disabled={loading || !nombre.trim() || !cuit.trim()}
        className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006836] text-white text-sm font-semibold rounded-xl hover:bg-[#005228] disabled:opacity-50 transition-colors w-full justify-center">
        <Check className="w-4 h-4" />
        {loading ? 'Guardando...' : 'Crear empresa'}
      </button>
    </form>
  );
}
