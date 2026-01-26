'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkflowStore } from '@/stores/workflowStore';
import { Header } from '@/components/builder/Header';
import { Canvas } from '@/components/builder/Canvas';
import { Modal, Button } from '@/components/ui';

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workflowId = params.id as string;
  const isNew = workflowId === 'new';

  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);

  const {
    setWorkflow,
    resetWorkflow,
    name,
    description,
    nodes,
    edges,
    viewport,
    isTestnet,
    markSaved,
  } = useWorkflowStore();

  // Fetch existing workflow
  const { data: workflow, isLoading } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => api.workflows.get(workflowId),
    enabled: !isNew,
  });

  // Create workflow mutation
  const createMutation = useMutation({
    mutationFn: api.workflows.create,
    onSuccess: (data) => {
      router.replace(`/builder/${data.id}`);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      markSaved();
    },
  });

  // Update workflow mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      api.workflows.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      markSaved();
    },
  });

  // Publish workflow mutation
  const publishMutation = useMutation({
    mutationFn: api.workflows.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  // Execute workflow mutation
  const executeMutation = useMutation({
    mutationFn: (id: string) => api.workflows.execute(id),
    onSuccess: (data) => {
      setExecutionLogs([`Execution started: ${data.executionId}`]);
      // In production, connect to WebSocket for real-time updates
      setTimeout(() => {
        setExecutionLogs((prev) => [...prev, 'Processing nodes...']);
      }, 1000);
      setTimeout(() => {
        setExecutionLogs((prev) => [...prev, 'Execution completed!']);
      }, 2500);
    },
    onError: (error: any) => {
      setExecutionLogs([`Error: ${error.message}`]);
    },
  });

  // Initialize workflow state
  useEffect(() => {
    if (isNew) {
      resetWorkflow();
    } else if (workflow) {
      setWorkflow({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description || '',
        status: workflow.status,
        isTestnet: workflow.isTestnet,
        nodes: workflow.nodes as any[],
        edges: workflow.edges as any[],
        viewport: workflow.viewport as any,
      });
    }
  }, [workflow, isNew, setWorkflow, resetWorkflow]);

  // Save handler
  const handleSave = useCallback(async () => {
    const workflowData = {
      name,
      description,
      nodes,
      edges,
      viewport,
      isTestnet,
    };

    if (isNew) {
      createMutation.mutate(workflowData);
    } else {
      updateMutation.mutate({ id: workflowId, ...workflowData });
    }
  }, [name, description, nodes, edges, viewport, isTestnet, isNew, workflowId, createMutation, updateMutation]);

  // Publish handler
  const handlePublish = useCallback(async () => {
    if (isNew) {
      // Save first, then publish
      const result = await createMutation.mutateAsync({
        name,
        description,
        nodes,
        edges,
        viewport,
        isTestnet,
      });
      publishMutation.mutate(result.id);
    } else {
      // Save and publish
      await updateMutation.mutateAsync({
        id: workflowId,
        name,
        description,
        nodes,
        edges,
        viewport,
        isTestnet,
      });
      publishMutation.mutate(workflowId);
    }
  }, [name, description, nodes, edges, viewport, isTestnet, isNew, workflowId, createMutation, updateMutation, publishMutation]);

  // Test run handler
  const handleTestRun = useCallback(() => {
    if (isNew) {
      setExecutionLogs(['Please save the workflow first']);
      setShowExecutionModal(true);
      return;
    }

    setExecutionLogs(['Starting test run...']);
    setShowExecutionModal(true);
    executeMutation.mutate(workflowId);
  }, [isNew, workflowId, executeMutation]);

  // Auto-save with debounce
  useEffect(() => {
    if (isNew) return;

    const timeout = setTimeout(() => {
      // Auto-save logic could go here
    }, 30000); // 30 second debounce

    return () => clearTimeout(timeout);
  }, [nodes, edges, viewport, isNew]);

  if (!isNew && isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background-dark">
        <div className="animate-spin size-8 border-2 border-primary border-t-transparent rounded-full" />
        <p className="mt-4 text-text-secondary">Loading workflow...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background-dark text-white font-display overflow-hidden">
      <Header
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
      <Canvas
        onTestRun={handleTestRun}
        isRunning={executeMutation.isPending}
      />

      {/* Execution Modal */}
      <Modal
        isOpen={showExecutionModal}
        onClose={() => setShowExecutionModal(false)}
        title="Test Run"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-background-dark border border-border-dark rounded-lg p-4 font-mono text-sm max-h-80 overflow-y-auto">
            {executionLogs.map((log, index) => (
              <div key={index} className="text-text-secondary py-1">
                <span className="text-primary mr-2">&gt;</span>
                {log}
              </div>
            ))}
            {executeMutation.isPending && (
              <div className="flex items-center gap-2 text-primary py-1">
                <div className="animate-spin size-4 border-2 border-primary border-t-transparent rounded-full" />
                Running...
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowExecutionModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
