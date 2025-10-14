'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [appType, setAppType] = useState<'chat' | 'workflow' | 'completion'>('workflow');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startJob = async () => {
    console.log('='.repeat(60));
    console.log('🚀 [CLIENT] Starting new job...');
    console.log(`   App Type: ${appType}`);
    console.log(`   Query: "${query}"`);
    
    if (!query.trim()) {
      console.error('❌ [CLIENT] Validation failed: Empty query');
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        type: appType,
        userId: 'user-123', // 本番では認証から取得
        input: appType === 'workflow' ? {
          inputs: { input_text: query }  // Difyワークフローの変数名に合わせる
        } : {
          query: query,
        },
      };
      
      console.log('📤 [CLIENT] Sending request to /api/jobs/start');
      console.log('   Payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log(`📥 [CLIENT] Response received - Status: ${response.status}`);
      
      const data = await response.json();
      console.log('   Response data:', data);

      if (!response.ok) {
        console.error(`❌ [CLIENT] API error: ${data.error}`);
        throw new Error(data.error || 'Failed to start job');
      }

      console.log(`✅ [CLIENT] Job created successfully: ${data.jobId}`);

      // ジョブIDをローカルストレージに保存（再接続用）
      const savedJobs = JSON.parse(localStorage.getItem('activeJobs') || '[]');
      savedJobs.push(data.jobId);
      localStorage.setItem('activeJobs', JSON.stringify(savedJobs));
      console.log(`💾 [CLIENT] Saved to localStorage. Active jobs: ${savedJobs.length}`);

      // 少し待ってからページ遷移（ジョブがファイルに保存されるのを待つ）
      console.log('⏳ [CLIENT] Waiting 500ms before navigation...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // ジョブ監視ページへ遷移
      console.log(`🔄 [CLIENT] Navigating to /jobs/${data.jobId}`);
      console.log('='.repeat(60));
      router.push(`/jobs/${data.jobId}`);

    } catch (err: any) {
      console.log('='.repeat(60));
      console.error('❌ [CLIENT] Failed to start job');
      console.error(`   Error: ${err.message}`);
      console.log('='.repeat(60));
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
            Next.js × Dify Integration
          </h1>

          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Start Long-running Job
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Dify App Type
              </label>
              <select
                value={appType}
                onChange={(e) => setAppType(e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                disabled={loading}
              >
                <option value="chat">Chat / Agent App</option>
                <option value="workflow">Workflow App</option>
                <option value="completion">Completion / Text Generator</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the type that matches your Dify app
              </p>
            </div>

            <textarea
              className="w-full p-4 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-base font-medium placeholder:text-gray-400"
              rows={6}
              placeholder="Enter your query for Dify..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <button
              onClick={startJob}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Starting...' : 'Start Job'}
            </button>

            <div className="mt-6 pt-6 border-t">
              <a
                href="/jobs"
                className="text-blue-600 hover:underline"
              >
                View all jobs →
              </a>
            </div>

            <div className="mt-2">
              <a
                href="/logs"
                className="text-blue-600 hover:underline"
              >
                View Dify logs →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
