"""
FastAPI backend for enhanced audio transcription post-processing.
Provides WhisperX timestamp alignment and Pyannote speaker diarization.
"""

import os
import tempfile
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

from services.whisperx_service import WhisperXService
from services.pyannote_service import PyannoteService
from services.chunk_stitcher import ChunkStitcher
from services.audio_preprocessor import AudioPreprocessor

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Transcript Studio AI - Post-Processing API",
    description="Enhanced transcription with WhisperX and Pyannote",
    version="1.0.0"
)

# CORS configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
whisperx_service = None
pyannote_service = None
audio_preprocessor = AudioPreprocessor()


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global whisperx_service, pyannote_service

    print("🚀 Initializing services...")

    try:
        whisperx_service = WhisperXService(
            model_size=os.getenv("WHISPER_MODEL", "medium"),
            device=os.getenv("DEVICE", "cpu")
        )
        print("✅ WhisperX service initialized")
    except Exception as e:
        print(f"⚠️  WhisperX initialization failed: {e}")

    try:
        hf_token = os.getenv("HUGGINGFACE_TOKEN")
        if not hf_token or hf_token == "your_hf_token_here":
            print("⚠️  HUGGINGFACE_TOKEN not set. Speaker diarization will be unavailable.")
        else:
            pyannote_service = PyannoteService(
                hf_token=hf_token,
                device=os.getenv("DEVICE", "cpu")
            )
            print("✅ Pyannote service initialized")
    except Exception as e:
        print(f"⚠️  Pyannote initialization failed: {e}")


# Request/Response models
class TranscriptSegment(BaseModel):
    text: str
    start: Optional[float] = None
    end: Optional[float] = None
    speaker: Optional[str] = None


class EnhanceRequest(BaseModel):
    segments: List[TranscriptSegment]
    enable_timestamp_alignment: bool = True
    enable_speaker_verification: bool = True
    num_speakers: Optional[int] = None


class EnhanceResponse(BaseModel):
    segments: List[TranscriptSegment]
    processing_info: Dict[str, Any]


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "services": {
            "whisperx": whisperx_service is not None,
            "pyannote": pyannote_service is not None
        }
    }


@app.post("/enhance-transcript", response_model=EnhanceResponse)
async def enhance_transcript(
    audio_file: UploadFile = File(...),
    gemini_transcript: str = Form(...),
    enable_timestamp_alignment: bool = Form(True),
    enable_speaker_verification: bool = Form(True),
    num_speakers: Optional[int] = Form(None)
):
    """
    Enhance Gemini transcript with accurate timestamps and speaker labels.

    Args:
        audio_file: Original audio file
        gemini_transcript: Raw transcript from Gemini
        enable_timestamp_alignment: Use WhisperX for word-level timestamps
        enable_speaker_verification: Use Pyannote for speaker diarization
        num_speakers: Expected number of speakers (optional)

    Returns:
        Enhanced transcript with accurate timestamps and speaker labels
    """
    if not whisperx_service and enable_timestamp_alignment:
        raise HTTPException(
            status_code=503,
            detail="WhisperX service not available"
        )

    if not pyannote_service and enable_speaker_verification:
        raise HTTPException(
            status_code=503,
            detail="Pyannote service not available"
        )

    temp_audio_path = None

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(audio_file.filename).suffix) as tmp:
            content = await audio_file.read()
            tmp.write(content)
            temp_audio_path = tmp.name

        processing_info = {
            "original_file": audio_file.filename,
            "file_size_mb": len(content) / (1024 * 1024),
            "timestamp_alignment": "skipped",
            "speaker_verification": "skipped"
        }

        # Step 1: Preprocess audio (optional noise reduction)
        preprocessed_audio = audio_preprocessor.normalize_audio(temp_audio_path)
        processing_info["preprocessing"] = "completed"

        enhanced_segments = []

        # Step 2: WhisperX timestamp alignment
        if enable_timestamp_alignment:
            print("🔄 Running WhisperX timestamp alignment...")
            whisperx_result = whisperx_service.transcribe_and_align(
                preprocessed_audio,
                gemini_transcript
            )
            enhanced_segments = whisperx_result["segments"]
            processing_info["timestamp_alignment"] = "completed"
            processing_info["word_count"] = whisperx_result.get("word_count", 0)
        else:
            # Parse Gemini transcript into segments
            enhanced_segments = _parse_gemini_transcript(gemini_transcript)

        # Step 3: Pyannote speaker diarization
        if enable_speaker_verification:
            print("🔄 Running Pyannote speaker diarization...")
            diarization_result = pyannote_service.diarize(
                preprocessed_audio,
                num_speakers=num_speakers
            )

            # Merge speaker labels with transcript segments
            enhanced_segments = _merge_speaker_labels(
                enhanced_segments,
                diarization_result
            )
            processing_info["speaker_verification"] = "completed"
            processing_info["speakers_detected"] = diarization_result.get("num_speakers", 0)

        return EnhanceResponse(
            segments=[TranscriptSegment(**seg) for seg in enhanced_segments],
            processing_info=processing_info
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    finally:
        # Cleanup temporary file
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)


@app.post("/enhance-chunks", response_model=EnhanceResponse)
async def enhance_chunks(
    audio_chunks: List[UploadFile] = File(...),
    gemini_transcripts: List[str] = Form(...),
    enable_timestamp_alignment: bool = Form(True),
    enable_speaker_verification: bool = Form(True)
):
    """
    Process multiple audio chunks with global speaker consistency.

    Args:
        audio_chunks: List of audio chunk files
        gemini_transcripts: List of transcripts corresponding to each chunk
        enable_timestamp_alignment: Use WhisperX
        enable_speaker_verification: Use Pyannote with cross-chunk stitching

    Returns:
        Single merged transcript with consistent speaker IDs
    """
    if len(audio_chunks) != len(gemini_transcripts):
        raise HTTPException(
            status_code=400,
            detail="Number of audio chunks must match number of transcripts"
        )

    chunk_results = []
    temp_files = []

    try:
        # Process each chunk
        for idx, (audio_chunk, transcript) in enumerate(zip(audio_chunks, gemini_transcripts)):
            print(f"📦 Processing chunk {idx + 1}/{len(audio_chunks)}...")

            # Save chunk temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(audio_chunk.filename).suffix) as tmp:
                content = await audio_chunk.read()
                tmp.write(content)
                temp_path = tmp.name
                temp_files.append(temp_path)

            # Process chunk
            preprocessed = audio_preprocessor.normalize_audio(temp_path)

            chunk_segments = []

            if enable_timestamp_alignment:
                result = whisperx_service.transcribe_and_align(preprocessed, transcript)
                chunk_segments = result["segments"]
            else:
                chunk_segments = _parse_gemini_transcript(transcript)

            if enable_speaker_verification:
                diarization = pyannote_service.diarize(preprocessed)
                chunk_segments = _merge_speaker_labels(chunk_segments, diarization)

            chunk_results.append({
                "chunk_index": idx,
                "segments": chunk_segments,
                "duration": _get_audio_duration(preprocessed)
            })

        # Step 4: Stitch chunks with global speaker mapping
        stitcher = ChunkStitcher()
        merged_segments = stitcher.stitch_chunks(chunk_results)

        processing_info = {
            "total_chunks": len(audio_chunks),
            "timestamp_alignment": "completed" if enable_timestamp_alignment else "skipped",
            "speaker_verification": "completed" if enable_speaker_verification else "skipped",
            "global_speakers": stitcher.get_speaker_count()
        }

        return EnhanceResponse(
            segments=[TranscriptSegment(**seg) for seg in merged_segments],
            processing_info=processing_info
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunk processing failed: {str(e)}")

    finally:
        # Cleanup
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.unlink(temp_file)


def _parse_gemini_transcript(transcript: str) -> List[Dict]:
    """Parse Gemini transcript into segments."""
    segments = []
    lines = transcript.strip().split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Try to extract speaker label
        speaker = None
        text = line

        if ':' in line:
            parts = line.split(':', 1)
            if parts[0].strip().lower().startswith('speaker'):
                speaker = parts[0].strip()
                text = parts[1].strip()

        segments.append({
            "text": text,
            "speaker": speaker,
            "start": None,
            "end": None
        })

    return segments


def _merge_speaker_labels(segments: List[Dict], diarization: Dict) -> List[Dict]:
    """Merge Pyannote speaker labels with transcript segments."""
    speaker_timeline = diarization.get("timeline", [])

    for segment in segments:
        if segment.get("start") is not None:
            # Find overlapping speaker
            mid_time = (segment["start"] + segment.get("end", segment["start"])) / 2

            for spk_seg in speaker_timeline:
                if spk_seg["start"] <= mid_time <= spk_seg["end"]:
                    segment["speaker"] = spk_seg["speaker"]
                    break

    return segments


def _get_audio_duration(audio_path: str) -> float:
    """Get audio duration in seconds."""
    import soundfile as sf
    info = sf.info(audio_path)
    return info.duration


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
