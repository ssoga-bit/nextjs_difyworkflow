import { NextResponse } from 'next/server';
import { setupDatabase } from '@/lib/database-setup-std';

export async function GET() {
  try {
    console.log('🔧 [SETUP DB] Starting database setup...');
    
    await setupDatabase();
    
    console.log('✅ [SETUP DB] Database setup completed successfully');
    
    return NextResponse.json({
      status: 'success',
      message: 'Database setup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ [SETUP DB] Database setup failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Database setup failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
