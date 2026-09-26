import React, { useState, useRef, useEffect } from 'react';
import { Project, ChatMessage } from '../types';
import { usePdfProject } from '../context/PdfProjectContext';
import { 
  Send, 
  Sparkles, 
  FileText, 
  Layers, 
  ShieldCheck,
  X,
  FileCheck2,
  CornerDownLeft
} from 'lucide-react';

interface ProjectChatProps {
  project?: Project;
  isOpen: boolean;
  onClose: () => void;
  onJumpToSource?: (documentName: string, pageNumber: number) => void;
}

export const ProjectChat: React.FC<ProjectChatProps> = ({ 
  isOpen, 
  onClose, 
  onJumpToSource 
}) => {
  const { 
    chatMessages, 
    sendChatMessage, 
    isChatLoading, 
    activePdf,
    pdfFiles 
  } = usePdfProject();

  const [inputQuery, setInputQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    "What is the required panelboard bus material (Section 26 24 16)?",
    "What does the specification mandate for copper bussing ratings?",
    "Where is AHU-1 fed from according to drawings?",
    "What emergency power requirements exist in Division 26?"
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuery).trim();
    if (!q || isChatLoading) return;
    setInputQuery('');
    await sendChatMessage(q);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Chat Drawer Header */}
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Grounded Inquiries Stream</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <FileCheck2 className="w-3 h-3 text-emerald-600" />
                  PDF Context Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Grounded in {activePdf?.name || `${pdfFiles.length} project documents`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-xs font-medium'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 text-[10px] text-slate-400 font-mono">
                  <span>{msg.role === 'user' ? 'Estimator Prompt' : 'Gemini Grounded Response'}</span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Grounded Document Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Verified Document Citations:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => onJumpToSource?.(c.documentName, c.pageNumber)}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                        >
                          <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="font-semibold">{c.documentName}</span>
                          <span className="text-slate-500">p.{c.pageNumber}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isChatLoading && (
            <div className="bg-white border border-slate-200 text-slate-600 p-3.5 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs max-w-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>Analyzing uploaded PDF context & Division 26 specifications...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-2">
          {/* Quick Suggestions Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Sample Prompts:
            </span>
            {sampleQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-full text-[11px] border border-slate-200 shadow-2xs whitespace-nowrap transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask questions grounded in the uploaded specification PDF..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isChatLoading}
              className="p-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 rounded-xl transition-all shadow-2xs"
            >
              <CornerDownLeft className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
