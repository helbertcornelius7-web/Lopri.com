import React, { useState } from 'react';
import { Project } from '../types';
import { apiClient } from '../services/apiClient';
import { usePdfProject } from '../context/PdfProjectContext';
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
  const { uploadPdfFiles } = usePdfProject();
  const [projectName, setProjectName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<Record<string, 'drawing' | 'specification'>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLikelyDrawing = (name: string) => {
    return /E\d|drawing|plan|schematic|dwg|single-line|schedule|sheet/i.test(name);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const updateFilesWithCategories = (newFiles: File[]) => {
    // Check if any file exceeds 250MB
    const oversized = newFiles.filter(f => f.size > 250 * 1024 * 1024);
    if (oversized.length > 0) {
      setUploadError(`The following file(s) exceed 250MB: ${oversized.map(f => f.name).join(', ')}. Please select files under 250MB.`);
      return;
    }

    setSelectedFiles((prev) => {
      const combined = [...prev, ...newFiles];
      setCategories((prevCats) => {
        const nextCats = { ...prevCats };
        combined.forEach((file, index) => {
          if (!nextCats[file.name]) {
            if (isLikelyDrawing(file.name)) {
              nextCats[file.name] = 'drawing';
            } else if (combined.length >= 2 && index === 0) {
              nextCats[file.name] = 'drawing';
            } else {
              nextCats[file.name] = 'specification';
            }
          }
        });
        return nextCats;
      });
      return combined;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = (Array.from(e.target.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      updateFilesWithCategories(newFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const dropped = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      updateFilesWithCategories(dropped);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCategory = (fileName: string) => {
    setCategories((prev) => ({
      ...prev,
      [fileName]: prev[fileName] === 'drawing' ? 'specification' : 'drawing',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Please select at least one document PDF.');
      return;
    }

    setIsUploading(true);
    setProgressMessage('Starting project upload...');
    setUploadError(null);

    try {
      // Upload through global PDF state to store buffer in memory
      // and immediately hydrate Scope Review Canvas and Grounded Inquiries Stream
      const analyzedProject = await uploadPdfFiles(
        selectedFiles,
        categories,
        projectName || undefined,
        (status) => setProgressMessage(status)
      );

      onUploadSuccess(analyzedProject);
      onClose();
    } catch (err: any) {
      console.error('Upload & cross-check error:', err);
      setUploadError(err.message || 'Error processing documents. Please try again.');
    } finally {
      setIsUploading(false);
      setProgressMessage('');
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Project Name <span className="text-amber-600">*</span>
              </label>
              {selectedFiles.length > 0 && !projectName.trim() && (
                <span className="text-[11px] font-semibold text-amber-600 animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  Required
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. Metro Health Surgery Center - Electrical Package"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={`w-full text-xs text-slate-900 placeholder-slate-400 rounded-xl px-3.5 py-2.5 font-sans transition-all duration-300 focus:outline-none ${
                selectedFiles.length > 0 && !projectName.trim()
                  ? 'bg-amber-50/70 border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-2 ring-amber-400/40 animate-pulse focus:ring-amber-500'
                  : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
              }`}
              required
            />
            {/* Flashing helper reminder below the project name input */}
            {selectedFiles.length > 0 && !projectName.trim() && (
              <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-400/60 text-amber-900 text-[11px] font-medium flex items-center gap-2 animate-bounce">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>
                  Please enter the project name above to enable cross-check analysis.
                </span>
              </div>
            )}
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
              Supports heavy electrical packages up to <span className="font-semibold text-slate-700">250MB per file</span> (drawings, single-line schematics, & Division 26 spec books)
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
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Queued Documents ({selectedFiles.length})</span>
                <span className="font-mono text-[10px] text-slate-400">
                  Total: {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>
              {selectedFiles.map((file, idx) => {
                const currentCat = categories[file.name] || (isLikelyDrawing(file.name) ? 'drawing' : 'specification');
                const isDwg = currentCat === 'drawing';
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
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-slate-800 font-medium max-w-[140px] sm:max-w-[190px]">{file.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCategory(file.name)}
                        title="Click to switch category"
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors cursor-pointer shrink-0 ml-1 ${
                          isDwg 
                            ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100' 
                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {isDwg ? '📐 Drawing' : '📋 Specification'}
                      </button>
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

          {/* Footer buttons & Progress state */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium truncate max-w-[240px] text-left">
              {isUploading && (
                <span className="flex items-center gap-1.5 text-amber-600 font-semibold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {progressMessage || 'Processing documents...'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40"
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
                    <span>{progressMessage ? 'Processing...' : 'Cross-Checking...'}</span>
                  </>
                ) : (
                  <>
                    <span>Cross-Check Documents</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
