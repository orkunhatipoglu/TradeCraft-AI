'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, Bug } from 'lucide-react';

export function DebugWorkflowRunner() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: api.workflows.list,
  });

  const firstWorkflow = workflows?.[0];

  const executeWorkflow = async () => {
    if (!firstWorkflow) {
      setLastResult('No workflow found');
      return;
    }

    setIsExecuting(true);
    setLastResult(null);
    try {
      const response = await fetch(`/api/workflows/${firstWorkflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Execution failed');
      }

      setLastResult(`Success: ${result.message}`);
      console.log('Workflow executed:', result);
    } catch (error: any) {
      setLastResult(`Error: ${error.message}`);
      console.error('Workflow execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {lastResult && (
        <div className="bg-surface-dark border border-border-dark rounded-lg p-3 max-w-xs text-xs">
          <p className="text-text-secondary break-all">{lastResult}</p>
        </div>
      )}

      <button
        onClick={executeWorkflow}
        disabled={isExecuting || !firstWorkflow}
        className={`flex items-center gap-2 rounded-full shadow-lg transition-all px-4 py-2 ${
          isExecuting
            ? 'bg-blue-600'
            : 'bg-purple-600 hover:bg-purple-700'
        }`}
        title={!firstWorkflow ? 'No workflow available' : 'Run workflow'}
      >
        {isExecuting ? (
          <>
            <Loader2 className="size-5 text-white animate-spin" />
            <span className="text-white text-sm font-medium">Running...</span>
          </>
        ) : (
          <>
            <Bug className="size-5 text-white" />
            <span className="text-white text-sm font-medium">Debug Run</span>
          </>
        )}
      </button>

      {firstWorkflow && (
        <p className="text-xs text-text-secondary">
          Target: {firstWorkflow.name}
        </p>
      )}
    </div>
  );
}
