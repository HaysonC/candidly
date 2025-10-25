import { NextResponse } from 'next/server';
import { getTemplate, updateTemplate } from '@/lib/templatesStore';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const item = getTemplate(params.id);
  return NextResponse.json(item ?? {});
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updated = updateTemplate(params.id, body);
  return NextResponse.json(updated ?? {});
}
