import React, { useState } from 'react';
import { Project } from '../types';
import { 
  Download, 
  Copy, 
  Check, 
  X, 
  FileCheck2
} from 'lucide-react';

interface ExportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const accepted = project.findings.filter((f) => f.status === 'ACCEPTED');
  const reviewLater = project.findings.filter((f) => f.status === 'REVIEW_LATER');
  const rejected = project.findings.filter((f) => f.status === 'REJECTED');
  const pending = project.findings.filter((f) => f.status === 'PENDING');

  const generateMarkdownReport = () => {
    let md = `# ELECTRICAL SCOPE CHECKER - ESTIMATOR REVIEW LOG\n`;
    md += `Project: ${project.name}\n`;
    md += `Generated: ${new Date().toLocaleString()}\n`;
    md += `Status: ${project.status.toUpperCase()}\n`;
    md += `Total Findings: ${project.findings.length} | Accepted: ${accepted.length} | Review Later: ${reviewLater.length} | Rejected: ${rejected.length} | Pending: ${pending.length}\n\n`;
    md += `---\n\n`;

    if (accepted.length > 0) {
      md += `## 1. ACCEPTED FINDINGS (ACTION REQUIRED / ESTIMATING SCOPE IMPACT)\n\n`;
      accepted.forEach((f, i) => {
        md += `### ${i + 1}. [${f.type}] ${f.title}\n`;
        md += `- **System Area**: ${f.systemArea}\n`;
        md += `- **Confidence**: ${f.confidence} (${f.confidenceRationale})\n`;
        md += `- **Explanation**: ${f.explanation}\n`;
        md += `- **Source A (Specification)**: ${f.sourceA.documentName}, Section ${f.sourceA.sectionNumber || 'N/A'}, Page ${f.sourceA.pageNumber} (${f.sourceA.location})\n`;
        md += `  > "${f.sourceA.relevantText}"\n`;
        md += `- **Source B (Drawing)**: ${f.sourceB.documentName}, Sheet ${f.sourceB.sheetNumber || 'N/A'}, Page ${f.sourceB.pageNumber} (${f.sourceB.location})\n`;
        md += `  > "${f.sourceB.relevantText}"\n`;
        if (f.estimatorNotes) {
          md += `- **Estimator Notes**: ${f.estimatorNotes}\n`;
        }
        md += `\n`;
      });
    }

    if (reviewLater.length > 0) {
      md += `## 2. MARKED FOR MANUAL INVESTIGATION\n\n`;
      reviewLater.forEach((f, i) => {
        md += `### ${i + 1}. [${f.type}] ${f.title}\n`;
        md += `- **Explanation**: ${f.explanation}\n`;
        md += `- **Estimator Notes**: ${f.estimatorNotes || 'Pending field check / engineer inquiry'}\n\n`;
      });
    }

    if (rejected.length > 0) {
      md += `## 3. REJECTED FINDINGS (NOT A VALID ISSUE PER ESTIMATOR)\n\n`;
      rejected.forEach((f, i) => {
        md += `### ${i + 1}. [${f.type}] ${f.title}\n`;
        md += `- **Reason Rejected**: ${f.estimatorNotes || 'Dismissed by estimator'}\n\n`;
      });
    }

    return md;
  };

  const reportText = generateMarkdownReport();

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_Scope_Review_Log.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Estimator Scope Review Log</h2>
              <p className="text-xs text-slate-500">Exportable summary for bid reviews, RFIs, and scope alignment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tally Cards */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            <div className="text-[11px] font-semibold text-emerald-800">Accepted</div>
            <div className="text-lg font-bold text-emerald-900 font-mono mt-0.5">{accepted.length}</div>
          </div>
          <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            <div className="text-[11px] font-semibold text-amber-800">Review Later</div>
            <div className="text-lg font-bold text-amber-900 font-mono mt-0.5">{reviewLater.length}</div>
          </div>
          <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-600">Rejected</div>
            <div className="text-lg font-bold text-slate-700 font-mono mt-0.5">{rejected.length}</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">Pending</div>
            <div className="text-lg font-bold text-slate-600 font-mono mt-0.5">{pending.length}</div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="flex-1 bg-slate-50 rounded-xl p-3.5 border border-slate-200 overflow-y-auto font-mono text-xs text-slate-800 leading-relaxed max-h-72">
          <pre className="whitespace-pre-wrap font-mono text-[11px]">{reportText}</pre>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-[11px] text-slate-500">
            Markdown format for clipboard, email, Procore, Excel
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Download .md</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
