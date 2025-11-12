


import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Session, LiveClientMessage, Modality } from '@google/genai';
import { formatTranscript, translateText, transcribeAudioChunk } from './services/gemini';
import { submitFeedback } from './services/feedback';
import { createBlob } from './utils/audio';
import { sliceAudio } from './utils/audioSlicer';
import { MicIcon } from './components/icons/MicIcon';
import { StopIcon } from './components/icons/StopIcon';
import { ProcessingIcon } from './components/icons/ProcessingIcon';
import { TranscriptCard } from './components/TranscriptCard';
import { UploadIcon } from './components/icons/UploadIcon';
import { AudioVisualizer } from './components/AudioVisualizer';
import { FeedbackModal } from './components/FeedbackModal';
import { GlossaryManager, GlossaryTerm } from './components/GlossaryManager';
import { BookIcon } from './components/icons/BookIcon';
import { KeyboardIcon } from './components/icons/KeyboardIcon';
import { ShortcutManager } from './components/ShortcutManager';


type Status = 'idle' | 'recording' | 'processing_transcription' | 'proofreading' | 'transcribed' | 'processing_formatting' | 'success' | 'error';
type Mode = 'record' | 'upload' | 'url' | 'long-form';
type OutputFormat = 'journalistic-english' | 'journalistic-bangla' | 'interview' | 'roundtable' | 'academic' | 'simple' | 'detailed' | 'json' | 'text' | 'markdown' | 'srt';
type InputLanguage = 'english' | 'bangla' | 'both';
type TranslationLanguage = 'none' | 'english' | 'spanish' | 'french' | 'german' | 'bangla' | 'hindi';

const isApiKeySet = !!import.meta.env.VITE_GEMINI_API_KEY;
const LOCAL_STORAGE_KEY = 'transcriptStudio-rawTranscript';
const LOCAL_STORAGE_GLOSSARY_KEY = 'transcriptStudio-glossary';
const LOCAL_STORAGE_SHORTCUTS_KEY = 'transcriptStudio-shortcuts';

export type ActionName = 
  | 'toggleRecording' | 'copyRaw' | 'copyFormatted' | 'openGlossary' | 'openShortcuts'
  | 'formatJournalisticEnglish' | 'formatJournalisticBangla' | 'formatInterview' | 'formatRoundtable'
  | 'formatAcademic' | 'formatSimple' | 'formatDetailed' | 'formatJson' | 'formatText'
  | 'formatMarkdown' | 'formatSrt';

export interface Shortcut {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export type ShortcutMap = Partial<Record<ActionName, Shortcut>>;

const DEFAULT_SHORTCUTS: ShortcutMap = {
  toggleRecording: { key: 'r', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false },
  copyRaw: { key: 'c', ctrlKey: true, metaKey: true, altKey: false, shiftKey: true },
  copyFormatted: { key: 'c', ctrlKey: true, metaKey: true, altKey: true, shiftKey: false },
  openGlossary: { key: 'g', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false },
  openShortcuts: { key: 'k', ctrlKey: true, metaKey: true, altKey: false, shiftKey: false },
};

interface Timestamp {
  seconds: number;
  nanos: number;
}

const formatDuration = (duration: Timestamp): string => {
  if (!duration || typeof duration.seconds === 'undefined') {
    return '';
  }
  const totalSeconds = duration.seconds;
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
};

const getFormatPreviewExample = (format: OutputFormat): string => {
  switch (format) {
    case 'journalistic-english':
      return 'The discussion began with a look at recent market trends. Speaker A noted a significant shift in consumer behavior, emphasizing the need for adaptation. "We must innovate," they urged, "or risk being left behind." (Style: The Daily Star)';
    case 'journalistic-bangla':
      return 'সাম্প্রতিক বাজারের প্রবণতা দিয়ে আলোচনা শুরু হয়। বক্তা ক ভোক্তা আচরণে একটি উল্লেখযোগ্য পরিবর্তন লক্ষ্য করেছেন, অভিযোজনের প্রয়োজনীয়তার উপর জোর দিয়েছেন। "আমাদের অবশ্যই উদ্ভাবন করতে হবে," তিনি অনুরোধ করেন, "নইলে পিছিয়ে পড়ার ঝুঁকি থাকবে।" (স্টাইল: দ্য ডেইলি স্টার বাংলা)';
    case 'interview':
      return 'Interviewer: What was the main challenge?\n\nSpeaker A: The primary challenge was aligning the team on a single, coherent vision. We had many ideas, but focusing our efforts was key.';
    case 'roundtable':
      return 'Speaker A: I believe the data supports this conclusion.\n\nSpeaker B: I see your point, but have we considered the external factors at play here?\n\nSpeaker C: Exactly, the geopolitical climate is a variable we cannot ignore.';
    case 'academic':
      return 'The study revealed two primary themes. The first theme, "Economic Impact," was supported by participants\' references to budget constraints. The second, "Social Integration," emerged from discussions about community involvement.';
    case 'simple':
      return 'The meeting started with a project update. We discussed the timeline and the key deliverables for the next quarter. There was a consensus that the current approach is effective but requires minor adjustments.';
    case 'detailed':
      return '[00:00:15] Speaker A: The first point I want to make is about our Q3 performance.\n[00:00:19] Speaker B: Could you elaborate on the sales figures specifically?';
    case 'json':
      return `{\n  "transcript": [\n    {\n      "speaker": "Speaker A",\n      "dialogue": "This is the first line of dialogue."\n    },\n    {\n      "speaker": "Speaker B",\n      "dialogue": "This is a response."\n    }\n  ]\n}`;
    case 'text':
      return 'This is a simple plain text transcript. It is formatted into paragraphs for readability, with conversational fillers removed. It presents the core information without complex styling.';
    case 'markdown':
      return '### Key Discussion Points\n\n- **Topic 1:** A detailed analysis of the quarterly results.\n- **Topic 2:** Brainstorming for the upcoming marketing campaign.\n\n**Speaker A** emphasized the need for a data-driven approach.';
    case 'srt':
      return '1\n00:00:01,234 --> 00:00:04,567\nHello, and welcome to the presentation.\n\n2\n00:00:05,100 --> 00:00:08,900\nToday, we will be discussing our quarterly earnings.';
    default:
      return 'Hover over a format to see a preview.';
  }
};


// Main App Component
export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [mode, setMode] = useState<Mode>('record');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('journalistic-english');
  const [inputLanguage, setInputLanguage] = useState<InputLanguage>('both');
  const [rawTranscription, setRawTranscription] = useState('');
  const [formattedTranscript, setFormattedTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState('');
  const [withFormattedTimestamps, setWithFormattedTimestamps] = useState(false);
  const [withRawTimestamps, setWithRawTimestamps] = useState(false);
  const [withSpeakerLabels, setWithSpeakerLabels] = useState(false);
  const [finalTranslationLanguage, setFinalTranslationLanguage] = useState<TranslationLanguage>('none');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [hoveredFormat, setHoveredFormat] = useState<OutputFormat | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [highlightedSentences, setHighlightedSentences] = useState<string[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(DEFAULT_SHORTCUTS);
  const [isShortcutManagerOpen, setIsShortcutManagerOpen] = useState(false);

  const sessionPromiseRef = useRef<Promise<Session> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rawTranscriptRef = useRef<string>('');
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Auto-load from localStorage on mount
  useEffect(() => {
    try {
      const savedTranscript = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedTranscript) {
        setRawTranscription(savedTranscript);
        setStatus('transcribed');
      }
      const savedGlossary = localStorage.getItem(LOCAL_STORAGE_GLOSSARY_KEY);
      if (savedGlossary) {
        setGlossary(JSON.parse(savedGlossary));
      }
      const savedShortcuts = localStorage.getItem(LOCAL_STORAGE_SHORTCUTS_KEY);
      if (savedShortcuts) {
        setShortcuts({ ...DEFAULT_SHORTCUTS, ...JSON.parse(savedShortcuts) });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Auto-save raw transcript to localStorage with debounce
  useEffect(() => {
    if ((status === 'transcribed' || status === 'success') && rawTranscription) {
      const handler = setTimeout(() => {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, rawTranscription);
        } catch (error) {
          console.error("Failed to save transcript to localStorage", error);
        }
      }, 1000); // Debounce for 1 second

      return () => {
        clearTimeout(handler);
      };
    }
  }, [rawTranscription, status]);
  
  // Auto-save glossary to localStorage
  const handleSaveGlossary = (newGlossary: GlossaryTerm[]) => {
    setGlossary(newGlossary);
    try {
      localStorage.setItem(LOCAL_STORAGE_GLOSSARY_KEY, JSON.stringify(newGlossary));
    } catch (error) {
      console.error("Failed to save glossary to localStorage", error);
    }
    setIsGlossaryOpen(false);
  };

  const handleSaveShortcuts = (newShortcuts: ShortcutMap) => {
    setShortcuts(newShortcuts);
    try {
      localStorage.setItem(LOCAL_STORAGE_SHORTCUTS_KEY, JSON.stringify(newShortcuts));
    } catch (error) {
      console.error("Failed to save shortcuts to localStorage", error);
    }
    setIsShortcutManagerOpen(false);
  };

  useEffect(() => {
    if (inputLanguage !== 'both') {
      setWithRawTimestamps(false);
      setWithFormattedTimestamps(false);
    }
  }, [inputLanguage]);
  
  const showFeedbackMessage = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(''), 3000);
  };

  const stopRecordingResources = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    setAnalyserNode(null);
  }, []);

  const resetState = () => {
    setStatus('idle');
    setError(null);
    setRawTranscription('');
    setFormattedTranscript('');
    rawTranscriptRef.current = '';
    setProcessingMessage('');
    setFeedbackSubmitted(false);
    setFeedbackMessage('');
    setSelectedFileName(null);
    setHighlightedSentences([]);
    setAudioUrl('');
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error) {
      console.error("Failed to remove transcript from localStorage", error);
    }
  };

  const runProofreading = async (transcript: string) => {
    if (!transcript.trim()) return;
    setStatus('proofreading');
    setProcessingMessage('Checking transcript for potential errors...');
    try {
      // Lazy import to keep initial bundle small
      const { proofreadTranscript } = await import('./services/gemini');
      const sentences = await proofreadTranscript(transcript);
      setHighlightedSentences(sentences);
    } catch (err) {
      console.error("Proofreading failed:", err);
      setHighlightedSentences([]); // Fail gracefully
    } finally {
      setStatus('transcribed'); // Ready for user to edit/format
    }
  };

  const handleStartRecording = async () => {
    resetState();
    setStatus('recording');

    try {
      if (!isApiKeySet) {
        throw new Error("API key not found. Please ensure it's set in your environment.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let systemInstruction = '';
      switch (inputLanguage) {
        case 'english':
          systemInstruction = 'You are a transcription service. The user will speak in English. Transcribe their speech verbatim into English using the Latin script only.';
          break;
        case 'bangla':
          systemInstruction = 'You are a transcription service. The user will speak in Bengali (Bangla). Transcribe their speech verbatim into Bengali using the Bengali script only.';
          break;
        case 'both':
          systemInstruction = 'You are a multilingual transcription service. The user will speak a mix of English and Bengali (Bangla). Transcribe their speech verbatim. Use the Latin script for English and the Bengali script for Bengali. Do not translate. Do not use any other languages or scripts.';
          break;
      }
      
      if (withSpeakerLabels) {
          systemInstruction += ' You MUST also identify and label different speakers. Prepend each part of the dialogue with a label like \'Speaker A:\', \'Speaker B:\', etc. Be consistent with the labels for each speaker throughout the entire conversation.';
      }
      
      if (glossary.length > 0) {
        const glossaryItems = glossary.map(g => `- Term: "${g.term}", Use: "${g.definition}"`).join('\n');
        systemInstruction += `\n\nCRITICAL: You MUST strictly adhere to the following custom glossary for accuracy and consistency:\n${glossaryItems}`;
      }

      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      setAnalyserNode(analyserRef.current);


      scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session) => {
              const message: LiveClientMessage = { media: pcmBlob };
              session.sendRealtimeInput(message);
            });
        }
      };

      source.connect(analyserRef.current);
      analyserRef.current.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.destination);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => console.log('Session opened.'),
          onmessage: (message) => {
            if (message.serverContent?.inputTranscription) {
              const transcription = message.serverContent.inputTranscription;
              const text = transcription.text;
              let chunk = text;

              if (withRawTimestamps && transcription.startTime) {
                 const timestampStr = formatDuration(transcription.startTime);
                 chunk = `${timestampStr} ${text}\n`;
              }
              
              rawTranscriptRef.current += chunk;
              setRawTranscription(prev => prev + chunk);
            }
          },
          onerror: (e) => {
            console.error('Session error:', e);
            setError('A real-time session error occurred.');
            setStatus('error');
            stopRecordingResources();
          },
          onclose: () => console.log('Session closed.'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: { includeTimestamps: withRawTimestamps && inputLanguage === 'both' },
          systemInstruction: systemInstruction,
        },
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start recording:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to start recording: ${errorMessage}`);
      setStatus('error');
      stopRecordingResources();
    }
  };

  const handleStopRecording = async () => {
    stopRecordingResources();

    if (!rawTranscriptRef.current.trim()) {
      setError("No audio was transcribed. Please try recording again.");
      setStatus('error');
      return;
    }
    runProofreading(rawTranscriptRef.current);
  };

  const processAudioFile = async (file: File) => {
    let fullTranscript = '';
    try {
        const { transcribeAudioFile } = await import('./services/gemini');
        await transcribeAudioFile(file, inputLanguage, withRawTimestamps, withSpeakerLabels, glossary, (chunk) => {
            fullTranscript += chunk;
            setRawTranscription(prev => prev + chunk);
        });

        if (!fullTranscript.trim()) {
            setError("Transcription failed or the audio was empty.");
            setStatus('error');
            return;
        }
        runProofreading(fullTranscript);

    } catch (err) {
        console.error("File processing failed:", err);
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(`File processing failed: ${errorMessage}`);
        setStatus('error');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/aac'];

    if (!validAudioTypes.includes(file.type)) {
      resetState();
      setError(`Invalid file type: ${file.type || 'unknown'}. Please upload a valid audio file (e.g., MP3, WAV, M4A).`);
      setStatus('error');
      event.target.value = ''; // Reset file input
      return;
    }

    resetState();
    setSelectedFileName(file.name);
    setStatus('processing_transcription');
    setProcessingMessage(`Transcribing ${file.name}... This may take a few moments.`);
    
    await processAudioFile(file);
    
    event.target.value = ''; // Reset file input
  };
  
  const handleLongAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/aac'];
    if (!validAudioTypes.includes(file.type)) {
      resetState();
      setError(`Invalid file type: ${file.type || 'unknown'}. Please upload a valid audio file.`);
      setStatus('error');
      event.target.value = '';
      return;
    }

    resetState();
    setSelectedFileName(file.name);
    setStatus('processing_transcription');
    setProcessingMessage('Analyzing and slicing audio file. This may take a moment for large files...');

    try {
      const CHUNK_DURATION_SECONDS = 15 * 60; // 15 minutes
      const chunks = await sliceAudio(file, CHUNK_DURATION_SECONDS);
      
      let fullTranscript = '';
      for (let i = 0; i < chunks.length; i++) {
        setProcessingMessage(`Transcribing chunk ${i + 1} of ${chunks.length}...`);
        
        const chunkTranscript = await transcribeAudioChunk(
          chunks[i],
          inputLanguage,
          withSpeakerLabels,
          glossary
        );

        const newContent = chunkTranscript + '\n\n';
        fullTranscript += newContent;
        setRawTranscription(prev => prev + newContent);

        // Show success message between chunks
        if (i < chunks.length - 1) {
            setProcessingMessage(`Chunk ${i + 1} of ${chunks.length} transcribed. Starting next chunk...`);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Brief pause for user to see the message
        }
      }

      if (!fullTranscript.trim()) {
        setError("Transcription failed or the audio was empty.");
        setStatus('error');
        return;
      }

      setProcessingMessage('Assembling and proofreading final transcript...');
      await runProofreading(fullTranscript);

    } catch (err) {
      console.error("Long audio processing failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Long audio processing failed: ${errorMessage}`);
      setStatus('error');
    } finally {
      event.target.value = '';
    }
  };

  const handleUrlSubmit = async () => {
    if (!audioUrl.trim()) {
      setError("Please enter a valid URL.");
      setStatus('idle');
      return;
    }
    
    if (audioUrl.includes('youtube.com') || audioUrl.includes('youtu.be')) {
      setError("YouTube links cannot be processed directly due to platform restrictions. Workaround: Please use a service to download the audio from the YouTube video as an MP3 file, then use the 'Upload File' tab to transcribe it.");
      setStatus('error');
      return;
    }
    
    resetState();
    setStatus('processing_transcription');
    setProcessingMessage(`Fetching and transcribing from URL...`);

    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const fileName = audioUrl.substring(audioUrl.lastIndexOf('/') + 1) || 'audio_from_url';
      const file = new File([blob], fileName, { type: blob.type });

      await processAudioFile(file);
      
    } catch (err) {
      console.error("URL processing failed:", err);
      const errorMessage = "Could not fetch or process the audio from this URL. This may be due to security restrictions (CORS). This feature works best with direct links to audio/video files (e.g., .mp3, .wav).";
      setError(errorMessage);
      setStatus('error');
    }
  };

  const handleFormatRequest = async (format: OutputFormat) => {
    if (!rawTranscription) return;
  
    setOutputFormat(format);
    setStatus('processing_formatting');
    setFormattedTranscript('');
    setFeedbackSubmitted(false);
    setFeedbackMessage('');
  
    let message = 'AI is formatting your transcript...';
    if (finalTranslationLanguage !== 'none') {
      message = `AI is formatting, then translating into ${finalTranslationLanguage}...`;
    }
    setProcessingMessage(message);
  
    try {
      const formattedResult = await formatTranscript(rawTranscription, format, inputLanguage, withFormattedTimestamps && inputLanguage === 'both', withSpeakerLabels, glossary);
  
      if (finalTranslationLanguage !== 'none') {
        const translatedResult = await translateText(formattedResult, finalTranslationLanguage);
        setFormattedTranscript(translatedResult);
      } else {
        setFormattedTranscript(formattedResult);
      }
      
      setStatus('success');
    } catch (err) {
      console.error("Failed to process transcript:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to process transcript: ${errorMessage}`);
      setStatus('error');
    }
  };
  
  const handleDownload = (content: string) => {
    if (!content) return;

    let extension = 'txt';
    let mimeType = 'text/plain';

    const extensionMap: Partial<Record<OutputFormat, string>> = {
        json: 'json',
        markdown: 'md',
        srt: 'srt'
    };
    extension = extensionMap[outputFormat] || 'txt';
    if (extension === 'json') mimeType = 'application/json';
    if (extension === 'srt') mimeType = 'text/plain';
    
    const date = new Date();
    const formattedDate = date.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const name = `transcript-${formattedDate}`;
    const filename = `${name}.${extension}`;

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  const handleRateGood = () => {
    submitFeedback({
      rating: 'good',
      rawTranscript: rawTranscription,
      formattedTranscript: formattedTranscript,
      format: outputFormat,
      language: inputLanguage,
      settings: {
        withFormattedTimestamps,
        withSpeakerLabels
      }
    });
    setFeedbackSubmitted(true);
    showFeedbackMessage('Thanks for your feedback!');
  };

  const handleRateBad = () => {
    setIsFeedbackModalOpen(true);
  };
  
  const handleFeedbackSubmit = (comment: string) => {
    submitFeedback({
      rating: 'bad',
      comment,
      rawTranscript: rawTranscription,
      formattedTranscript: formattedTranscript,
      format: outputFormat,
      language: inputLanguage,
      settings: {
        withFormattedTimestamps,
        withSpeakerLabels
      }
    });
    setFeedbackSubmitted(true);
    setIsFeedbackModalOpen(false);
    showFeedbackMessage('Feedback submitted. Thank you!');
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'recording': return { text: "Recording audio...", color: "text-blue-600" };
      case 'processing_transcription': return { text: processingMessage, color: "text-blue-600" };
      case 'proofreading': return { text: processingMessage, color: "text-blue-600" };
      case 'transcribed': return { text: "Raw transcript is ready. Potential errors are highlighted. You can edit it below, then choose an output format.", color: "text-green-600" };
      case 'processing_formatting': return { text: processingMessage, color: "text-blue-600" };
      case 'success': return { text: feedbackMessage || "Your formatted transcript is ready!", color: "text-green-600" };
      case 'error': return { text: `Error: ${error}`, color: "text-red-600 font-semibold" };
      case 'idle':
      default:
        let idleText = "Select an input method above.";
        if (mode === 'record') idleText = "Press the microphone to start recording.";
        if (mode === 'upload') idleText = "Select an audio file to transcribe and format.";
        if (mode === 'url') idleText = "Enter a direct audio/video URL to begin.";
        if (mode === 'long-form') idleText = "Upload a large audio file for chunked processing.";
        return { text: idleText, color: "text-slate-500" };
    }
  };

  const statusInfo = getStatusInfo();
  const isBusy = status === 'recording' || status === 'processing_transcription' || status === 'processing_formatting' || status === 'proofreading';
  const isRawLoading = (status === 'processing_transcription' || status === 'proofreading') && !rawTranscription;

  const triggerAction = useCallback((action: ActionName) => {
    switch (action) {
        case 'toggleRecording':
            if (mode === 'record' && (!isBusy || status === 'recording')) {
                status === 'recording' ? handleStopRecording() : handleStartRecording();
            }
            break;
        case 'copyRaw':
            if (rawTranscription) handleCopyToClipboard(rawTranscription);
            break;
        case 'copyFormatted':
            if (formattedTranscript) handleCopyToClipboard(formattedTranscript);
            break;
        case 'openGlossary':
            setIsGlossaryOpen(true);
            break;
        case 'openShortcuts':
            setIsShortcutManagerOpen(true);
            break;
        case 'formatJournalisticEnglish': if (rawTranscription && !isBusy) handleFormatRequest('journalistic-english'); break;
        case 'formatJournalisticBangla': if (rawTranscription && !isBusy) handleFormatRequest('journalistic-bangla'); break;
        case 'formatInterview': if (rawTranscription && !isBusy) handleFormatRequest('interview'); break;
        case 'formatRoundtable': if (rawTranscription && !isBusy) handleFormatRequest('roundtable'); break;
        case 'formatAcademic': if (rawTranscription && !isBusy) handleFormatRequest('academic'); break;
        case 'formatSimple': if (rawTranscription && !isBusy) handleFormatRequest('simple'); break;
        case 'formatDetailed': if (rawTranscription && !isBusy) handleFormatRequest('detailed'); break;
        case 'formatJson': if (rawTranscription && !isBusy) handleFormatRequest('json'); break;
        case 'formatText': if (rawTranscription && !isBusy) handleFormatRequest('text'); break;
        case 'formatMarkdown': if (rawTranscription && !isBusy) handleFormatRequest('markdown'); break;
        case 'formatSrt': if (rawTranscription && !isBusy) handleFormatRequest('srt'); break;
    }
  }, [mode, status, isBusy, rawTranscription, formattedTranscript]);

  useEffect(() => {
    // Fix: Explicitly typing the event parameter 'e' as KeyboardEvent to resolve property access errors.
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isTyping = ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
        
        if (isTyping || isFeedbackModalOpen || isGlossaryOpen || isShortcutManagerOpen) {
            return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        for (const [action, shortcut] of Object.entries(shortcuts)) {
            if (!shortcut || !shortcut.key) continue;

            const ctrlOrMetaPressed = isMac ? e.metaKey : e.ctrlKey;
            const requiredCtrlOrMeta = isMac ? shortcut.metaKey : shortcut.ctrlKey;

            if (
                e.key.toLowerCase() === shortcut.key.toLowerCase() &&
                ctrlOrMetaPressed === requiredCtrlOrMeta &&
                e.altKey === shortcut.altKey &&
                e.shiftKey === shortcut.shiftKey
            ) {
                e.preventDefault();
                triggerAction(action as ActionName);
                return; 
            }
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [shortcuts, isFeedbackModalOpen, isGlossaryOpen, isShortcutManagerOpen, triggerAction]);

  const formatLabels: Record<OutputFormat, string> = {
    'journalistic-english': 'Journalistic (English)',
    'journalistic-bangla': 'Journalistic (Bangla)',
    interview: 'Interview Q&A',
    roundtable: 'Roundtable',
    academic: 'Academic',
    simple: 'Simple Transcript',
    detailed: 'Detailed Transcript',
    json: 'JSON',
    text: 'Plain Text',
    markdown: 'Markdown',
    srt: 'SRT Subtitles'
  };

  const langLabels: Record<InputLanguage, string> = {
    both: 'English & Bangla',
    english: 'English',
    bangla: 'Bangla'
  };

  const translationLangLabels: Record<TranslationLanguage, string> = {
    none: 'No Translation',
    english: 'English',
    spanish: 'Spanish',
    french: 'French',
    german: 'German',
    bangla: 'Bangla',
    hindi: 'Hindi'
};

  return (
    <>
      <FeedbackModal 
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
      />
      <GlossaryManager
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
        onSave={handleSaveGlossary}
        initialGlossary={glossary}
      />
       <ShortcutManager
        isOpen={isShortcutManagerOpen}
        onClose={() => setIsShortcutManagerOpen(false)}
        onSave={handleSaveShortcuts}
        initialShortcuts={shortcuts}
      />
      <div className="min-h-screen text-slate-800 flex flex-col items-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl flex flex-col flex-1">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-bold text-blue-600">
              Transcript Studio AI
            </h1>
            <p className="mt-2 text-lg text-slate-600">
              Transform audio into structured, publication-ready documents with AI.
            </p>
          </header>
          
          {!isApiKeySet ? (
            <div className="text-center p-8 bg-blue-50 border border-blue-300 rounded-lg max-w-2xl mx-auto mt-8">
              <h2 className="text-2xl font-bold text-blue-800">Configuration Error</h2>
              <p className="mt-2 text-blue-700">
                The API key is not set. Please configure your environment with a valid Google AI API key to use this application. Functionality is disabled.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                  <div className="inline-flex rounded-md shadow-sm bg-slate-200 p-1 space-x-1">
                      <button 
                          onClick={() => setMode('record')}
                          disabled={isBusy}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none ${mode === 'record' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-300'} ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                          Record Audio
                      </button>
                      <button 
                          onClick={() => setMode('upload')}
                          disabled={isBusy}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none ${mode === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-300'} ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                          Upload File
                      </button>
                       <button 
                          onClick={() => setMode('url')}
                          disabled={isBusy}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none ${mode === 'url' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-300'} ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                          From URL
                      </button>
                      <button 
                          onClick={() => setMode('long-form')}
                          disabled={isBusy}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none ${mode === 'long-form' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-300'} ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                          Long Audio
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Input Language */}
                  <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm border border-slate-200">
                      <div className="flex items-center gap-4 mb-2 w-full justify-center">
                          <label className="text-sm font-medium text-slate-500">Input Options</label>
                          <div className="flex items-center space-x-4">
                              <div className="flex items-center">
                                  <input 
                                      id="speaker-labels-checkbox" 
                                      type="checkbox" 
                                      checked={withSpeakerLabels} 
                                      onChange={(e) => setWithSpeakerLabels(e.target.checked)}
                                      disabled={isBusy}
                                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <label htmlFor="speaker-labels-checkbox" className={`ml-2 text-xs font-medium ${isBusy ? 'text-slate-400' : 'text-slate-600'}`}>
                                      Speaker Labels
                                  </label>
                              </div>
                              <div className="flex items-center">
                                  <input 
                                      id="raw-timestamps-checkbox" 
                                      type="checkbox" 
                                      checked={withRawTimestamps} 
                                      onChange={(e) => setWithRawTimestamps(e.target.checked)}
                                      disabled={isBusy || inputLanguage !== 'both'}
                                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <label htmlFor="raw-timestamps-checkbox" className={`ml-2 text-xs font-medium ${isBusy || inputLanguage !== 'both' ? 'text-slate-400' : 'text-slate-600'}`}>
                                      Timestamps (Raw)
                                  </label>
                              </div>
                              <button
                                onClick={() => setIsShortcutManagerOpen(true)}
                                disabled={isBusy}
                                className={`flex items-center gap-1.5 p-1 rounded-md text-xs font-medium transition-colors ${isBusy ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`}
                                title="Configure Keyboard Shortcuts"
                              >
                                <KeyboardIcon />
                              </button>
                              <button
                                onClick={() => setIsGlossaryOpen(true)}
                                disabled={isBusy}
                                className={`flex items-center gap-1.5 p-1 rounded-md text-xs font-medium transition-colors ${isBusy ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`}
                                title="Manage Custom Glossary"
                              >
                                <BookIcon />
                              </button>
                          </div>
                      </div>
                      <div className="inline-flex rounded-md shadow-sm bg-slate-200 p-1 space-x-1">
                          {(['both', 'english', 'bangla'] as InputLanguage[]).map((lang) => (
                              <button
                                  key={lang}
                                  onClick={() => setInputLanguage(lang)}
                                  disabled={isBusy}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 focus:outline-none ${inputLanguage === lang ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-300'} ${isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
                              >
                                  {langLabels[lang]}
                              </button>
                          ))}
                      </div>
                  </div>
                  {/* Output Format */}
                  <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm border border-slate-200">
                      <div className="flex items-center gap-4 mb-2 flex-wrap justify-center">
                          <label className="text-sm font-medium text-slate-500">Output Options</label>
                          <div className="flex items-center">
                              <input 
                                  id="formatted-timestamps-checkbox" 
                                  type="checkbox" 
                                  checked={withFormattedTimestamps} 
                                  onChange={(e) => setWithFormattedTimestamps(e.target.checked)}
                                  disabled={isBusy || !rawTranscription || inputLanguage !== 'both'}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <label htmlFor="formatted-timestamps-checkbox" className={`ml-2 text-xs font-medium ${isBusy || !rawTranscription || inputLanguage !== 'both' ? 'text-slate-400' : 'text-slate-600'}`}>
                                  Timestamps
                              </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <label htmlFor="translation-lang" className={`text-xs font-medium ${isBusy || !rawTranscription ? 'text-slate-400' : 'text-slate-600'}`}>
                                Translate Final Output:
                            </label>
                            <select
                                id="translation-lang"
                                value={finalTranslationLanguage}
                                onChange={(e) => setFinalTranslationLanguage(e.target.value as TranslationLanguage)}
                                disabled={isBusy || !rawTranscription}
                                className="text-xs border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                {Object.entries(translationLangLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                          </div>
                      </div>
                      <div className="relative">
                          <div 
                            className="inline-flex rounded-md shadow-sm bg-slate-200 p-1 space-x-1 flex-wrap justify-center"
                            onMouseLeave={() => setHoveredFormat(null)}
                          >
                              {(['journalistic-english', 'journalistic-bangla', 'interview', 'roundtable', 'academic', 'simple', 'detailed', 'json', 'text', 'markdown', 'srt'] as OutputFormat[]).map((format) => (
                                  <button
                                      key={format}
                                      onClick={() => handleFormatRequest(format)}
                                      onMouseEnter={() => setHoveredFormat(format)}
                                      disabled={!rawTranscription || isBusy}
                                      className={`px-3 py-1.5 m-0.5 text-xs font-medium rounded-md transition-colors duration-200 focus:outline-none 
                                      ${outputFormat === format && (status === 'success' || status === 'processing_formatting') ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-300'} 
                                      ${!rawTranscription || isBusy ? 'cursor-not-allowed opacity-50' : ''}`}
                                  >
                                      {formatLabels[format]}
                                  </button>
                              ))}
                          </div>
                          {hoveredFormat && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-full max-w-md bg-white border border-slate-300 rounded-lg p-4 shadow-xl z-10 pointer-events-none">
                                  <h3 className="text-sm font-bold text-blue-600 mb-2 border-b border-slate-200 pb-1">
                                      Preview: {formatLabels[hoveredFormat]}
                                  </h3>
                                  <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans">
                                      {getFormatPreviewExample(hoveredFormat)}
                                  </pre>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              <div className="flex flex-col items-center justify-center mb-4 space-y-4">
                  <div className="w-full max-w-md h-20">
                      {mode === 'record' && (
                          <AudioVisualizer analyserNode={analyserNode} isRecording={status === 'recording'} />
                      )}
                  </div>
                  {mode === 'record' && (
                      <button
                          onClick={status === 'recording' ? handleStopRecording : handleStartRecording}
                          disabled={isBusy && status !== 'recording'}
                          className={`relative rounded-full p-6 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50
                          ${status === 'recording' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400' : 'bg-slate-800 hover:bg-slate-900 focus:ring-slate-400'}
                          ${isBusy && status !== 'recording' ? 'bg-slate-400 cursor-not-allowed' : ''}
                          `}
                      >
                          {status === 'recording' && <span className="absolute inset-0 rounded-full bg-blue-600 animate-ping"></span>}
                          {status === 'recording' ? <StopIcon /> : <MicIcon />}
                          {status === 'processing_formatting' && <div className="absolute inset-0 flex items-center justify-center"><ProcessingIcon /></div>}
                      </button>
                  )}
                  {mode === 'upload' && (
                      <label htmlFor="audio-upload"
                          className={`relative rounded-full p-6 transition-all duration-300 ease-in-out
                          ${isBusy ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 cursor-pointer'}
                      `}>
                          <input id="audio-upload" type="file" className="hidden" onChange={handleFileChange} accept="audio/mpeg,audio/wav,audio/webm,audio/ogg,audio/mp4,audio/x-m4a,audio/flac,audio/aac" disabled={isBusy} />
                          {status === 'processing_transcription' ? <ProcessingIcon /> : <UploadIcon /> }
                      </label>
                  )}
                  {mode === 'long-form' && (
                    <div className="flex flex-col items-center space-y-2">
                        <label htmlFor="long-audio-upload"
                            className={`relative rounded-full p-6 transition-all duration-300 ease-in-out
                            ${isBusy ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400 focus:ring-opacity-50 cursor-pointer'}
                        `}>
                            <input id="long-audio-upload" type="file" className="hidden" onChange={handleLongAudioUpload} accept="audio/mpeg,audio/wav,audio/webm,audio/ogg,audio/mp4,audio/x-m4a,audio/flac,audio/aac" disabled={isBusy} />
                            {status === 'processing_transcription' ? <ProcessingIcon /> : <UploadIcon /> }
                        </label>
                        <p className="text-center text-sm text-slate-500 max-w-md">
                            Optimized for large files (&gt;10 minutes). Your audio will be sliced and processed in chunks for maximum reliability.
                        </p>
                    </div>
                  )}
                  {mode === 'url' && (
                    <div className="w-full max-w-xl flex items-center space-x-2">
                        <input
                          type="url"
                          value={audioUrl}
                          onChange={(e) => setAudioUrl(e.target.value)}
                          placeholder="Enter direct audio or video URL"
                          disabled={isBusy}
                          className="flex-grow h-14 px-5 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                        />
                        <button
                          onClick={handleUrlSubmit}
                          disabled={isBusy || !audioUrl.trim()}
                          className="flex-shrink-0 h-14 px-6 text-white font-semibold rounded-lg shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-slate-400 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
                        >
                            {status === 'processing_transcription' ? <ProcessingIcon /> : 'Transcribe'}
                        </button>
                    </div>
                  )}

                  {(mode === 'upload' || mode === 'long-form') && selectedFileName && (
                    <p className="text-center text-sm text-slate-500 -mt-2">{selectedFileName}</p>
                  )}
                <p className={`text-center transition-colors duration-300 ${statusInfo.color}`}>{statusInfo.text}</p>
              </div>

              <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                <div className="lg:col-span-1 flex flex-col">
                    <TranscriptCard 
                      title="Raw Transcript" 
                      variant="raw"
                      content={rawTranscription} 
                      isLoading={isRawLoading}
                      isStreaming={status === 'recording' || (status === 'processing_transcription' && (mode !== 'long-form'))}
                      isEditable={status === 'transcribed' || status === 'success'}
                      onContentChange={setRawTranscription}
                      isCopyable={!!rawTranscription}
                      onCopy={() => handleCopyToClipboard(rawTranscription)}
                      highlightedSentences={highlightedSentences}
                    />
                </div>
                <div className="lg:col-span-1 flex flex-col">
                    <TranscriptCard 
                      title={`Formatted Transcript (${formatLabels[outputFormat]})`} 
                      content={formattedTranscript} 
                      isLoading={status === 'processing_formatting'}
                      isDownloadable={!!formattedTranscript && status === 'success'}
                      onDownload={() => handleDownload(formattedTranscript)}
                      isCopyable={!!formattedTranscript}
                      onCopy={() => handleCopyToClipboard(formattedTranscript)}
                      showFeedbackButtons={status === 'success' && !feedbackSubmitted}
                      onRateGood={handleRateGood}
                      onRateBad={handleRateBad}
                    />
                </div>
              </main>
            </>
          )}
        </div>
      </div>
    </>
  );
}