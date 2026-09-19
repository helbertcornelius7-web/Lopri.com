import React, { useState } from 'react';
import { Project, ChatMessage } from '../types';
import { 
  Send, 
  Sparkles, 
  FileText, 
  Layers, 
  ShieldCheck,
  X
} from 'lucide-react';

interface ProjectChatProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onJumpToSource?: (documentName: string, pageNumber: number) => void;
}

export const ProjectChat: React.FC<ProjectChatProps> = ({ 
  project, 
  isOpen, 
  onClose, 
  onJumpToSource 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: 'Hello! I answer questions strictly based on the uploaded project drawings and specifications. Every statement is grounded with exact document names and page numbers.',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sampleQuestions = [
    "What does the specification say about emergency power?",
    "What is the required bus material and neutral size?",
    "Where is AHU-1 fed from according to the drawings?",
    "Which spec section covers daylight harvesting?"
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: 'msg-' + Date.now() + 1,
        role: 'assistant',
        content: data.content || data.answer || 'No corresponding information found in the uploaded documents.',
        citations: data.citations || [],
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: 'Sorry, I encountered an error checking project documents. Please verify your connection or try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
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
              <h3 className="text-sm font-bold text-slate-900">Project Assistant</h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Grounded strictly in project documents
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
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-xs font-medium'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Citations if available */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Verified Document Citations:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c, idx) => {
                        const isDwg = /drawing|sheet|e\d/i.test(c.documentName) || !!c.sheetNumber;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (onJumpToSource) {
                                onJumpToSource(c.documentName, c.pageNumber);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                          >
                            {isDwg ? (
                              <Layers className="w-3 h-3 text-sky-600 shrink-0" />
                            ) : (
                              <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                            )}
                            <span className="font-semibold">{c.documentName}</span>
                            <span className="text-slate-500">p.{c.pageNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="bg-white border border-slate-200 text-slate-600 p-3 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs max-w-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Cross-referencing indexed documents and citations...</span>
            </div>
          )}
        </div>

        {/* Suggestion Prompts */}
        <div className="p-3 bg-white border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Quick Inquiries:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sampleQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSend(sq)}
                className="text-[11px] text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 truncate max-w-xs transition-colors"
              >
                "{sq}"
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about drawings or specs (e.g. 'generator fuel requirements')..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            className="flex-1 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 rounded-lg border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-sans"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
