import React from 'react';
import { Project } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Cpu
} from 'lucide-react';

interface PipelineStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const PipelineStatusModal: React.FC<PipelineStatusModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Document Analysis Pipeline</h2>
              <p className="text-xs text-slate-500">Processing stages for drawings and specifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pipeline Architecture Diagram */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
          <div className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">
            Processing Sequence:
          </div>
          <div className="leading-relaxed text-slate-800 text-[11px]">
            PDF Ingestion → Text Extraction → Spec & Drawing Alignment → Grounded Cross-Check → Estimator Decision Workspace
          </div>
        </div>

        {/* Current Steps Progress */}
        <div className="space-y-2.5 py-1">
          {project.processingSteps.map((step, idx) => {
            return (
              <div
                key={step.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="mt-0.5 shrink-0">
                  {step.status === 'COMPLETED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : step.status === 'PROCESSING' ? (
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 animate-ping inline-block" />
                  ) : step.status === 'FAILED' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{step.name}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        step.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : step.status === 'PROCESSING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{step.details}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
