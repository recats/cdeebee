import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface Context {
  params: undefined;
}

export async function POST(request: NextRequest, context: Context) {
  const body: { amount: number, pending: number } = await request.json();
  const { amount = 1, pending } = body;

  // simulate IO latency
  await new Promise(resolve => setTimeout(resolve, pending));

  return NextResponse.json({ data: amount });
}
