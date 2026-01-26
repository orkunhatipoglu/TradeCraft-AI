'use client';

import { useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '@/stores/workflowStore';
import { Sidebar } from './Sidebar';
import { FloatingControls } from './FloatingControls';
import { BaseNode } from './nodes/BaseNode';

// Blueprint style node types
const nodeTypes: Record<string, typeof BaseNode> = {
  // AI Nodes
  'ai.trader': BaseNode,
  // Data Nodes
  'data.whale': BaseNode,
  'data.sentiment': BaseNode,
  'data.news': BaseNode,
  // Equity Nodes
  'equity.btc': BaseNode,
  'equity.eth': BaseNode,
  'equity.sol': BaseNode,
  'equity.bnb': BaseNode,
  'equity.xrp': BaseNode,
};

function CanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, getViewport } = useReactFlow();

  const {
    nodes,
    edges,
    selectedNodeId,
    historyIndex,
    history,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    setViewport,
    undo,
    redo,
    pushHistory,
  } = useWorkflowStore();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const onDragStart = useCallback(
    (event: React.DragEvent, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType || !reactFlowWrapper.current) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(nodeType, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const onMoveEnd = useCallback(() => {
    const viewport = getViewport();
    setViewport(viewport);
  }, [getViewport, setViewport]);

  const onNodeDragStop = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 });
  }, [fitView]);

  const currentZoom = getViewport().zoom;

  // Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <Sidebar onDragStart={onDragStart} />

      <main
        ref={reactFlowWrapper}
        className="flex-1 relative bg-background-dark overflow-hidden"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onMoveEnd={onMoveEnd}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[24, 24]}
          defaultEdgeOptions={{
            type: 'bezier',
            style: { stroke: '#a855f7', strokeWidth: 3 },
          }}
          proOptions={{ hideAttribution: true }}
          className="bg-background-dark"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#324d67"
          />
        </ReactFlow>

        <FloatingControls
          zoom={currentZoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFitView={handleFitView}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Grid info overlay */}
        <div className="absolute bottom-4 right-4 text-text-secondary text-[10px] font-mono opacity-50 pointer-events-none">
          GRID: 24px | SNAP: ON
        </div>
      </main>

    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
