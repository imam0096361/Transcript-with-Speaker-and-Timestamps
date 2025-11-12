# Transcript Studio AI - Post-Processing Backend

Enhanced transcription backend using **WhisperX** for accurate timestamps and **Pyannote** for speaker diarization.

## Features

- **Word-Level Timestamps**: WhisperX provides millisecond-accurate timestamps
- **Speaker Diarization**: Pyannote.audio identifies and labels speakers with high accuracy
- **Chunk Stitching**: Maintains speaker consistency across long audio files
- **Audio Preprocessing**: Noise reduction, normalization, and filtering
- **Gemini Integration**: Merges Gemini's superior transcription quality with WhisperX's timing

## Architecture

```
┌───────────────────────────────────────────┐
│         Frontend (React + Gemini)          │
│  • Initial transcription with Gemini      │
│  • Upload audio + transcript to backend   │
└──────────────┬────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────┐
│      Backend (FastAPI + WhisperX)         │
│  1. Audio Preprocessing                   │
│     - Noise reduction                     │
│     - Normalization                       │
│     - High-pass filtering                 │
│                                           │
│  2. WhisperX Timestamp Alignment          │
│     - Transcribe audio                    │
│     - Force-align words to audio          │
│     - Extract word-level timestamps       │
│                                           │
│  3. Pyannote Speaker Diarization          │
│     - Identify speaker segments           │
│     - Assign speaker labels               │
│     - Cross-chunk speaker matching        │
│                                           │
│  4. Merge Results                         │
│     - Combine Gemini text quality         │
│     - With WhisperX timing accuracy       │
│     - With Pyannote speaker labels        │
└───────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.9 or higher
- CUDA GPU (optional, but recommended for faster processing)
- Hugging Face account (for Pyannote models)

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Accept Pyannote Model Licenses

1. Create a Hugging Face account: https://huggingface.co/join
2. Generate an access token: https://huggingface.co/settings/tokens
3. Accept the license agreements for:
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your Hugging Face token:

```env
HUGGINGFACE_TOKEN=hf_your_token_here
WHISPER_MODEL=medium
DEVICE=cuda  # or cpu
CORS_ORIGINS=http://localhost:5173
HOST=0.0.0.0
PORT=8000
```

### Step 4: Run the Server

```bash
python main.py
```

The server will start at `http://localhost:8000`

## API Endpoints

### Health Check

```http
GET /
```

**Response:**
```json
{
  "status": "online",
  "services": {
    "whisperx": true,
    "pyannote": true
  }
}
```

### Enhance Single Audio

```http
POST /enhance-transcript
```

**Parameters:**
- `audio_file` (file): Original audio file
- `gemini_transcript` (string): Raw transcript from Gemini
- `enable_timestamp_alignment` (boolean): Use WhisperX
- `enable_speaker_verification` (boolean): Use Pyannote
- `num_speakers` (int, optional): Expected number of speakers

**Response:**
```json
{
  "segments": [
    {
      "text": "Welcome to the presentation",
      "start": 0.5,
      "end": 2.3,
      "speaker": "Speaker A",
      "words": [
        {"word": "Welcome", "start": 0.5, "end": 0.9},
        {"word": "to", "start": 1.0, "end": 1.1},
        {"word": "the", "start": 1.15, "end": 1.3},
        {"word": "presentation", "start": 1.4, "end": 2.3}
      ]
    }
  ],
  "processing_info": {
    "timestamp_alignment": "completed",
    "speaker_verification": "completed",
    "word_count": 4,
    "speakers_detected": 2
  }
}
```

### Enhance Multiple Chunks

```http
POST /enhance-chunks
```

**Parameters:**
- `audio_chunks[]` (files): List of audio chunk files
- `gemini_transcripts[]` (strings): List of transcripts for each chunk
- `enable_timestamp_alignment` (boolean)
- `enable_speaker_verification` (boolean)

**Response:**
Same format as `/enhance-transcript`, but with merged segments and global speaker IDs.

## Model Selection

### WhisperX Models

| Model | Size | Accuracy | Speed | Recommended For |
|-------|------|----------|-------|-----------------|
| `tiny` | 39M | Low | Very Fast | Testing only |
| `base` | 74M | Fair | Fast | Quick processing |
| `small` | 244M | Good | Medium | General use |
| `medium` | 769M | Very Good | Slow | **Recommended** |
| `large-v2` | 1550M | Excellent | Very Slow | High accuracy needs |
| `large-v3` | 1550M | Best | Very Slow | Maximum accuracy |

Set in `.env`:
```env
WHISPER_MODEL=medium
```

### Device Selection

- **CPU**: Works on any machine, slower processing
- **CUDA**: Requires NVIDIA GPU, 5-10x faster
- **MPS**: Apple Silicon (M1/M2), 3-5x faster

Set in `.env`:
```env
DEVICE=cuda  # or cpu, or mps
```

## Performance Optimization

### GPU Memory

WhisperX and Pyannote can be memory-intensive. Approximate GPU memory requirements:

| Model | GPU Memory |
|-------|------------|
| Whisper medium + Pyannote | ~4GB |
| Whisper large + Pyannote | ~8GB |

### Processing Time

Approximate processing times (on RTX 3080):

| Audio Duration | Whisper Medium | Pyannote | Total |
|----------------|----------------|----------|-------|
| 5 minutes | 20 seconds | 15 seconds | ~35s |
| 15 minutes | 1 minute | 45 seconds | ~1.75min |
| 1 hour | 4 minutes | 3 minutes | ~7min |

### CPU-Only Mode

If you don't have a GPU:

```env
DEVICE=cpu
WHISPER_MODEL=small  # Use smaller model for reasonable speed
```

Expect processing to take ~3-5x longer than GPU.

## Troubleshooting

### Issue: Out of Memory

**Solution:** Use a smaller Whisper model:
```env
WHISPER_MODEL=small
```

### Issue: Pyannote authentication failed

**Solution:**
1. Verify your HF token is correct
2. Ensure you accepted the model licenses
3. Check token has read permissions

### Issue: CUDA not available

**Solution:**
1. Install PyTorch with CUDA support:
   ```bash
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```
2. Verify CUDA installation:
   ```python
   import torch
   print(torch.cuda.is_available())
   ```

### Issue: Speaker labels inconsistent across chunks

**Solution:** This is a known limitation. The chunk stitcher uses boundary overlap analysis. For better results:
- Ensure clean audio with minimal background noise
- Have clear speaker transitions
- Consider manual speaker label correction

## Advanced Usage

### Custom Preprocessing Pipeline

You can customize audio preprocessing in `services/audio_preprocessor.py`:

```python
preprocessor.preprocess_full_pipeline(
    audio_path,
    apply_noise_reduction=True,   # Remove background noise
    apply_normalization=True,      # Normalize volume
    apply_high_pass=True,          # Remove low-frequency rumble
    remove_long_silence=False      # Keep silences for timestamp accuracy
)
```

### Speaker Embedding Comparison

For improved cross-chunk speaker matching, implement speaker embedding similarity in `services/pyannote_service.py`:

```python
embedding1 = pyannote_service.get_speaker_embedding(audio1, start, end)
embedding2 = pyannote_service.get_speaker_embedding(audio2, start, end)
similarity = cosine_similarity(embedding1, embedding2)
```

## Integration with Frontend

Add to your frontend `.env`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Then use the post-processing service:

```typescript
import { enhanceTranscript } from './services/postprocessing';

const result = await enhanceTranscript(
  audioFile,
  geminiTranscript,
  {
    enableTimestampAlignment: true,
    enableSpeakerVerification: true,
    numSpeakers: 2
  },
  (message) => console.log(message)
);
```

## License

This backend uses:
- **WhisperX**: Apache 2.0 License
- **Pyannote.audio**: MIT License
- **OpenAI Whisper**: MIT License

Ensure compliance with Pyannote's user conditions: https://github.com/pyannote/pyannote-audio#citation

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review WhisperX documentation: https://github.com/m-bain/whisperX
3. Review Pyannote documentation: https://github.com/pyannote/pyannote-audio
