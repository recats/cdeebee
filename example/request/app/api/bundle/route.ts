import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body: { amount: number, pending: number } = await request.json();
  const { pending } = body;

  // simulate IO latency
  await new Promise(resolve => setTimeout(resolve, pending));

  return NextResponse.json(
    { 
      bundleList: {
        '961': {
          'bundleID': 961,
          'timestamp': new Date().toISOString(),
          'bundle': 'test123',
        },
        '1549103': {
          'bundleID': 1549103,
          'timestamp': new Date().toISOString(),
          'bundle': 'test4',
        },
      },
    }
  );
}
