'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';

interface JobStatus {
  id: string;
  type: string;
  status: string;
  progress: number;
  result?: unknown;
  errorMessage?: string;
  streamingLogs?: Array<{
    timestamp: string;
    event: string;
    data?: unknown;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) return;

    let pollCount = 0;
    let isPolling = true;

    // ポーリング: 5秒ごとにジョブステータスを取得
    const fetchJobStatus = async () => {
      if (!isPolling) return;

      try {
        pollCount++;
        
        // 10回ごとにログ出力
        if (pollCount === 1 || pollCount % 10 === 0) {
          console.log('='.repeat(60));
          console.log(`🔄 [CLIENT POLLING] Fetch #${pollCount}`);
          console.log(`   Job ID: ${jobId}`);
        }
        
        const response = await fetch(`/api/jobs/${jobId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // ジョブが見つからない（作成中の可能性）
            if (pollCount === 1 || pollCount % 10 === 0) {
              console.log(`⏳ [CLIENT] Job not found yet, will retry...`);
              console.log('='.repeat(60));
            }
            setLoading(false);
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        
        const jobData = await response.json();
        
        if (jobData.error) {
          console.error(`❌ [CLIENT] Error: ${jobData.error}`);
          setError(jobData.error);
          isPolling = false;
          return;
        }

        // ジョブ状態を更新
        setJob({
          id: jobId,
          type: jobData.type || 'workflow',
          createdAt: jobData.createdAt || new Date().toISOString(),
          ...jobData,
        });

        setLoading(false);

        // 10回ごとまたは完了時にログ出力
        if (pollCount === 1 || pollCount % 10 === 0 || jobData.status === 'completed' || jobData.status === 'failed') {
          console.log(`📥 [CLIENT] Job state updated`);
          console.log(`   Status: ${jobData.status}, Progress: ${jobData.progress}%`);
          console.log(`   Streaming logs: ${jobData.streamingLogs?.length || 0} events`);
          console.log('='.repeat(60));
        }

        // 完了したらポーリング停止
        if (jobData.status === 'completed' || jobData.status === 'failed') {
          console.log('='.repeat(60));
          console.log(`✅ [CLIENT] Job ${jobData.status}: ${jobId}`);
          console.log(`   Total polls: ${pollCount}`);
          console.log(`   Final progress: ${jobData.progress}%`);
          console.log(`   Streaming logs: ${jobData.streamingLogs?.length || 0} events`);
          console.log('='.repeat(60));
          
          isPolling = false;
          
          // ローカルストレージから削除
          const savedJobs = JSON.parse(localStorage.getItem('activeJobs') || '[]');
          const updatedJobs = savedJobs.filter((id: string) => id !== jobId);
          localStorage.setItem('activeJobs', JSON.stringify(updatedJobs));
          console.log(`💾 [CLIENT] Removed from localStorage`);
        }
      } catch (err: any) {
        console.error('='.repeat(60));
        console.error(`❌ [CLIENT] Error fetching job status`);
        console.error(`   Error: ${err.message}`);
        console.error('='.repeat(60));
        
        // 5回連続でエラーが出たら停止
        if (pollCount > 5) {
          setError(`Failed to fetch job status: ${err.message}`);
          isPolling = false;
        }
      }
    };

    // 初回実行
    fetchJobStatus();

    // 5秒ごとにポーリング
    const pollInterval = setInterval(fetchJobStatus, 5000);

    // クリーンアップ
    return () => {
      isPolling = false;
      clearInterval(pollInterval);
    };
  }, [jobId]);

  // 自動スクロール機能
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [job?.streamingLogs, autoScroll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700 font-semibold">Loading job status...</p>
          <p className="mt-2 text-sm text-gray-600">Job ID: {jobId}</p>
          <p className="mt-1 text-xs text-gray-500">Fetching from server...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-700 text-xl font-bold mb-4">⚠️ Connection Error</div>
          <p className="text-gray-800 font-medium mb-4">{error}</p>
          
          {error.includes('Failed to fetch') && (
            <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-4 text-sm">
              <p className="text-gray-800 font-semibold mb-2">💡 What to do:</p>
              <ul className="text-gray-700 list-disc list-inside space-y-1">
                <li>The job may still be running on the server</li>
                <li>Click "Refresh" to reload</li>
                <li>Check terminal logs for details</li>
              </ul>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 font-semibold"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => router.push('/jobs')}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 font-semibold"
            >
              View All Jobs
            </button>
          </div>
          
          <button
            onClick={() => router.push('/')}
            className="mt-3 w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 font-semibold"
          >
            Go Home
          </button>
          
          <p className="mt-4 text-xs text-gray-500 text-center">
            Job ID: {jobId}
          </p>
        </div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-6 text-gray-900">Job Status</h1>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Job ID</label>
                <p className="text-gray-900 font-mono font-medium">{job.id}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Status</label>
                <p className={`text-lg font-bold ${
                  job.status === 'completed' ? 'text-green-700' :
                  job.status === 'failed' ? 'text-red-700' :
                  job.status === 'processing' ? 'text-blue-700' :
                  'text-gray-900'
                }`}>
                  {job.status.toUpperCase()}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Progress</label>
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-base font-bold text-gray-900 mt-1">{job.progress}%</p>
                </div>
              </div>

              {/* ストリーミングログ表示 */}
              {job.streamingLogs && job.streamingLogs.length > 0 && (
                <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-base font-bold text-gray-900">
                      🔄 Streaming Logs ({job.streamingLogs.length} events)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center text-xs text-gray-700 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={autoScroll}
                          onChange={(e) => setAutoScroll(e.target.checked)}
                          className="mr-2"
                        />
                        Auto-scroll
                      </label>
                    </div>
                  </div>
                  <div 
                    ref={logContainerRef}
                    className="mt-2 bg-gray-900 rounded-lg p-4 max-h-[500px] overflow-y-auto text-xs font-mono shadow-inner"
                  >
                    {job.streamingLogs.map((log, index) => {
                      const eventType = log.event;
                      let eventColor = 'text-green-400';
                      let icon = '▶';
                      
                      // イベントタイプに応じて色とアイコンを変更
                      if (eventType === 'workflow_started') {
                        eventColor = 'text-blue-400';
                        icon = '🚀';
                      } else if (eventType === 'workflow_finished') {
                        eventColor = 'text-green-500';
                        icon = '✅';
                      } else if (eventType === 'node_started') {
                        eventColor = 'text-cyan-400';
                        icon = '▶';
                      } else if (eventType === 'node_finished') {
                        eventColor = 'text-green-400';
                        icon = '✓';
                      } else if (eventType === 'text_chunk') {
                        eventColor = 'text-purple-400';
                        icon = '📝';
                      } else if (eventType.includes('loop')) {
                        eventColor = 'text-orange-400';
                        icon = '🔄';
                      } else if (eventType.includes('error')) {
                        eventColor = 'text-red-400';
                        icon = '❌';
                      }
                      
                      return (
                        <div key={index} className={`mb-1 ${eventColor}`}>
                          <span className="text-gray-500 mr-2">
                            {new Date(log.timestamp).toLocaleTimeString('ja-JP', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              fractionalSecondDigits: 1
                            })}
                          </span>
                          <span className="mr-1">{icon}</span>
                          <span className="text-yellow-300 font-semibold">[{log.event}]</span>
                          {' '}
                          {log.data?.data?.title && (
                            <span className="text-cyan-300">&quot;{log.data.data.title}&quot;</span>
                          )}
                          {log.data?.data?.text && (
                            <span className="text-white"> → {log.data.data.text.substring(0, 80)}{log.data.data.text.length > 80 ? '...' : ''}</span>
                          )}
                          {log.data?.data?.node_id && (
                            <span className="text-gray-500 ml-2">node: {log.data.data.node_id.substring(0, 8)}</span>
                          )}
                        </div>
                      );
                    })}
                    {job.status === 'processing' && (
                      <div className="text-blue-400 animate-pulse mt-2">● Processing...</div>
                    )}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-600">
                      Total events: <span className="font-bold text-gray-900">{job.streamingLogs.length}</span>
                      {job.status === 'processing' && (
                        <span className="text-blue-600 font-semibold ml-2">
                          ● Updating every 5 seconds...
                        </span>
                      )}
                      {(job.status === 'completed' || job.status === 'failed') && (
                        <span className="text-gray-500 ml-2">
                          (Completed - full history preserved)
                        </span>
                      )}
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (logContainerRef.current) {
                          logContainerRef.current.scrollTop = 0;
                        }
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Scroll to top
                    </button>
                  </div>
                </div>
              )}

              {job.result && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Result</label>
                  
                  {/* ワークフローエラーの表示 */}
                  {job.result.data?.status === 'failed' && job.result.data?.error && (
                    <div className="mt-2 mb-4 bg-red-50 border-2 border-red-300 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-base font-bold text-red-800 mb-2">Workflow Failed on Dify</h3>
                          <p className="text-sm font-semibold text-red-700 mb-2">Error:</p>
                          <pre className="text-sm bg-white p-3 rounded border border-red-200 text-red-900 font-mono whitespace-pre-wrap">
                            {job.result.data.error}
                          </pre>
                          <p className="text-xs text-red-600 mt-3">
                            This is a Dify workflow error. Please check your workflow configuration in the Dify dashboard.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* テキスト出力がある場合は見やすく表示 */}
                  {job.result.text_output && job.result.text_output !== '(No text output)' && (
                    <div className="mt-2 mb-4">
                      <div className="text-xs font-semibold text-gray-700 mb-1">Text Output:</div>
                      <div className="bg-white p-4 rounded border-2 border-blue-200 text-gray-900 text-base leading-relaxed whitespace-pre-wrap">
                        {job.result.text_output}
                      </div>
                    </div>
                  )}
                  
                  {/* 完全なJSON（詳細情報） */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-semibold mb-2">
                      Show full JSON response
                    </summary>
                    <pre className="mt-2 bg-gray-50 p-4 rounded overflow-auto max-h-96 text-sm text-gray-900 font-mono border border-gray-200">
                      {JSON.stringify(job.result, null, 2)}
                    </pre>
                  </details>
                  
                  {/* ワークフロー情報 */}
                  {job.result.workflow_run_id && (
                    <div className="mt-3 text-xs text-gray-700">
                      Workflow Run ID: <span className="font-mono font-semibold text-gray-900">{job.result.workflow_run_id}</span>
                    </div>
                  )}
                  
                  {job.result.total_events && (
                    <div className="text-xs text-gray-700">
                      Events received: <span className="font-semibold text-gray-900">{job.result.total_events}</span>
                    </div>
                  )}
                  
                  {job.result.data?.elapsed_time && (
                    <div className="text-xs text-gray-700">
                      Execution time: <span className="font-semibold text-gray-900">{Math.round(job.result.data.elapsed_time)} seconds ({Math.round(job.result.data.elapsed_time / 60)} minutes)</span>
                    </div>
                  )}
                </div>
              )}

              {job.errorMessage && (
                <div>
                  <label className="text-sm font-semibold text-red-700">Error</label>
                  <p className="text-red-700 mt-1 font-medium bg-red-50 p-3 rounded border border-red-200">{job.errorMessage}</p>
                </div>
              )}

              {/* デバッグ情報 */}
              <div className="pt-4 border-t">
                <button
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-semibold mb-2"
                >
                  {showDebugInfo ? '▼' : '▶'} Show Debug Info
                </button>
                
                {showDebugInfo && (
                  <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
                    <h4 className="font-bold text-gray-900 mb-2">Debug Information</h4>
                    <div className="space-y-1 text-gray-800 font-mono">
                      <div><span className="text-gray-600">Job ID:</span> {job.id}</div>
                      <div><span className="text-gray-600">Type:</span> {job.type}</div>
                      <div><span className="text-gray-600">Status:</span> {job.status}</div>
                      <div><span className="text-gray-600">Progress:</span> {job.progress}%</div>
                      <div><span className="text-gray-600">Created:</span> {job.createdAt}</div>
                      <div><span className="text-gray-600">Updated:</span> {job.updatedAt}</div>
                      {job.completedAt && <div><span className="text-gray-600">Completed:</span> {job.completedAt}</div>}
                      <div><span className="text-gray-600">Streaming Logs:</span> {job.streamingLogs?.length || 0} events</div>
                      <div><span className="text-gray-600">Has Result:</span> {job.result ? 'Yes' : 'No'}</div>
                      {job.result?.workflow_run_id && (
                        <div><span className="text-gray-600">Workflow Run ID:</span> {job.result.workflow_run_id}</div>
                      )}
                      {job.result?.total_events && (
                        <div><span className="text-gray-600">Total Events:</span> {job.result.total_events}</div>
                      )}
                      <div className="pt-2 mt-2 border-t border-yellow-300">
                        <span className="text-gray-600">💡 Tip:</span> Check browser console (F12) for detailed logs
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t">
                <button
                  onClick={() => router.push('/')}
                  className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 mr-4"
                >
                  Start New Job
                </button>
                <button
                  onClick={() => router.push('/jobs')}
                  className="bg-gray-600 text-white py-2 px-6 rounded hover:bg-gray-700"
                >
                  View All Jobs
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

