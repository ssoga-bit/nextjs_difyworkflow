import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🧪 [TEST] Simple test endpoint called');
    
    return NextResponse.json({
      status: 'ok',
      message: 'Basic API is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  } catch (error: any) {
    console.error('❌ [TEST] Test endpoint failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}
