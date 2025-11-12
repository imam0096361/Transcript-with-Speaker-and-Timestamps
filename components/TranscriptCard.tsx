import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ThumbUpIcon } from './icons/ThumbUpIcon';
import { ThumbDownIcon } from './icons/ThumbDownIcon';
import { InfoIcon } from './icons/InfoIcon';
import { SkeletonLoader } from './SkeletonLoader';

interface TranscriptCardProps {
  title: string;
  content: string;
  isLoading: boolean;
  isDownloadable?: boolean;
  onDownload?: () => void;
  isStreaming?: boolean;
  isEditable?: boolean;
  onContentChange?: (newContent: string) => void;
  isCopyable?: boolean;
  onCopy?: () => void;
  showFeedbackButtons?: boolean;
  onRateGood?: () => void;
  onRateBad?: () => void;
  highlightedSentences?: string[];
  variant?: 'raw' | 'default';
}

const generateHighlightedHtml = (text: string, highlights?: string[]): string => {
  if (!text) return '';
  // First, escape the entire text to prevent any HTML injection from the content itself.
  let escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (!highlights || highlights.length === 0) {
    return escapedText.replace(/\n/g, '<br />');
  }

  // Create a regex to find all highlights
  const escapedHighlights = highlights
    .map(h => h.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(h => h.length > 0);

  if (escapedHighlights.length === 0) {
    return escapedText.replace(/\n/g, '<br />');
  }

  const regex = new RegExp(`(${escapedHighlights.join('|')})`, 'gi');
  
  escapedText = escapedText.replace(regex, `<mark class="bg-yellow-200 rounded px-0.5">$1</mark>`);

  return escapedText.replace(/\n/g, '<br />');
};

export const TranscriptCard: React.FC<TranscriptCardProps> = ({
  title,
  content,
  isLoading,
  isDownloadable,
  onDownload,
  isStreaming,
  isEditable,
  onContentChange,
  isCopyable,
  onCopy,
  showFeedbackButtons,
  onRateGood,
  onRateBad,
  highlightedSentences,
  variant = 'default',
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopyClick = () => {
    if (onCopy) {
      onCopy();
      setIsCopied(true);
    }
  };
  
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const highlightedHtml = useMemo(
    () => generateHighlightedHtml(content, highlightedSentences),
    [content, highlightedSentences]
  );

  const showHighlightsInfo = highlightedSentences && highlightedSentences.length > 0;

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  const cardClasses = variant === 'raw' 
    ? 'bg-slate-50 border-dashed border-slate-300' 
    : 'bg-white border-solid border-slate-200';

  return (
    <div className={`rounded-xl shadow-md p-6 flex flex-col border flex-1 min-h-0 ${cardClasses}`}>
      <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b border-slate-200 pb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          {title}
          {showHighlightsInfo && (
            <div
              className="cursor-help"
              title="Highlighted text indicates potential transcription errors identified by AI."
            >
              <InfoIcon />
            </div>
          )}
        </span>
        <div className="flex items-center space-x-2">
          {showFeedbackButtons && (
            <div className="flex items-center space-x-1 border-r border-slate-200 pr-2 mr-1">
              <button
                onClick={onRateGood}
                className="p-1.5 rounded-full text-slate-500 hover:bg-green-100 hover:text-green-600 transition-colors duration-200"
                aria-label="Good result"
                title="Good result"
              >
                <ThumbUpIcon />
              </button>
              <button
                onClick={onRateBad}
                className="p-1.5 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors duration-200"
                aria-label="Report an issue"
                title="Report an issue"
              >
                <ThumbDownIcon />
              </button>
            </div>
          )}
          {isCopyable && (
            <button
              onClick={handleCopyClick}
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors duration-200 relative"
              aria-label="Copy transcript"
              title="Copy transcript"
            >
              {isCopied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
          {isDownloadable && (
            <button
              onClick={onDownload}
              className="p-1.5 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors duration-200"
              aria-label="Download transcript"
              title="Download transcript"
            >
              <DownloadIcon />
            </button>
          )}
        </div>
      </h2>
      <div className="flex-grow overflow-y-auto relative prose prose-p:text-slate-600 prose-headings:text-slate-700">
        {isLoading && !content ? (
          <SkeletonLoader />
        ) : isEditable ? (
           <div className="relative w-full h-full">
            <div
              ref={backdropRef}
              className="absolute inset-0 w-full h-full overflow-auto whitespace-pre-wrap font-sans text-slate-700 p-0 pointer-events-none"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onContentChange?.(e.target.value)}
              onScroll={handleScroll}
              className="absolute inset-0 w-full h-full bg-transparent border-none focus:ring-0 resize-none font-sans text-transparent caret-slate-800 p-0"
              placeholder="Edit your transcript here..."
              spellCheck="false"
            />
          </div>
        ) : (
          <pre className={`w-full h-full whitespace-pre-wrap font-sans transition-colors duration-200 ${isStreaming ? 'text-slate-500' : 'text-slate-700'}`}>
            {content || 'Content will appear here.'}
            {isStreaming && content && <span className="inline-block w-2 h-5 bg-slate-500 ml-1 animate-pulse" />}
          </pre>
        )}
      </div>
    </div>
  );
};