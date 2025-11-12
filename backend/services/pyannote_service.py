"""
Pyannote service for speaker diarization.
Identifies and labels different speakers in audio with high accuracy.
"""

import torch
from pyannote.audio import Pipeline
from typing import Dict, List, Any, Optional


class PyannoteService:
    """Service for speaker diarization using Pyannote.audio."""

    def __init__(self, hf_token: str, device: str = "cpu"):
        """
        Initialize Pyannote service.

        Args:
            hf_token: Hugging Face authentication token
            device: Device to run on (cpu, cuda)

        Note:
            You must accept the license agreements for:
            - pyannote/speaker-diarization-3.1
            - pyannote/segmentation-3.0
            at https://huggingface.co/pyannote
        """
        self.device = torch.device(device)

        print(f"📥 Loading Pyannote speaker diarization model on {device}...")

        # Load pre-trained speaker diarization pipeline
        self.pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token
        )

        # Move to device
        if device == "cuda" and torch.cuda.is_available():
            self.pipeline = self.pipeline.to(self.device)

        print(f"✅ Pyannote model loaded successfully")

    def diarize(
        self,
        audio_path: str,
        num_speakers: Optional[int] = None,
        min_speakers: int = 1,
        max_speakers: int = 10
    ) -> Dict[str, Any]:
        """
        Perform speaker diarization on audio file.

        Args:
            audio_path: Path to audio file
            num_speakers: Expected number of speakers (None for auto-detection)
            min_speakers: Minimum number of speakers
            max_speakers: Maximum number of speakers

        Returns:
            Dictionary with speaker timeline and labels
        """
        print(f"🎭 Running speaker diarization...")

        # Run diarization
        if num_speakers:
            diarization = self.pipeline(
                audio_path,
                num_speakers=num_speakers
            )
        else:
            diarization = self.pipeline(
                audio_path,
                min_speakers=min_speakers,
                max_speakers=max_speakers
            )

        # Extract speaker segments
        timeline = []
        speakers = set()

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            timeline.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker,
                "duration": turn.end - turn.start
            })
            speakers.add(speaker)

        # Sort by start time
        timeline.sort(key=lambda x: x["start"])

        return {
            "timeline": timeline,
            "num_speakers": len(speakers),
            "speakers": sorted(list(speakers)),
            "total_speech_time": sum(seg["duration"] for seg in timeline)
        }

    def assign_speakers_to_segments(
        self,
        segments: List[Dict],
        diarization: Dict
    ) -> List[Dict]:
        """
        Assign speaker labels to transcript segments based on diarization.

        Args:
            segments: List of transcript segments with start/end times
            diarization: Diarization result from diarize()

        Returns:
            Segments with speaker labels assigned
        """
        timeline = diarization["timeline"]

        for segment in segments:
            if segment.get("start") is None:
                continue

            # Find overlapping speaker using segment midpoint
            seg_start = segment["start"]
            seg_end = segment.get("end", seg_start)
            mid_time = (seg_start + seg_end) / 2

            # Find speaker with highest overlap
            best_speaker = None
            max_overlap = 0

            for spk_seg in timeline:
                overlap_start = max(seg_start, spk_seg["start"])
                overlap_end = min(seg_end, spk_seg["end"])
                overlap = max(0, overlap_end - overlap_start)

                if overlap > max_overlap:
                    max_overlap = overlap
                    best_speaker = spk_seg["speaker"]

            if best_speaker:
                segment["speaker"] = best_speaker

        return segments

    def get_speaker_embedding(
        self,
        audio_path: str,
        start_time: float,
        end_time: float
    ) -> torch.Tensor:
        """
        Extract speaker embedding from audio segment.
        Useful for cross-chunk speaker matching.

        Args:
            audio_path: Path to audio file
            start_time: Start time in seconds
            end_time: End time in seconds

        Returns:
            Speaker embedding tensor
        """
        from pyannote.audio import Inference

        # Load embedding model
        embedding_model = Inference(
            "pyannote/embedding",
            use_auth_token=self.pipeline.use_auth_token,
            device=self.device
        )

        # Extract embedding from time segment
        from pyannote.core import Segment
        segment = Segment(start_time, end_time)

        embedding = embedding_model.crop(audio_path, segment)

        return embedding

    def match_speakers_across_chunks(
        self,
        chunk_diarizations: List[Dict],
        threshold: float = 0.75
    ) -> Dict[str, str]:
        """
        Create global speaker mapping across multiple audio chunks.

        Strategy:
        - Compare speaker embeddings at chunk boundaries
        - Match speakers with high similarity across chunks
        - Create global speaker ID mapping

        Args:
            chunk_diarizations: List of diarization results for each chunk
            threshold: Similarity threshold for matching speakers

        Returns:
            Mapping from (chunk_idx, local_speaker) to global_speaker
        """
        # Simplified version - assumes speakers maintain consistency
        # For production, use speaker embedding comparison

        global_mapping = {}
        next_global_id = 0

        for chunk_idx, diarization in enumerate(chunk_diarizations):
            local_speakers = diarization.get("speakers", [])

            for local_speaker in local_speakers:
                key = f"chunk_{chunk_idx}_{local_speaker}"

                # Assign global speaker ID
                # TODO: Implement embedding-based matching for better accuracy
                global_speaker = f"Speaker {chr(65 + next_global_id)}"  # A, B, C, ...
                global_mapping[key] = global_speaker
                next_global_id += 1

        return global_mapping

    def relabel_speakers_human_friendly(
        self,
        segments: List[Dict]
    ) -> List[Dict]:
        """
        Convert Pyannote speaker labels (SPEAKER_00, SPEAKER_01)
        to human-friendly labels (Speaker A, Speaker B).

        Args:
            segments: Segments with Pyannote speaker labels

        Returns:
            Segments with human-friendly labels
        """
        # Build mapping from Pyannote labels to friendly labels
        unique_speakers = []
        for seg in segments:
            speaker = seg.get("speaker")
            if speaker and speaker not in unique_speakers:
                unique_speakers.append(speaker)

        # Sort for consistency
        unique_speakers.sort()

        # Create mapping
        speaker_map = {
            spk: f"Speaker {chr(65 + idx)}"  # A, B, C, ...
            for idx, spk in enumerate(unique_speakers)
        }

        # Apply mapping
        for seg in segments:
            if seg.get("speaker"):
                seg["speaker"] = speaker_map.get(seg["speaker"], seg["speaker"])

        return segments

    def cleanup(self):
        """Free up memory."""
        if hasattr(self, 'pipeline'):
            del self.pipeline
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
