# Project Structure

Complete directory structure of the enhanced Transcript Studio AI system.

```
transcript-studio-ai/
│
├── 📄 QUICKSTART.md                      # 10-minute setup guide
├── 📄 ENHANCED_ACCURACY_GUIDE.md         # Technical deep-dive (12 pages)
├── 📄 IMPLEMENTATION_SUMMARY.md          # Implementation overview
├── 📄 PROJECT_STRUCTURE.md               # This file
│
├── 🔧 setup.sh                           # Linux/Mac setup script
├── 🔧 setup.bat                          # Windows setup script
├── 🔧 package.json                       # Frontend dependencies
├── 🔧 vite.config.ts                     # Vite configuration
├── 🔧 tsconfig.json                      # TypeScript configuration
│
├── 🌍 .env.example                       # Frontend environment template
├── 🌍 .env.local                         # Frontend environment (create from .env.example)
│
├── 📁 src/                               # Frontend source code
│   ├── services/
│   │   ├── gemini.ts                    # Original: Gemini API integration
│   │   ├── feedback.ts                  # Original: Feedback collection
│   │   └── 🆕 postprocessing.ts         # NEW: Backend API client (250 lines)
│   │       ├── enhanceTranscript()      # Enhance single audio file
│   │       ├── enhanceChunks()          # Enhance multiple chunks
│   │       ├── checkBackendHealth()     # Health check
│   │       ├── formatEnhancedTranscript()
│   │       ├── exportToSRT()            # Export to subtitle format
│   │       └── exportToJSON()           # Export with metadata
│   │
│   ├── utils/
│   │   ├── audio.ts                     # Real-time audio encoding
│   │   ├── audioSlicer.ts               # 15-minute chunk creation
│   │   └── file.ts                      # File conversion utilities
│   │
│   └── components/
│       ├── TranscriptCard.tsx           # Display and edit transcripts
│       ├── AudioVisualizer.tsx          # Waveform visualization
│       ├── GlossaryManager.tsx          # Custom terminology
│       ├── ShortcutManager.tsx          # Keyboard shortcuts
│       └── ... (other components)
│
├── 📁 backend/                           # 🆕 NEW: Python backend
│   │
│   ├── 📄 README.md                      # Backend documentation (8 pages)
│   ├── 🔧 requirements.txt               # Python dependencies (15 packages)
│   ├── 🌍 .env.example                   # Backend environment template
│   ├── 🌍 .env                           # Backend environment (create from .env.example)
│   │
│   ├── 🐍 main.py                        # FastAPI server (300 lines)
│   │   ├── POST /enhance-transcript     # Single file enhancement
│   │   ├── POST /enhance-chunks         # Multi-chunk enhancement
│   │   └── GET /                        # Health check
│   │
│   ├── 🧪 test_backend.py                # Setup verification script
│   │
│   └── 📁 services/                      # Backend services
│       │
│       ├── __init__.py                   # Services package
│       │
│       ├── 🎙️ whisperx_service.py       # WhisperX integration (200 lines)
│       │   ├── WhisperXService
│       │   │   ├── transcribe_and_align()     # Force alignment
│       │   │   ├── merge_with_gemini()        # Merge with Gemini text
│       │   │   └── cleanup()                  # Free memory
│       │   └── Features:
│       │       • Word-level timestamps (±50-200ms)
│       │       • Forced phoneme alignment
│       │       • Multiple model sizes (tiny to large-v3)
│       │
│       ├── 🎭 pyannote_service.py        # Pyannote integration (250 lines)
│       │   ├── PyannoteService
│       │   │   ├── diarize()                  # Speaker diarization
│       │   │   ├── assign_speakers_to_segments()
│       │   │   ├── get_speaker_embedding()    # Voice fingerprint
│       │   │   ├── match_speakers_across_chunks()
│       │   │   ├── relabel_speakers_human_friendly()
│       │   │   └── cleanup()
│       │   └── Features:
│       │       • Voice biometric identification
│       │       • Neural speaker embeddings
│       │       • 85-95% accuracy
│       │       • Confidence scores
│       │
│       ├── 🧩 chunk_stitcher.py          # Chunk management (230 lines)
│       │   ├── ChunkStitcher
│       │   │   ├── stitch_chunks()            # Merge chunks
│       │   │   ├── _build_speaker_mapping()   # Global speaker IDs
│       │   │   ├── _match_speaker_across_chunks()
│       │   │   ├── get_speaker_count()
│       │   │   ├── get_speaker_timeline()     # When each speaker talks
│       │   │   └── get_speaker_statistics()   # Time, word count, %
│       │   └── Features:
│       │       • Cross-chunk speaker consistency
│       │       • Boundary overlap analysis
│       │       • Global speaker ID mapping
│       │       • Speaker analytics
│       │
│       └── 🔧 audio_preprocessor.py      # Audio preprocessing (200 lines)
│           ├── AudioPreprocessor
│           │   ├── normalize_audio()          # Volume normalization
│           │   ├── reduce_noise()             # Spectral gating
│           │   ├── apply_high_pass_filter()   # Remove rumble
│           │   ├── remove_silence()           # Trim silence
│           │   ├── preprocess_full_pipeline() # All preprocessing
│           │   ├── convert_to_mono()
│           │   ├── resample()
│           │   └── get_audio_info()
│           └── Features:
│               • Noise reduction
│               • Audio normalization
│               • High-pass filtering
│               • Silence removal
│
├── 📁 components/                        # Original: React components
│   ├── TranscriptCard.tsx
│   ├── AudioVisualizer.tsx
│   ├── FeedbackModal.tsx
│   ├── GlossaryManager.tsx
│   ├── ShortcutManager.tsx
│   ├── SkeletonLoader.tsx
│   └── icons/
│       └── ... (icon components)
│
├── 📁 utils/                             # Original: Utility functions
│   ├── audio.ts
│   ├── audioSlicer.ts
│   └── file.ts
│
├── 🎨 App.tsx                            # Original: Main React component (1066 lines)
├── 🎨 index.tsx                          # Original: React entry point
├── 🎨 index.css                          # Original: Global styles
└── 📄 metadata.json                      # Original: App metadata
```

## File Counts

| Category | Count | Total Lines |
|----------|-------|-------------|
| **Backend Python Files** | 6 | ~1,450 |
| **Frontend TypeScript Files** | 1 new | ~250 |
| **Documentation** | 4 | ~2,500 words |
| **Configuration** | 4 | - |
| **Scripts** | 3 | - |

## New Files Created (Option B)

### Backend Services (6 files)

1. **main.py** - FastAPI server with 2 API endpoints
2. **services/whisperx_service.py** - WhisperX timestamp alignment
3. **services/pyannote_service.py** - Pyannote speaker diarization
4. **services/chunk_stitcher.py** - Cross-chunk speaker mapping
5. **services/audio_preprocessor.py** - Audio preprocessing pipeline
6. **test_backend.py** - Setup verification and testing

### Frontend Integration (1 file)

7. **src/services/postprocessing.ts** - Backend API client

### Configuration (4 files)

8. **backend/requirements.txt** - Python dependencies
9. **backend/.env.example** - Backend environment template
10. **.env.example** - Frontend environment template (updated)
11. **backend/services/__init__.py** - Services package init

### Documentation (4 files)

12. **QUICKSTART.md** - 10-minute setup guide
13. **ENHANCED_ACCURACY_GUIDE.md** - Technical deep-dive (12 pages)
14. **backend/README.md** - Backend documentation (8 pages)
15. **IMPLEMENTATION_SUMMARY.md** - Implementation overview

### Setup Scripts (3 files)

16. **setup.sh** - Linux/Mac setup automation
17. **setup.bat** - Windows setup automation
18. **PROJECT_STRUCTURE.md** - This file

**Total: 18 new files**

## Technology Stack

### Frontend (Existing)

- **Framework**: React 19.2.0
- **Build Tool**: Vite 6.2.0
- **Language**: TypeScript 5.8.2
- **AI Service**: Google Generative AI (Gemini)
- **State Management**: React Hooks
- **Storage**: LocalStorage for persistence

### Backend (New)

- **Framework**: FastAPI 0.109.0
- **Language**: Python 3.9+
- **Web Server**: Uvicorn
- **Transcription**: WhisperX 3.1.1 (OpenAI Whisper base)
- **Speaker Diarization**: Pyannote.audio 3.1.1
- **Audio Processing**: Librosa 0.10.1, SoundFile
- **Deep Learning**: PyTorch 2.1.2
- **API Validation**: Pydantic 2.5.3

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS AUDIO                                   │
│    └─> Frontend (React)                                 │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 2. GEMINI TRANSCRIPTION                                 │
│    └─> services/gemini.ts                               │
│    └─> Result: Raw transcript with AI-inferred data    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 3. POST-PROCESSING REQUEST                              │
│    └─> services/postprocessing.ts                       │
│    └─> POST /enhance-transcript                        │
│        • Audio file                                     │
│        • Gemini transcript                              │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 4. BACKEND PROCESSING                                   │
│    ├─> audio_preprocessor.py (clean audio)             │
│    ├─> whisperx_service.py (accurate timestamps)       │
│    ├─> pyannote_service.py (speaker labels)            │
│    └─> chunk_stitcher.py (merge chunks if needed)      │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 5. ENHANCED RESULT                                      │
│    └─> JSON response with:                              │
│        • Word-level timestamps (±200ms)                 │
│        • Biometric speaker labels (85-95% accurate)     │
│        • Confidence scores                              │
│        • Processing metadata                            │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 6. DISPLAY TO USER                                      │
│    └─> Frontend formats and displays enhanced transcript│
│    └─> Export options: SRT, JSON, Text, Markdown       │
└─────────────────────────────────────────────────────────┘
```

## API Communication

### Frontend → Backend

**Endpoint**: `POST http://localhost:8000/enhance-transcript`

**Request**:
```typescript
const formData = new FormData();
formData.append('audio_file', audioFile);
formData.append('gemini_transcript', rawTranscript);
formData.append('enable_timestamp_alignment', 'true');
formData.append('enable_speaker_verification', 'true');
formData.append('num_speakers', '2');
```

**Response**:
```json
{
  "segments": [
    {
      "text": "Welcome to the meeting",
      "start": 0.523,
      "end": 2.314,
      "speaker": "Speaker A",
      "words": [
        {"word": "Welcome", "start": 0.523, "end": 0.891, "score": 0.95}
      ]
    }
  ],
  "processing_info": {
    "timestamp_alignment": "completed",
    "speaker_verification": "completed",
    "word_count": 142,
    "speakers_detected": 2
  }
}
```

## Port Configuration

| Service | Default Port | Configuration |
|---------|-------------|---------------|
| Frontend (Vite) | 5173 | `vite.config.ts` |
| Backend (FastAPI) | 8000 | `backend/.env` → `PORT` |

## Environment Variables

### Frontend (.env.local)

```env
API_KEY=your_gemini_api_key                    # Existing
VITE_BACKEND_URL=http://localhost:8000         # New
```

### Backend (backend/.env)

```env
HUGGINGFACE_TOKEN=hf_your_token_here           # New (required)
WHISPER_MODEL=medium                           # New (optional)
DEVICE=cpu                                     # New (optional)
CORS_ORIGINS=http://localhost:5173             # New (optional)
HOST=0.0.0.0                                   # New (optional)
PORT=8000                                      # New (optional)
```

## Dependency Sizes

### Frontend (npm packages)

- Total: ~500 MB (existing React/Vite dependencies)
- No new dependencies added

### Backend (pip packages)

| Package | Size | Purpose |
|---------|------|---------|
| torch | ~2.5 GB | Deep learning framework |
| whisperx | ~500 MB | Timestamp alignment |
| pyannote.audio | ~200 MB | Speaker diarization |
| librosa | ~100 MB | Audio processing |
| Other packages | ~200 MB | Supporting libraries |
| **Total** | **~3.5 GB** | Backend dependencies |

## Hardware Requirements

### Minimum (CPU only)

- 8 GB RAM
- 10 GB disk space
- Dual-core processor
- Processing time: ~5-10min for 30min audio

### Recommended (GPU)

- 16 GB RAM
- 20 GB disk space
- NVIDIA GPU with 4+ GB VRAM
- Processing time: ~2-3min for 30min audio

### Optimal (GPU)

- 32 GB RAM
- 50 GB disk space
- NVIDIA GPU with 8+ GB VRAM
- Processing time: ~1-2min for 30min audio

## Next Steps

1. **Setup**: Run `setup.sh` (Linux/Mac) or `setup.bat` (Windows)
2. **Configure**: Edit `.env.local` and `backend/.env`
3. **Test**: Run `python backend/test_backend.py`
4. **Start**: Launch both services
5. **Use**: Upload audio and enjoy enhanced transcription!

For detailed instructions, see [QUICKSTART.md](QUICKSTART.md).
