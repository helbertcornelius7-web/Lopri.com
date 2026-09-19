import React, { useState } from 'react';
import { Project } from '../types';
import { 
  Upload, 
  X, 
  FileText, 
  Layers, 
  Trash2, 
  AlertCircle, 
  ArrowRight,
  FolderPlus
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (project: Project) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [projectName, setProjectName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = (Array.from(e.target.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const dropped = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      setSelectedFiles((prev) => [...prev, ...dropped]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isLikelyDrawing = (name: string) => {
    return /E\d|drawing|plan|schematic|dwg|single-line|schedule/i.test(name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one drawing PDF and one specification PDF.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 1. Create project
      const projRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: `Custom upload with ${selectedFiles.length} documents.`,
        }),
      });

      if (!projRes.ok) {
        throw new Error('Failed to create project');
      }

      const projectData = await projRes.json();

      // 2. Upload documents
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const uploadRes = await fetch(`/api/projects/${projectData.id}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      // 3. Trigger cross-check analysis
      const analyzeRes = await fetch(`/api/projects/${projectData.id}/analyze`, {
        method: 'POST',
      });
      const analyzeData = await analyzeRes.json();

      onUploadSuccess(analyzeData.project || projectData);
      onClose();
    } catch (err: any) {
      setUploadError(err.message || 'Error processing upload and analysis');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Upload Project Documents</h2>
              <p className="text-xs text-slate-500">Cross-check electrical drawings against project specifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Project Name
            </label>
            <input
              type="text"
              placeholder="e.g. Metro Health Surgery Center - Electrical Package"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-slate-50 text-xs text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-sans"
              required
            />
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-xl p-6 text-center transition-all cursor-pointer bg-slate-50/50 hover:bg-amber-50/30"
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <Upload className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <div className="text-xs text-slate-900 font-bold">
              Click to select or drag and drop PDF files
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Multiple files supported: <span className="font-semibold text-slate-700">E1.1.pdf</span>, <span className="font-semibold text-slate-700">E2.1.pdf</span>, <span className="font-semibold text-slate-700">Specifications.pdf</span>
            </div>
            <input
              id="file-upload-input"
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Queued Documents ({selectedFiles.length})
              </div>
              {selectedFiles.map((file, idx) => {
                const isDwg = isLikelyDrawing(file.name);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDwg ? (
                        <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span className="truncate text-slate-800 font-medium">{file.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 shrink-0">
                        {isDwg ? 'Drawing' : 'Specification'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || selectedFiles.length === 0 || !projectName.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-2xs"
            >
              {isUploading ? (
                <>
                  <span className="w-3 h-3 rounded-full bg-slate-950 animate-ping" />
                  <span>Processing & Cross-Checking...</span>
                </>
              ) : (
                <>
                  <span>Cross-Check Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
