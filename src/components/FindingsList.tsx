import React, { useState, useMemo } from 'react';
import { Finding, FindingType, FindingStatus, ConfidenceLevel } from '../types';
import { 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search
} from 'lucide-react';

interface FindingsListProps {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  onReviewLater: (findingId: string) => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  selectedFindingId,
  onSelectFinding,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | FindingType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | FindingStatus>('ALL');

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (typeFilter !== 'ALL' && f.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = f.title.toLowerCase().includes(term);
        const matchArea = f.systemArea.toLowerCase().includes(term);
        const matchExpl = f.explanation.toLowerCase().includes(term);
        const matchDocs = ((f.sourceA?.documentName || '') + ' ' + (f.sourceB?.documentName || '')).toLowerCase().includes(term);
        if (!matchTitle && !matchArea && !matchExpl && !matchDocs) return false;
      }
      return true;
    });
  }, [findings, typeFilter, statusFilter, searchTerm]);

  // Icon and badge styling helpers
  const getTypeMeta = (type: FindingType) => {
    switch (type) {
      case 'SCOPE_GAP':
        return {
          label: 'Potential Scope Gap',
          icon: AlertCircle,
          color: 'text-rose-700',
          bulletColor: 'bg-rose-500',
        };
      case 'CONFLICT':
        return {
          label: 'Potential Conflict',
          icon: AlertTriangle,
          color: 'text-amber-700',
          bulletColor: 'bg-amber-500',
        };
      case 'MISSING_REFERENCE':
        return {
          label: 'Missing Reference',
          icon: HelpCircle,
          color: 'text-orange-700',
          bulletColor: 'bg-orange-500',
        };
      case 'DOCUMENT_CONFLICT':
        return {
          label: 'Document Conflict',
          icon: AlertTriangle,
          color: 'text-yellow-700',
          bulletColor: 'bg-yellow-500',
        };
      default:
        return {
          label: 'Scope Finding',
          icon: AlertTriangle,
          color: 'text-amber-700',
          bulletColor: 'bg-amber-500',
        };
    }
  };

  const getConfidenceBadge = (conf: ConfidenceLevel) => {
    switch (conf) {
      case 'HIGH':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Med
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: FindingStatus) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Accepted
          </span>
        );
      case 'REJECTED':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
            <XCircle className="w-2.5 h-2.5" /> Rejected
          </span>
        );
      case 'REVIEW_LATER':
        return (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Later
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden select-none">
      {/* Search and Top Controls */}
      <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-slate-50/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            <span>Findings</span>
            <span className="font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[11px] shadow-xs">
              {filteredFindings.length}
            </span>
          </div>

          <span className="text-[11px] text-slate-500">
            Click finding to verify
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search findings, specs, sheets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-xs text-slate-800 placeholder-slate-400 rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1 text-[11px]">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              statusFilter === 'ALL'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            All ({findings.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              statusFilter === 'PENDING'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Pending ({findings.filter((f) => f.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setStatusFilter('ACCEPTED')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              statusFilter === 'ACCEPTED'
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Accepted ({findings.filter((f) => f.status === 'ACCEPTED').length})
          </button>
          <button
            onClick={() => setStatusFilter('REVIEW_LATER')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              statusFilter === 'REVIEW_LATER'
                ? 'bg-amber-700 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Later ({findings.filter((f) => f.status === 'REVIEW_LATER').length})
          </button>
        </div>
      </div>

      {/* Findings List Scrollable Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5 bg-slate-50/30">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No findings match your filter criteria.
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isSelected = finding.id === selectedFindingId;
            const meta = getTypeMeta(finding.type);

            return (
              <div
                key={finding.id}
                onClick={() => onSelectFinding(finding)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-white border-amber-500 ring-2 ring-amber-500/15 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                }`}
              >
                {/* Header row: Category pill + Confidence badge */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${meta.bulletColor} shrink-0`} />
                    <span className={`text-[11px] font-bold tracking-tight truncate ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {getConfidenceBadge(finding.confidence)}
                  </div>
                </div>

                {/* Title */}
                <div className="text-xs font-bold text-slate-900 mb-1 leading-snug line-clamp-2">
                  {finding.title}
                </div>

                {/* System Area */}
                <div className="text-[11px] text-slate-500 mb-2 truncate font-medium">
                  {finding.systemArea}
                </div>

                {/* Citations Preview & Status */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100">
                  <div className="truncate flex items-center gap-1.5 text-slate-600 font-mono text-[10px]">
                    <span className="text-amber-700 font-semibold truncate">
                      {finding.sourceA.sectionNumber ? `Sec. ${finding.sourceA.sectionNumber}` : 'Spec'}
                    </span>
                    <span className="text-slate-400">↔</span>
                    <span className="text-sky-700 font-semibold truncate">
                      {finding.sourceB.sheetNumber ? `Dwg ${finding.sourceB.sheetNumber}` : 'Dwg'}
                    </span>
                  </div>

                  <div>{getStatusBadge(finding.status)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

