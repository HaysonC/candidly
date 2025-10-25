import { NextResponse } from 'next/server';
import { listTemplates, createTemplate } from '@/lib/templatesStore';

export async function GET() {
  return NextResponse.json(listTemplates());
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name = 'Untitled Template', criteria = [], coding_questions = [] } = body || {};
  const created = createTemplate({ name, criteria, coding_questions });
  return NextResponse.json(created);
}
