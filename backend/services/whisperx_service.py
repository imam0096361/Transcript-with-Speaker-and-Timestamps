"""
WhisperX service for word-level timestamp alignment.
Provides accurate timestamps by aligning transcripts with audio.
"""

import whisperx
import torch
from typing import Dict, List, Any, Optional


class WhisperXService:
    """Service for transcription and timestamp alignment using WhisperX."""

    def __init__(self, model_size: str = "medium", device: str = "cpu"):
        """
        Initialize WhisperX service.

        Args:
            model_size: Whisper model size (tiny, base, small, medium, large-v2, large-v3)
            device: Device to run on (cpu, cuda, mps)
        """
        self.device = device
        self.compute_type = "int8" if device == "cpu" else "float16"

        print(f"📥 Loading WhisperX model: {model_size} on {device}...")

        # Load Whisper model
        self.model = whisperx.load_model(
            model_size,
            device=self.device,
            compute_type=self.compute_type
        )

        # Load alignment model (for precise timestamps)
        self.align_model = None
        self.align_metadata = None

        print(f"✅ WhisperX model loaded successfully")

    def transcribe_and_align(
        self,
        audio_path: str,
        reference_transcript: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcribe audio and align to get word-level timestamps.

        Args:
            audio_path: Path to audio file
            reference_transcript: Optional reference transcript from Gemini

        Returns:
            Dictionary with segments containing accurate timestamps
        """
        # Step 1: Transcribe audio
        print("🎙️ Transcribing with WhisperX...")
        audio = whisperx.load_audio(audio_path)

        result = self.model.transcribe(
            audio,
            batch_size=16,
            language="en"  # Auto-detect or specify
        )

        # Step 2: Align transcript for word-level timestamps
        print("⏱️ Aligning timestamps...")

        # Load alignment model if not already loaded
        if self.align_model is None:
            self.align_model, self.align_metadata = whisperx.load_align_model(
                language_code=result["language"],
                device=self.device
            )

        result_aligned = whisperx.align(
            result["segments"],
            self.align_model,
            self.align_metadata,
            audio,
            self.device,
            return_char_alignments=False
        )

        # Step 3: Format segments
        formatted_segments = []
        word_count = 0

        for segment in result_aligned["segments"]:
            # Each segment has word-level timestamps
            words = segment.get("words", [])
            word_count += len(words)

            # Create segment with accurate start/end times
            formatted_segment = {
                "text": segment["text"].strip(),
                "start": segment.get("start"),
                "end": segment.get("end"),
                "words": [
                    {
                        "word": w["word"],
                        "start": w.get("start"),
                        "end": w.get("end"),
                        "score": w.get("score", 1.0)
                    }
                    for w in words
                ],
                "speaker": None  # Will be added by Pyannote
            }

            formatted_segments.append(formatted_segment)

        return {
            "segments": formatted_segments,
            "language": result["language"],
            "word_count": word_count,
            "duration": audio.shape[0] / 16000  # Sample rate is 16kHz
        }

    def merge_with_gemini(
        self,
        whisperx_segments: List[Dict],
        gemini_transcript: str
    ) -> List[Dict]:
        """
        Merge WhisperX timestamps with Gemini's superior transcription quality.

        Strategy:
        - Use Gemini's text (higher quality)
        - Use WhisperX's timestamps (more accurate)
        - Align by matching similar text segments

        Args:
            whisperx_segments: Segments from WhisperX with timestamps
            gemini_transcript: Raw transcript from Gemini

        Returns:
            Merged segments with best of both
        """
        # Simple line-based matching
        # For production, use fuzzy matching or edit distance

        gemini_lines = [
            line.strip()
            for line in gemini_transcript.split('\n')
            if line.strip()
        ]

        merged = []

        for wx_seg in whisperx_segments:
            wx_text = wx_seg["text"].strip()

            # Find matching Gemini line (simple exact match for now)
            gemini_text = wx_text  # Default to WhisperX text
            speaker = None

            for g_line in gemini_lines:
                # Extract speaker if present
                if ':' in g_line:
                    parts = g_line.split(':', 1)
                    if parts[0].strip().lower().startswith('speaker'):
                        speaker = parts[0].strip()
                        g_text = parts[1].strip()
                    else:
                        g_text = g_line
                else:
                    g_text = g_line

                # Use Gemini text if it's similar
                if self._similarity(wx_text.lower(), g_text.lower()) > 0.7:
                    gemini_text = g_text
                    break

            merged.append({
                "text": gemini_text,
                "start": wx_seg["start"],
                "end": wx_seg["end"],
                "speaker": speaker,
                "words": wx_seg.get("words", [])
            })

        return merged

    def _similarity(self, text1: str, text2: str) -> float:
        """
        Calculate simple similarity score between two texts.

        Args:
            text1: First text
            text2: Second text

        Returns:
            Similarity score between 0 and 1
        """
        # Simple word overlap ratio
        words1 = set(text1.split())
        words2 = set(text2.split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))

        return intersection / union if union > 0 else 0.0

    def cleanup(self):
        """Free up memory."""
        if hasattr(self, 'model'):
            del self.model
        if hasattr(self, 'align_model'):
            del self.align_model
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
