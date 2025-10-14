import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.DIFY_API_KEY;
  const baseURL = process.env.DIFY_API_BASE_URL;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : '❌ Not set',
      baseURL: baseURL || '❌ Not set',
      apiKeyLength: apiKey?.length || 0,
      nodeEnv: process.env.NODE_ENV,
    },
    checks: {
      apiKeySet: !!apiKey,
      baseURLSet: !!baseURL,
    }
  });
}

