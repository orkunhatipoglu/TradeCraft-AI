'use client';

import { Minus, Plus, Maximize2, Undo2, Redo2 } from 'lucide-react';

interface FloatingControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function FloatingControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: FloatingControlsProps) {
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-surface-light border border-border-dark rounded-full shadow-2xl p-1.5 z-50">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1 border-r border-border-dark pr-2">
        <button
          onClick={onZoomOut}
          className="size-8 flex items-center justify-center rounded-full hover:bg-background-dark text-text-secondary hover:text-white transition-colors"
          title="Zoom Out"
        >
          <Minus className="size-5" />
        </button>
        <span className="text-xs font-mono text-text-secondary w-12 text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="size-8 flex items-center justify-center rounded-full hover:bg-background-dark text-text-secondary hover:text-white transition-colors"
          title="Zoom In"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {/* View Controls */}
      <button
        onClick={onFitView}
        className="size-8 flex items-center justify-center rounded-full hover:bg-background-dark text-text-secondary hover:text-white transition-colors"
        title="Fit to Screen"
      >
        <Maximize2 className="size-5" />
      </button>

      {/* History Controls */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="size-8 flex items-center justify-center rounded-full hover:bg-background-dark text-text-secondary hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 className="size-5" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="size-8 flex items-center justify-center rounded-full hover:bg-background-dark text-text-secondary hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 className="size-5" />
      </button>
    </div>
  );
}
