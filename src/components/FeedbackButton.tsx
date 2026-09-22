import React, { useEffect } from 'react';

interface FeedbackButtonProps {
  className?: string;
  variant?: 'header' | 'sidebar' | 'floating' | 'default';
}

export const openTallyFeedback = () => {
  if (typeof (window as any).Tally !== 'undefined') {
    try {
      (window as any).Tally.openPopup('obJ4Q1', {
        emoji: {
          text: '💡',
          animation: 'wave',
        },
      });
      return;
    } catch (e) {
      console.warn('Tally openPopup error, falling back:', e);
    }
  }
  // Safe fallback if embed.js is blocked by adblockers or offline
  window.open('https://tally.so/r/obJ4Q1', '_blank');
};

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  className,
  variant = 'default',
}) => {
  useEffect(() => {
    // If Tally script has loaded, tell it to scan for data-tally-open elements
    if (typeof (window as any).Tally !== 'undefined' && typeof (window as any).Tally.loadEmbeds === 'function') {
      (window as any).Tally.loadEmbeds();
    }
  }, []);

  if (variant === 'header') {
    return (
      <button
        type="button"
        data-tally-open="obJ4Q1"
        data-tally-emoji-text="💡"
        data-tally-emoji-animation="wave"
        onClick={openTallyFeedback}
        className={className || "bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center gap-1.5 shrink-0 active:scale-95"}
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
        data-tally-open="obJ4Q1"
        data-tally-emoji-text="💡"
        data-tally-emoji-animation="wave"
        onClick={openTallyFeedback}
        className={className || "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors active:scale-98"}
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
      data-tally-open="obJ4Q1"
      data-tally-emoji-text="💡"
      data-tally-emoji-animation="wave"
      onClick={openTallyFeedback}
      className={className || "bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2 cursor-pointer active:scale-95"}
      title="Give Feedback"
    >
      <span>Give Feedback</span>
      <span>💡</span>
    </button>
  );
};
