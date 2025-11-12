# Quick Start Guide: Enhanced Transcription

Get started with 100% accurate timestamps and speaker labels in 10 minutes.

## Prerequisites

- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- Hugging Face account (free)
- (Optional) NVIDIA GPU for faster processing

## Setup Steps

### 1. Frontend Setup (3 minutes)

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local and add your Gemini API key
# Get it from: https://aistudio.google.com/app/apikey
nano .env.local
```

Add to `.env.local`:
```env
API_KEY=your_gemini_api_key_here
VITE_BACKEND_URL=http://localhost:8000
```

### 2. Backend Setup (5 minutes)

```bash
# Navigate to backend
cd backend

# Install Python dependencies (this may take a few minutes)
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env and add your Hugging Face token
nano .env
```

#### Get Hugging Face Token:

1. **Create account**: https://huggingface.co/join
2. **Generate token**: https://huggingface.co/settings/tokens (click "New token", select "Read")
3. **Accept licenses**:
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0

Add to `backend/.env`:
```env
HUGGINGFACE_TOKEN=hf_your_token_here
WHISPER_MODEL=medium
DEVICE=cpu  # or cuda if you have GPU
CORS_ORIGINS=http://localhost:5173
```

### 3. Start Both Services (2 minutes)

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```

You should see:
```
🚀 Initializing services...
📥 Loading WhisperX model: medium on cpu...
✅ WhisperX service initialized
📥 Loading Pyannote speaker diarization model on cpu...
✅ Pyannote model loaded successfully
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

You should see:
```
  VITE v6.2.0  ready in 500 ms

  ➜  Local:   http://localhost:5173/
```

### 4. Test It! (2 minutes)

1. Open http://localhost:5173/
2. Upload a short audio file (2-5 minutes recommended for first test)
3. Enable "Speaker Labels" checkbox
4. Click "Upload & Transcribe"
5. Wait for processing (will show progress)
6. View enhanced transcript with accurate timestamps and speaker labels!

## Verification

### Check Backend is Working

```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "status": "online",
  "services": {
    "whisperx": true,
    "pyannote": true
  }
}
```

### Check Frontend Connection

Open browser console (F12) and check for:
```
✅ Backend connection: Available
✅ WhisperX: Online
✅ Pyannote: Online
```

## Common Issues

### Backend fails to start

**Issue**: `ModuleNotFoundError: No module named 'whisperx'`

**Solution**:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

**Issue**: `Invalid Hugging Face token`

**Solution**:
1. Verify token at https://huggingface.co/settings/tokens
2. Ensure you accepted both model licenses
3. Token should start with `hf_`

---

**Issue**: `CUDA not available`

**Solution**: Change `.env` to use CPU:
```env
DEVICE=cpu
WHISPER_MODEL=small  # Use smaller model for CPU
```

### Frontend can't connect to backend

**Issue**: `Network error` or `CORS error`

**Solution**:
1. Verify backend is running on port 8000
2. Check `VITE_BACKEND_URL` in `.env.local` matches backend URL
3. Restart both services

## Next Steps

### Improve Processing Speed

If you have an NVIDIA GPU:

```bash
# Install CUDA-enabled PyTorch
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Update backend/.env
DEVICE=cuda
WHISPER_MODEL=medium
```

Expected speedup: **5-10x faster**

### Improve Accuracy

For maximum accuracy:

```env
# In backend/.env
WHISPER_MODEL=large-v3  # Best accuracy, slower
DEVICE=cuda             # Recommended for large models
```

### Test with Long Audio

The system automatically chunks long audio files:

1. Upload a 1-2 hour audio file
2. Enable "Speaker Labels"
3. System will process in 15-minute chunks
4. Speakers will be matched across chunks automatically!

## Usage Tips

### Best Practices

✅ **DO:**
- Use high-quality audio (16kHz+, clear voices)
- Enable both timestamp alignment and speaker verification
- Provide expected speaker count for better accuracy
- Use GPU for files > 30 minutes

❌ **DON'T:**
- Upload extremely noisy audio (preprocess first)
- Disable preprocessing for poor-quality audio
- Expect perfect accuracy with overlapping speech
- Use `large-v3` model on CPU (too slow)

### Optimal Settings

| Audio Type | Whisper Model | Device | Expected Time (30min audio) |
|------------|---------------|--------|----------------------------|
| Meeting (2-3 speakers) | medium | GPU | ~3 minutes |
| Podcast (2 speakers) | medium | GPU | ~3 minutes |
| Interview (1-2 speakers) | large-v3 | GPU | ~5 minutes |
| Conference (5+ speakers) | medium | GPU | ~4 minutes |
| Noisy environment | small | CPU | ~20 minutes |

## Resources

- **Full Documentation**: See `ENHANCED_ACCURACY_GUIDE.md`
- **Backend Details**: See `backend/README.md`
- **Troubleshooting**: See backend README troubleshooting section
- **WhisperX GitHub**: https://github.com/m-bain/whisperX
- **Pyannote GitHub**: https://github.com/pyannote/pyannote-audio

## Support

If you encounter issues:

1. Check `ENHANCED_ACCURACY_GUIDE.md` for detailed explanations
2. Check backend logs for error messages
3. Verify all dependencies are installed correctly
4. Test with a short (2-3 minute) audio file first

Enjoy your enhanced transcription with accurate timestamps and speaker labels! 🎙️
