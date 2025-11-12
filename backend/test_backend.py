#!/usr/bin/env python3
"""
Simple test script to verify backend setup.
Run this to check if all services are properly initialized.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_imports():
    """Test if all required packages are installed."""
    print("📦 Testing package imports...")

    packages = [
        ('whisperx', 'WhisperX'),
        ('pyannote.audio', 'Pyannote.audio'),
        ('torch', 'PyTorch'),
        ('fastapi', 'FastAPI'),
        ('librosa', 'Librosa'),
        ('soundfile', 'SoundFile'),
        ('numpy', 'NumPy'),
    ]

    success = True
    for package, name in packages:
        try:
            __import__(package)
            print(f"  ✅ {name}")
        except ImportError as e:
            print(f"  ❌ {name} - Not installed")
            print(f"     Error: {e}")
            success = False

    return success


def test_environment():
    """Test if environment variables are set."""
    print("\n🔧 Testing environment configuration...")

    required_vars = {
        'HUGGINGFACE_TOKEN': 'Hugging Face authentication token',
        'WHISPER_MODEL': 'Whisper model size',
        'DEVICE': 'Processing device (cpu/cuda/mps)',
    }

    success = True
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value and value != f'your_{var.lower()}_here':
            print(f"  ✅ {var}: {value}")
        else:
            print(f"  ❌ {var}: Not set - {description}")
            success = False

    return success


def test_whisperx():
    """Test WhisperX initialization."""
    print("\n🎙️ Testing WhisperX service...")

    try:
        from services.whisperx_service import WhisperXService

        model_size = os.getenv('WHISPER_MODEL', 'tiny')
        device = os.getenv('DEVICE', 'cpu')

        print(f"  Loading model: {model_size} on {device}")
        service = WhisperXService(model_size=model_size, device=device)

        print(f"  ✅ WhisperX initialized successfully")

        # Cleanup
        service.cleanup()
        return True

    except Exception as e:
        print(f"  ❌ WhisperX initialization failed")
        print(f"     Error: {e}")
        return False


def test_pyannote():
    """Test Pyannote initialization."""
    print("\n🎭 Testing Pyannote service...")

    try:
        from services.pyannote_service import PyannoteService

        hf_token = os.getenv('HUGGINGFACE_TOKEN')
        if not hf_token or hf_token == 'your_hf_token_here':
            print(f"  ⚠️  Skipping - HUGGINGFACE_TOKEN not set")
            return None

        device = os.getenv('DEVICE', 'cpu')

        print(f"  Loading diarization model on {device}")
        service = PyannoteService(hf_token=hf_token, device=device)

        print(f"  ✅ Pyannote initialized successfully")

        # Cleanup
        service.cleanup()
        return True

    except Exception as e:
        print(f"  ❌ Pyannote initialization failed")
        print(f"     Error: {e}")
        print(f"\n     Common issues:")
        print(f"     1. Invalid Hugging Face token")
        print(f"     2. Model licenses not accepted")
        print(f"        - https://huggingface.co/pyannote/speaker-diarization-3.1")
        print(f"        - https://huggingface.co/pyannote/segmentation-3.0")
        return False


def test_cuda():
    """Test CUDA availability if device is set to cuda."""
    print("\n🖥️ Testing CUDA availability...")

    device = os.getenv('DEVICE', 'cpu')

    if device != 'cuda':
        print(f"  ℹ️  Device set to '{device}', skipping CUDA test")
        return None

    try:
        import torch

        if torch.cuda.is_available():
            print(f"  ✅ CUDA available")
            print(f"     GPU: {torch.cuda.get_device_name(0)}")
            print(f"     CUDA Version: {torch.version.cuda}")
            print(f"     Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
            return True
        else:
            print(f"  ❌ CUDA not available")
            print(f"     Your device is set to 'cuda' but PyTorch cannot access GPU")
            print(f"     Change DEVICE to 'cpu' in .env or install CUDA-enabled PyTorch")
            return False

    except Exception as e:
        print(f"  ❌ CUDA test failed: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("🧪 Transcript Studio AI - Backend Test Suite")
    print("=" * 60)

    results = {
        'imports': test_imports(),
        'environment': test_environment(),
        'cuda': test_cuda(),
        'whisperx': test_whisperx(),
        'pyannote': test_pyannote(),
    }

    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)

    for test_name, result in results.items():
        if result is True:
            status = "✅ PASS"
        elif result is False:
            status = "❌ FAIL"
        else:
            status = "⚠️  SKIP"

        print(f"  {test_name.ljust(15)}: {status}")

    # Determine overall status
    failures = sum(1 for r in results.values() if r is False)

    print("=" * 60)

    if failures == 0:
        print("✅ All tests passed! Backend is ready to use.")
        print("\nNext steps:")
        print("  1. Start the backend: python main.py")
        print("  2. Test the API: curl http://localhost:8000/")
        return 0
    else:
        print(f"❌ {failures} test(s) failed. Please fix the issues above.")
        print("\nTroubleshooting:")
        print("  1. Check that all dependencies are installed: pip install -r requirements.txt")
        print("  2. Verify .env file is configured correctly")
        print("  3. For Pyannote issues, ensure you:")
        print("     - Have a valid Hugging Face token")
        print("     - Accepted the model licenses")
        return 1


if __name__ == '__main__':
    sys.exit(main())
