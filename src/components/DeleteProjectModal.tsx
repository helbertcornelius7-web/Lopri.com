import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Project } from '../types';

interface DeleteProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onConfirmDelete: (projectId: string) => Promise<void>;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  project,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !project) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(project.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const documentCount = project.documents ? project.documents.length : 0;
  const findingsCount = project.findings ? project.findings.length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with red danger icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Delete Project</h2>
              <p className="text-xs text-slate-500">Remove project and associated scope records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Body */}
        <div className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-xl space-y-2">
          <div className="text-xs text-rose-950 font-medium">
            Are you sure you want to permanently delete:
          </div>
          <div className="text-xs font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200/80 truncate">
            {project.name || 'Untitled Project'}
          </div>
          <div className="text-[11px] text-slate-500 space-y-1">
            <p>This will remove:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 font-medium">
              <li>{documentCount} uploaded electrical drawing and specification PDF(s)</li>
              <li>{findingsCount} scope discrepancy finding(s) and review notes</li>
            </ul>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic">
          This action cannot be undone. Workspace state will update immediately.
        </p>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
          >
            {isDeleting ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting Project...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
