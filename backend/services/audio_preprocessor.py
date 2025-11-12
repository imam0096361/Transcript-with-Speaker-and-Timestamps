"""
Audio preprocessing utilities for improved transcription quality.
Provides noise reduction, normalization, and format conversion.
"""

import os
import tempfile
import numpy as np
import soundfile as sf
import librosa
from scipy import signal
from typing import Optional


class AudioPreprocessor:
    """Audio preprocessing for cleaner transcription input."""

    def __init__(self, target_sr: int = 16000):
        """
        Initialize audio preprocessor.

        Args:
            target_sr: Target sample rate (16kHz is standard for speech)
        """
        self.target_sr = target_sr

    def normalize_audio(
        self,
        audio_path: str,
        target_db: float = -20.0
    ) -> str:
        """
        Normalize audio volume to consistent level.

        Args:
            audio_path: Path to input audio file
            target_db: Target loudness in dB

        Returns:
            Path to normalized audio file
        """
        # Load audio
        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)

        # Calculate current RMS
        rms = np.sqrt(np.mean(audio ** 2))

        if rms > 0:
            # Calculate scaling factor
            current_db = 20 * np.log10(rms)
            scale = 10 ** ((target_db - current_db) / 20)

            # Apply normalization
            audio_normalized = audio * scale

            # Prevent clipping
            audio_normalized = np.clip(audio_normalized, -1.0, 1.0)
        else:
            audio_normalized = audio

        # Save to temporary file
        temp_path = self._save_temp_audio(audio_normalized, sr)

        return temp_path

    def reduce_noise(
        self,
        audio_path: str,
        noise_profile_duration: float = 1.0
    ) -> str:
        """
        Apply noise reduction using spectral gating.

        Args:
            audio_path: Path to input audio file
            noise_profile_duration: Duration in seconds to use for noise profile

        Returns:
            Path to noise-reduced audio file
        """
        # Load audio
        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)

        # Use first N seconds as noise profile
        noise_sample_length = int(noise_profile_duration * sr)
        noise_profile = audio[:noise_sample_length]

        # Compute noise spectrum
        noise_fft = np.fft.rfft(noise_profile)
        noise_power = np.abs(noise_fft) ** 2

        # Process full audio in frames
        frame_length = 2048
        hop_length = 512

        # STFT
        stft = librosa.stft(audio, n_fft=frame_length, hop_length=hop_length)
        magnitude = np.abs(stft)
        phase = np.angle(stft)

        # Apply spectral gating
        noise_threshold = np.mean(noise_power) * 1.5  # Adjust sensitivity

        # Create mask
        mask = magnitude > noise_threshold
        magnitude_cleaned = magnitude * mask

        # Reconstruct
        stft_cleaned = magnitude_cleaned * np.exp(1j * phase)
        audio_cleaned = librosa.istft(stft_cleaned, hop_length=hop_length)

        # Save to temporary file
        temp_path = self._save_temp_audio(audio_cleaned, sr)

        return temp_path

    def apply_high_pass_filter(
        self,
        audio_path: str,
        cutoff_freq: int = 80
    ) -> str:
        """
        Apply high-pass filter to remove low-frequency rumble.

        Args:
            audio_path: Path to input audio file
            cutoff_freq: Cutoff frequency in Hz (typical: 80-100 Hz for speech)

        Returns:
            Path to filtered audio file
        """
        # Load audio
        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)

        # Design high-pass filter
        nyquist = sr / 2
        normal_cutoff = cutoff_freq / nyquist

        # Butterworth filter (4th order)
        b, a = signal.butter(4, normal_cutoff, btype='high', analog=False)

        # Apply filter
        audio_filtered = signal.filtfilt(b, a, audio)

        # Save to temporary file
        temp_path = self._save_temp_audio(audio_filtered, sr)

        return temp_path

    def remove_silence(
        self,
        audio_path: str,
        top_db: int = 30,
        min_silence_duration: float = 0.5
    ) -> str:
        """
        Remove long silent sections from audio.

        Args:
            audio_path: Path to input audio file
            top_db: Threshold in dB below reference to consider as silence
            min_silence_duration: Minimum duration of silence to remove (seconds)

        Returns:
            Path to audio file with silence removed
        """
        # Load audio
        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)

        # Split on silence
        intervals = librosa.effects.split(
            audio,
            top_db=top_db,
            frame_length=2048,
            hop_length=512
        )

        # Concatenate non-silent sections
        audio_segments = []

        for start, end in intervals:
            # Check if gap is significant
            segment = audio[start:end]
            audio_segments.append(segment)

            # Add small padding between segments
            padding = np.zeros(int(0.1 * sr))  # 100ms padding
            audio_segments.append(padding)

        # Combine all segments
        audio_trimmed = np.concatenate(audio_segments) if audio_segments else audio

        # Save to temporary file
        temp_path = self._save_temp_audio(audio_trimmed, sr)

        return temp_path

    def preprocess_full_pipeline(
        self,
        audio_path: str,
        apply_noise_reduction: bool = True,
        apply_normalization: bool = True,
        apply_high_pass: bool = True,
        remove_long_silence: bool = False
    ) -> str:
        """
        Apply full preprocessing pipeline.

        Args:
            audio_path: Path to input audio file
            apply_noise_reduction: Apply noise reduction
            apply_normalization: Apply volume normalization
            apply_high_pass: Apply high-pass filter
            remove_long_silence: Remove silent sections

        Returns:
            Path to fully preprocessed audio file
        """
        processed_path = audio_path

        # Step 1: High-pass filter (remove rumble)
        if apply_high_pass:
            print("🔧 Applying high-pass filter...")
            processed_path = self.apply_high_pass_filter(processed_path)

        # Step 2: Noise reduction
        if apply_noise_reduction:
            print("🔧 Reducing background noise...")
            processed_path = self.reduce_noise(processed_path)

        # Step 3: Normalize volume
        if apply_normalization:
            print("🔧 Normalizing audio volume...")
            processed_path = self.normalize_audio(processed_path)

        # Step 4: Remove silence (optional, can affect timestamps)
        if remove_long_silence:
            print("🔧 Removing long silent sections...")
            processed_path = self.remove_silence(processed_path)

        return processed_path

    def convert_to_mono(self, audio_path: str) -> str:
        """
        Convert stereo audio to mono.

        Args:
            audio_path: Path to input audio file

        Returns:
            Path to mono audio file
        """
        # Load audio
        audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)

        # Save to temporary file
        temp_path = self._save_temp_audio(audio, sr)

        return temp_path

    def resample(self, audio_path: str, target_sr: Optional[int] = None) -> str:
        """
        Resample audio to target sample rate.

        Args:
            audio_path: Path to input audio file
            target_sr: Target sample rate (uses default if None)

        Returns:
            Path to resampled audio file
        """
        sr = target_sr or self.target_sr

        # Load and resample
        audio, _ = librosa.load(audio_path, sr=sr, mono=True)

        # Save to temporary file
        temp_path = self._save_temp_audio(audio, sr)

        return temp_path

    def _save_temp_audio(self, audio: np.ndarray, sr: int) -> str:
        """
        Save audio array to temporary WAV file.

        Args:
            audio: Audio data as numpy array
            sr: Sample rate

        Returns:
            Path to temporary file
        """
        temp_fd, temp_path = tempfile.mkstemp(suffix=".wav")
        os.close(temp_fd)

        # Save as WAV
        sf.write(temp_path, audio, sr)

        return temp_path

    def get_audio_info(self, audio_path: str) -> dict:
        """
        Get audio file information.

        Args:
            audio_path: Path to audio file

        Returns:
            Dictionary with audio metadata
        """
        info = sf.info(audio_path)

        return {
            "duration": info.duration,
            "sample_rate": info.samplerate,
            "channels": info.channels,
            "format": info.format,
            "subtype": info.subtype
        }
