'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface DifyLog {
  id: string;
  difyLogId: string;
  logType: string;
  content: any;
  status: string;
  fetchedAt: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<DifyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/logs?page=${pageNum}&limit=20`);
      const data = await response.json();
      
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [page]);

  // 自動リロード（5分ごと）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(page);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [page]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Dify Logs</h1>
          <button
            onClick={() => fetchLogs(page)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {loading && logs.length === 0 ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-800 text-base">No logs found</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold mr-2">
                        {log.logType}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                        {log.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {format(new Date(log.fetchedAt), 'yyyy-MM-dd HH:mm:ss')}
                    </span>
                  </div>
                  <pre className="text-sm bg-gray-50 p-4 rounded overflow-auto max-h-60 text-gray-900 font-mono border border-gray-200">
                    {JSON.stringify(log.content, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white rounded shadow disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-white rounded shadow disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

