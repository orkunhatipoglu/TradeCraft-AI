'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Workflow, Pencil, Play, Pause, Save, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button, Input, Modal } from '@/components/ui';
import { useWorkflowStore } from '@/stores/workflowStore';

interface HeaderProps {
  onSave: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  isSaving: boolean;
  isToggling: boolean;
}

export function Header({ onSave, onActivate, onDeactivate, isSaving, isToggling }: HeaderProps) {
  const { name, status, isTestnet, isDirty, lastSaved, setName, setTestnet } = useWorkflowStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);

  const handleSaveName = () => {
    setName(editedName);
    setIsEditing(false);
  };

  const getLastSavedText = () => {
    if (!lastSaved) return 'Not saved';
    const diff = Date.now() - lastSaved.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just saved';
    if (minutes === 1) return 'Saved 1 min ago';
    return `Saved ${minutes} mins ago`;
  };

  const getStatusDisplay = () => {
    if (status === 'active') return { text: 'Active', color: 'text-green-400' };
    if (status === 'paused') return { text: 'Paused', color: 'text-yellow-400' };
    return { text: status, color: 'text-text-secondary' };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <header className="h-16 flex items-center justify-between border-b border-border-dark bg-surface-dark px-6 shrink-0 z-30">
      {/* Left: Logo & Title */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-3 text-white hover:opacity-80 transition-opacity">
          <ArrowLeft className="size-5 text-text-secondary" />
          <div className="size-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Workflow className="size-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">TradeCraft AI</h1>
        </Link>

        <div className="h-6 w-px bg-border-dark" />

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-7 text-base font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setEditedName(name);
                      setIsEditing(false);
                    }
                  }}
                />
                <Button size="sm" onClick={handleSaveName}>
                  Save
                </Button>
              </div>
            ) : (
              <>
                <span className="text-base font-bold text-white">{name}</span>
                <button
                  onClick={() => {
                    setEditedName(name);
                    setIsEditing(true);
                  }}
                  className="text-text-secondary hover:text-white transition-colors"
                >
                  <Pencil className="size-4" />
                </button>
              </>
            )}
          </div>
          <span className="text-xs text-text-secondary font-medium">
            {getLastSavedText()} • <span className={statusDisplay.color}>{statusDisplay.text}</span>
            {isDirty && ' • Unsaved changes'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        {/* Testnet Toggle */}
        <div className="flex items-center gap-2 mr-2 border-r border-border-dark pr-4">
          <button
            onClick={() => setTestnet(!isTestnet)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              isTestnet
                ? 'bg-blue-900/30 border-blue-500/50 text-blue-400'
                : 'bg-red-900/30 border-red-500/50 text-red-400'
            }`}
          >
            {isTestnet ? (
              <ToggleLeft className="size-4" />
            ) : (
              <ToggleRight className="size-4" />
            )}
            <span className="text-xs font-bold">
              {isTestnet ? 'Testnet' : 'Production'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-6 mr-4 border-r border-border-dark pr-6 h-8">
          <button className="text-sm font-medium text-text-secondary hover:text-white transition-colors">
            View
          </button>
          <button className="text-sm font-medium text-text-secondary hover:text-white transition-colors">
            Settings
          </button>
          <button className="text-sm font-medium text-text-secondary hover:text-white transition-colors">
            Help
          </button>
        </div>

        <Button
          variant="secondary"
          onClick={onSave}
          isLoading={isSaving}
          disabled={!isDirty}
        >
          <Save className="size-4" />
          Save Draft
        </Button>

        {status === 'active' ? (
          <Button variant="danger" onClick={onDeactivate} isLoading={isToggling}>
            <Pause className="size-4" />
            Deactivate
          </Button>
        ) : (
          <Button onClick={onActivate} isLoading={isToggling}>
            <Play className="size-4" />
            Activate
          </Button>
        )}

        <div
          className="size-9 rounded-full ring-2 ring-border-dark ml-2 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #FF6B6B 0%, #556270 100%)',
          }}
        />
      </div>
    </header>
  );
}
