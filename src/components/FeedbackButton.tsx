import React, { useState } from 'react';
import { X, MessageSquare, Send, CheckCircle2 } from 'lucide-react';

interface FeedbackButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'floating' | 'default';
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  className,
  variant = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'suggestion' | 'issue' | 'accuracy'>('suggestion');
  const [comments, setComments] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comments.trim()) return;

    try {
      const stored = JSON.parse(localStorage.getItem('lopri_feedback_log') || '[]');
      stored.push({
        type: feedbackType,
        text: comments.trim(),
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('lopri_feedback_log', JSON.stringify(stored));
    } catch {
      // LocalStorage access safeguard
    }

    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setComments('');
      setIsOpen(false);
    }, 1800);
  };

  const buttonElement = (() => {
    if (variant === 'header') {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={className || "bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"}
          title="Give Feedback"
        >
          <span>Give Feedback</span>
          <span className="text-xs leading-none">💡</span>
        </button>
      );
    }

    if (variant === 'sidebar') {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={className || "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors active:scale-98 cursor-pointer"}
          title="Share your feedback or suggestions"
        >
          <span className="flex items-center gap-2">
            <span>Give Feedback</span>
          </span>
          <span className="text-sm leading-none">💡</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className || "bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2 cursor-pointer active:scale-95"}
        title="Give Feedback"
      >
        <span>Give Feedback</span>
        <span>💡</span>
      </button>
    );
  })();

  return (
    <>
      {buttonElement}

      {/* Built-in Modal - 100% Offline & Iframe Compatible */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-slate-900">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {isSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-slate-900">Thank you for your feedback!</h3>
                <p className="text-xs text-slate-500">
                  Your feedback helps improve Lopri AI's electrical scope extraction accuracy.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                    💡
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Estimator Feedback</h3>
                    <p className="text-[11px] text-slate-500">Help refine specification & drawing cross-checking</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Feedback Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFeedbackType('suggestion')}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                        feedbackType === 'suggestion'
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Suggestion
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('accuracy')}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                        feedbackType === 'accuracy'
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      AI Accuracy
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedbackType('issue')}
                      className={`py-1.5 px-2 text-xs rounded-lg border font-medium transition-all ${
                        feedbackType === 'issue'
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Report Issue
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Comments or Suggestions</label>
                  <textarea
                    rows={4}
                    required
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Tell us what you'd like to see, report a parsing discrepancy, or suggest an electrical feature..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Feedback</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
