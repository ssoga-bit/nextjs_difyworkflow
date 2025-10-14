'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Job {
  id: string;
  type: string;
  status: string;
  progress: number;
  input: {
    query?: string;
    inputs?: Record<string, any>;
  };
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  streamingLogs?: Array<{
    timestamp: string;
    event: string;
    data?: any;
  }>;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed'>('all');

  const fetchJobs = async () => {
    setLoading(true);
    try {
      console.log('🔍 [CLIENT] Fetching all jobs from server...');
      
      // サーバーから全ジョブを取得
      const response = await fetch('/api/jobs');
      const data = await response.json();
      
      console.log(`✅ [CLIENT] Jobs fetched - Total: ${data.jobs?.length || 0}`);
      
      if (data.success) {
        setJobs(data.jobs);
        
        // ステータスごとのカウント
        const statusCount = data.jobs.reduce((acc: any, job: Job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {});
        
        console.log('   Status breakdown:', statusCount);
      }
    } catch (error: any) {
      console.error('❌ [CLIENT] Error fetching jobs:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // 5秒ごとに自動更新（進行中のジョブがある場合）
    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const filteredJobs = filter === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filter);

  if (loading && jobs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">All Jobs</h1>
          <button
            onClick={fetchJobs}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold"
          >
            Refresh
          </button>
        </div>

        {/* フィルター */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(['all', 'processing', 'completed', 'failed', 'pending'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded font-semibold transition ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {status.toUpperCase()} ({status === 'all' ? jobs.length : jobs.filter(j => j.status === status).length})
            </button>
          ))}
        </div>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-800 text-base mb-4">No jobs found</p>
            <Link href="/" className="text-blue-600 font-semibold hover:underline">
              Start a new job →
            </Link>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-800 text-base mb-4">No jobs with status: {filter}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition block"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      {job.type.toUpperCase()}
                    </h3>
                    <p className="text-xs text-gray-600">
                      Created: {new Date(job.createdAt).toLocaleString('ja-JP')}
                    </p>
                    {job.completedAt && (
                      <p className="text-xs text-gray-600">
                        Completed: {new Date(job.completedAt).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded text-sm font-bold ${
                    job.status === 'completed' ? 'bg-green-100 text-green-800' :
                    job.status === 'failed' ? 'bg-red-100 text-red-800' :
                    job.status === 'processing' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                    'bg-gray-100 text-gray-900'
                  }`}>
                    {job.status.toUpperCase()}
                  </span>
                </div>

                {/* 入力内容のプレビュー */}
                {job.input?.query && (
                  <p className="text-sm text-gray-700 mb-2 bg-gray-50 p-2 rounded">
                    Query: {job.input.query.substring(0, 100)}{job.input.query.length > 100 ? '...' : ''}
                  </p>
                )}
                {job.input?.inputs?.input_text && (
                  <p className="text-sm text-gray-700 mb-2 bg-gray-50 p-2 rounded">
                    Input: {job.input.inputs.input_text.substring(0, 100)}{job.input.inputs.input_text.length > 100 ? '...' : ''}
                  </p>
                )}

                {/* 進捗バー */}
                <div className="mb-2">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 text-right mt-1">{job.progress}%</p>
                </div>

                {/* ストリーミングログのサマリー */}
                {job.streamingLogs && job.streamingLogs.length > 0 && (
                  <div className="text-xs text-gray-600 mt-2">
                    📊 Events: {job.streamingLogs.length} 
                    {job.streamingLogs[job.streamingLogs.length - 1] && (
                      <span className="ml-2">
                        Last: [{job.streamingLogs[job.streamingLogs.length - 1].event}]
                      </span>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-900 font-medium mt-2">
                  Job ID: {job.id}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

