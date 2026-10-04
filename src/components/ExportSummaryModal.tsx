import React, { useState } from 'react';
import { Project, Finding } from '../types';
import { 
  Download, 
  Copy, 
  Check, 
  X, 
  FileCheck2,
  FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const accepted = project.findings.filter((f) => f.status === 'ACCEPTED');
  const reviewLater = project.findings.filter((f) => f.status === 'REVIEW_LATER');
  const rejected = project.findings.filter((f) => f.status === 'REJECTED');
  const pending = project.findings.filter((f) => f.status === 'PENDING');

  const generateRfiQuestion = (f: Finding): string => {
    if (f.type === 'CONFLICT') {
      return `Specification Section ${f.sourceA.sectionNumber || 'N/A'} (Page ${f.sourceA.pageNumber}) specifies "${f.sourceA.relevantText}", whereas Drawing Sheet ${f.sourceB.sheetNumber || 'N/A'} (Page ${f.sourceB.pageNumber}) indicates "${f.sourceB.relevantText}". Please clarify which standard governs this project to prevent estimating discrepancies and schedule delay.`;
    }
    if (f.type === 'SCOPE_GAP') {
      return `Specification Section ${f.sourceA.sectionNumber || 'Division 26'} mandates requirements for ${f.systemArea} ("${f.sourceA.relevantText}"), but no corresponding equipment tags or feeder circuits appear on drawing ${f.sourceB.sheetNumber || 'drawings'}. Please confirm if the electrical contractor is required to furnish, install, and wire this equipment under the base bid.`;
    }
    if (f.type === 'DOCUMENT_CONFLICT') {
      return `Drawing ${f.sourceB.sheetNumber || 'sheet'} appears to be Architectural or coordinates differently with Specification ${f.sourceA.sectionNumber || 'Division 26'}. Please confirm the applicable electrical drawings and scope boundaries for this system.`;
    }
    return `Regarding ${f.title}: Specification Section ${f.sourceA.sectionNumber || 'Division 26'} indicates "${f.sourceA.relevantText}", but drawing schedules do not clearly show this connection. Please clarify required base bid scope.`;
  };

  const generateMarkdownReport = () => {
    let md = `# ELECTRICAL SCOPE & RFI AUDIT REPORT\n`;
    md += `Project: ${project.name}\n`;
    md += `Generated: ${new Date().toLocaleString()}\n`;
    md += `Status: ${project.status.toUpperCase()}\n`;
    md += `Scope Tally: Total (${project.findings.length}) | Accepted (${accepted.length}) | Review Later (${reviewLater.length}) | Rejected (${rejected.length}) | Pending (${pending.length})\n\n`;
    md += `---\n\n`;

    if (accepted.length > 0) {
      md += `## 1. ACCEPTED FINDINGS & SUGGESTED RFI REQUESTS\n\n`;
      accepted.forEach((f, i) => {
        md += `### ${i + 1}. [${f.type}] ${f.title}\n`;
        md += `- **System Area**: ${f.systemArea}\n`;
        md += `- **Confidence**: ${f.confidence} (${f.confidenceRationale})\n`;
        md += `- **Explanation**: ${f.explanation}\n`;
        md += `- **Source A (Specification)**: ${f.sourceA.documentName}, Section ${f.sourceA.sectionNumber || 'N/A'}, Page ${f.sourceA.pageNumber} (${f.sourceA.location})\n`;
        md += `  > "${f.sourceA.relevantText}"\n`;
        md += `- **Source B (Drawing)**: ${f.sourceB.documentName}, Sheet ${f.sourceB.sheetNumber || 'N/A'}, Page ${f.sourceB.pageNumber} (${f.sourceB.location})\n`;
        md += `  > "${f.sourceB.relevantText}"\n`;
        md += `- **Suggested RFI Request**:\n`;
        md += `  > **[RFI Draft]**: "${generateRfiQuestion(f)}"\n`;
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
      md += `## 3. REJECTED FINDINGS (DISMISSED BY ESTIMATOR)\n\n`;
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

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = 45;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 45) {
          doc.addPage();
          y = 45;
        }
      };

      // Header Banner
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 52, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 52, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('LOPRI AI - PRECONSTRUCTION SCOPE & RFI AUDIT REPORT', margin + 12, y + 22);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Project: ${project.name}   |   Date: ${new Date().toLocaleDateString()}   |   Status: ${project.status.toUpperCase()}`, margin + 12, y + 38);

      y += 66;

      // Summary Tally Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Scope Tally: Total (${project.findings.length})  •  Accepted (${accepted.length})  •  Review Later (${reviewLater.length})  •  Rejected (${rejected.length})  •  Pending (${pending.length})`, margin, y);
      y += 14;

      // Horizontal line
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(1);
      doc.line(margin, y, pageWidth - margin, y);
      y += 18;

      // Render Accepted Findings
      if (accepted.length > 0) {
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(180, 83, 9); // amber-700
        doc.text('1. ACCEPTED SCOPE FINDINGS & SUGGESTED RFI QUESTIONS', margin, y);
        y += 16;

        accepted.forEach((f, idx) => {
          checkPageBreak(110);

          // Finding Title & Badge
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.text(`${idx + 1}. [${f.type}] ${f.title}`, margin, y);
          y += 13;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`System Area: ${f.systemArea}   |   Confidence: ${f.confidence} (${f.confidenceRationale})`, margin + 10, y);
          y += 13;

          // Explanation
          const expLines = doc.splitTextToSize(`Explanation: ${f.explanation}`, contentWidth - 20);
          checkPageBreak(expLines.length * 11);
          doc.text(expLines, margin + 10, y);
          y += expLines.length * 11 + 4;

          // Source A
          doc.setFont('helvetica', 'bold');
          doc.text(`Source A (Specification): ${f.sourceA.documentName} | Section ${f.sourceA.sectionNumber || 'Div 26'} | Page ${f.sourceA.pageNumber}`, margin + 10, y);
          y += 11;
          doc.setFont('helvetica', 'italic');
          const srcALines = doc.splitTextToSize(`"${f.sourceA.relevantText}"`, contentWidth - 25);
          checkPageBreak(srcALines.length * 10);
          doc.text(srcALines, margin + 15, y);
          y += srcALines.length * 10 + 4;

          // Source B
          doc.setFont('helvetica', 'bold');
          doc.text(`Source B (Drawing): ${f.sourceB.documentName} | Sheet ${f.sourceB.sheetNumber || 'N/A'} | Page ${f.sourceB.pageNumber}`, margin + 10, y);
          y += 11;
          doc.setFont('helvetica', 'italic');
          const srcBLines = doc.splitTextToSize(`"${f.sourceB.relevantText}"`, contentWidth - 25);
          checkPageBreak(srcBLines.length * 10);
          doc.text(srcBLines, margin + 15, y);
          y += srcBLines.length * 10 + 6;

          // Suggested RFI Box
          const rfiText = generateRfiQuestion(f);
          const rfiLines = doc.splitTextToSize(rfiText, contentWidth - 30);
          const rfiBoxHeight = rfiLines.length * 10.5 + 16;
          checkPageBreak(rfiBoxHeight + 10);

          doc.setFillColor(254, 243, 199); // amber-100
          doc.setDrawColor(245, 158, 11); // amber-500
          doc.rect(margin + 10, y, contentWidth - 20, rfiBoxHeight, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(146, 64, 14); // amber-800
          doc.text('SUGGESTED RFI QUESTION:', margin + 16, y + 11);

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
          doc.text(rfiLines, margin + 16, y + 22);

          y += rfiBoxHeight + 14;
        });
      }

      // Render Review Later
      if (reviewLater.length > 0) {
        checkPageBreak(35);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text('2. MARKED FOR MANUAL ESTIMATOR INVESTIGATION', margin, y);
        y += 14;

        reviewLater.forEach((f, idx) => {
          checkPageBreak(25);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          const text = `${idx + 1}. [${f.type}] ${f.title} - ${f.explanation}`;
          const lines = doc.splitTextToSize(text, contentWidth - 10);
          doc.text(lines, margin + 10, y);
          y += lines.length * 10.5 + 4;
        });
      }

      // Page numbers footer on each page
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Lopri AI Preconstruction Scope & RFI Report  •  Page ${p} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 20,
          { align: 'center' }
        );
      }

      doc.save(`${project.name.replace(/\s+/g, '_')}_Scope_and_RFI_Report.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
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
              <h2 className="text-sm font-bold text-slate-900">Estimator Scope & RFI Report</h2>
              <p className="text-xs text-slate-500">Exportable PDF summary with citations and suggested RFI questions</p>
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
            Includes exact citations and suggested RFI questions
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
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
