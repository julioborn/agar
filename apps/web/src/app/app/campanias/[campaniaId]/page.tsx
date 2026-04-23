import { redirect } from 'next/navigation';

interface Props { params: Promise<{ campaniaId: string }> }

export default async function OldCampaniaRedirect({ params }: Props) {
  const { campaniaId } = await params;
  redirect(`/app/cultivos/${campaniaId}`);
}
