/**
 * Post-processing service for enhanced transcription.
 * Integrates with Python backend for WhisperX and Pyannote processing.
 */

export interface TranscriptSegment {
  text: string;
  start?: number;
  end?: number;
  speaker?: string;
  words?: Array<{
    word: string;
    start?: number;
    end?: number;
    score?: number;
  }>;
}

export interface ProcessingInfo {
  original_file: string;
  file_size_mb: number;
  timestamp_alignment: string;
  speaker_verification: string;
  preprocessing?: string;
  word_count?: number;
  speakers_detected?: number;
  total_chunks?: number;
  global_speakers?: number;
}

export interface EnhanceResponse {
  segments: TranscriptSegment[];
  processing_info: ProcessingInfo;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

/**
 * Enhance a single audio file transcript with accurate timestamps and speakers.
 */
export async function enhanceTranscript(
  audioFile: File,
  geminiTranscript: string,
  options: {
    enableTimestampAlignment?: boolean;
    enableSpeakerVerification?: boolean;
    numSpeakers?: number;
  } = {},
  onProgress?: (message: string) => void
): Promise<EnhanceResponse> {
  const {
    enableTimestampAlignment = true,
    enableSpeakerVerification = true,
    numSpeakers
  } = options;

  onProgress?.('Uploading audio to post-processing server...');

  const formData = new FormData();
  formData.append('audio_file', audioFile);
  formData.append('gemini_transcript', geminiTranscript);
  formData.append('enable_timestamp_alignment', String(enableTimestampAlignment));
  formData.append('enable_speaker_verification', String(enableSpeakerVerification));

  if (numSpeakers !== undefined) {
    formData.append('num_speakers', String(numSpeakers));
  }

  onProgress?.('Processing with WhisperX and Pyannote...');

  try {
    const response = await fetch(`${BACKEND_URL}/enhance-transcript`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const result: EnhanceResponse = await response.json();
    onProgress?.('Post-processing completed successfully!');

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Post-processing failed: ${error.message}`);
    }
    throw new Error('Post-processing failed: Unknown error');
  }
}

/**
 * Enhance multiple audio chunks with global speaker consistency.
 */
export async function enhanceChunks(
  audioChunks: Blob[],
  geminiTranscripts: string[],
  options: {
    enableTimestampAlignment?: boolean;
    enableSpeakerVerification?: boolean;
  } = {},
  onProgress?: (message: string, chunk?: number, total?: number) => void
): Promise<EnhanceResponse> {
  const {
    enableTimestampAlignment = true,
    enableSpeakerVerification = true
  } = options;

  if (audioChunks.length !== geminiTranscripts.length) {
    throw new Error('Number of audio chunks must match number of transcripts');
  }

  onProgress?.(`Uploading ${audioChunks.length} audio chunks...`, 0, audioChunks.length);

  const formData = new FormData();

  // Add audio chunks
  audioChunks.forEach((chunk, idx) => {
    const file = new File([chunk], `chunk_${idx}.wav`, { type: 'audio/wav' });
    formData.append('audio_chunks', file);
  });

  // Add transcripts
  geminiTranscripts.forEach((transcript) => {
    formData.append('gemini_transcripts', transcript);
  });

  formData.append('enable_timestamp_alignment', String(enableTimestampAlignment));
  formData.append('enable_speaker_verification', String(enableSpeakerVerification));

  onProgress?.('Processing chunks with global speaker mapping...');

  try {
    const response = await fetch(`${BACKEND_URL}/enhance-chunks`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server error: ${response.status}`);
    }

    const result: EnhanceResponse = await response.json();
    onProgress?.('All chunks processed and merged successfully!');

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Chunk processing failed: ${error.message}`);
    }
    throw new Error('Chunk processing failed: Unknown error');
  }
}

/**
 * Check if post-processing backend is available.
 */
export async function checkBackendHealth(): Promise<{
  available: boolean;
  services: {
    whisperx: boolean;
    pyannote: boolean;
  };
}> {
  try {
    const response = await fetch(`${BACKEND_URL}/`, {
      method: 'GET',
    });

    if (!response.ok) {
      return {
        available: false,
        services: { whisperx: false, pyannote: false }
      };
    }

    const data = await response.json();

    return {
      available: data.status === 'online',
      services: data.services || { whisperx: false, pyannote: false }
    };
  } catch (error) {
    return {
      available: false,
      services: { whisperx: false, pyannote: false }
    };
  }
}

/**
 * Format enhanced segments back into readable transcript.
 */
export function formatEnhancedTranscript(
  segments: TranscriptSegment[],
  includeTimestamps: boolean = true,
  includeSpeakers: boolean = true
): string {
  return segments.map(seg => {
    let line = '';

    // Add timestamp
    if (includeTimestamps && seg.start !== undefined) {
      const timestamp = formatTimestamp(seg.start);
      line += `[${timestamp}] `;
    }

    // Add speaker label
    if (includeSpeakers && seg.speaker) {
      line += `${seg.speaker}: `;
    }

    // Add text
    line += seg.text;

    return line;
  }).join('\n');
}

/**
 * Format seconds to [HH:MM:SS] timestamp.
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Export enhanced transcript to SRT subtitle format.
 */
export function exportToSRT(segments: TranscriptSegment[]): string {
  let srtContent = '';
  let index = 1;

  for (const seg of segments) {
    if (seg.start === undefined || seg.end === undefined) {
      continue;
    }

    srtContent += `${index}\n`;
    srtContent += `${formatSRTTimestamp(seg.start)} --> ${formatSRTTimestamp(seg.end)}\n`;

    const text = seg.speaker ? `${seg.speaker}: ${seg.text}` : seg.text;
    srtContent += `${text}\n\n`;

    index++;
  }

  return srtContent;
}

/**
 * Format seconds to SRT timestamp format (HH:MM:SS,mmm).
 */
function formatSRTTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Export enhanced transcript to JSON format with full metadata.
 */
export function exportToJSON(
  segments: TranscriptSegment[],
  processingInfo?: ProcessingInfo
): string {
  const exportData = {
    metadata: {
      version: '1.0',
      generated_at: new Date().toISOString(),
      processing_info: processingInfo || {},
      total_segments: segments.length,
      total_duration: segments[segments.length - 1]?.end || 0
    },
    segments: segments
  };

  return JSON.stringify(exportData, null, 2);
}
