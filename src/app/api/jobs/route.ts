import { NextRequest, NextResponse } from 'next/server';
import { getAllJobs } from '@/lib/storage-postgres-std';

export async function GET(request: NextRequest) {
  try {
    console.log('📥 [API /jobs] Fetching all jobs...');
    
    const jobs = await getAllJobs();

    console.log(`✓ [API /jobs] Retrieved ${jobs.length} jobs`);
    
    // ステータスごとのカウント
    const statusCount = jobs.reduce((acc: any, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`   Status breakdown:`, statusCount);

    return NextResponse.json({
      success: true,
      jobs: jobs,
      total: jobs.length,
    });

  } catch (error: any) {
    console.error('='.repeat(60));
    console.error('❌ [API /jobs] Error fetching all jobs');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack:`, error.stack);
    console.error('='.repeat(60));
    
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

