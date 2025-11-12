"""
Chunk stitcher for maintaining speaker consistency across audio chunks.
Ensures Speaker A in chunk 1 is the same person as Speaker A in chunk 2.
"""

from typing import List, Dict, Any
import numpy as np


class ChunkStitcher:
    """Stitches multiple audio chunks with global speaker mapping."""

    def __init__(self):
        """Initialize chunk stitcher."""
        self.global_speaker_map = {}
        self.next_global_id = 0

    def stitch_chunks(self, chunk_results: List[Dict]) -> List[Dict]:
        """
        Merge multiple chunk results into single transcript with consistent speakers.

        Args:
            chunk_results: List of dictionaries containing:
                - chunk_index: Index of chunk
                - segments: List of transcript segments
                - duration: Duration of chunk in seconds

        Returns:
            Single merged list of segments with consistent global speaker IDs
        """
        if not chunk_results:
            return []

        # Build global speaker mapping
        self._build_speaker_mapping(chunk_results)

        # Merge segments with time offset and global speakers
        merged_segments = []
        time_offset = 0.0

        for chunk in chunk_results:
            chunk_idx = chunk["chunk_index"]
            segments = chunk["segments"]
            chunk_duration = chunk.get("duration", 0)

            for segment in segments:
                # Apply time offset
                adjusted_segment = segment.copy()

                if segment.get("start") is not None:
                    adjusted_segment["start"] = segment["start"] + time_offset

                if segment.get("end") is not None:
                    adjusted_segment["end"] = segment["end"] + time_offset

                # Apply global speaker mapping
                local_speaker = segment.get("speaker")
                if local_speaker:
                    global_speaker = self._get_global_speaker(chunk_idx, local_speaker)
                    adjusted_segment["speaker"] = global_speaker

                merged_segments.append(adjusted_segment)

            # Update time offset for next chunk
            time_offset += chunk_duration

        return merged_segments

    def _build_speaker_mapping(self, chunk_results: List[Dict]):
        """
        Build global speaker ID mapping across chunks.

        Strategy:
        1. Extract speaker labels from each chunk
        2. For each chunk, map local speakers to global IDs
        3. Use overlap analysis at chunk boundaries for matching

        Args:
            chunk_results: List of chunk results
        """
        # Simple strategy: sequential mapping
        # For production, use speaker embedding similarity at boundaries

        for chunk_idx, chunk in enumerate(chunk_results):
            segments = chunk.get("segments", [])

            # Get unique speakers in this chunk
            chunk_speakers = set()
            for seg in segments:
                speaker = seg.get("speaker")
                if speaker:
                    chunk_speakers.add(speaker)

            # Sort for consistency
            chunk_speakers = sorted(list(chunk_speakers))

            # Map each local speaker to global ID
            for local_speaker in chunk_speakers:
                key = f"chunk_{chunk_idx}_{local_speaker}"

                if key not in self.global_speaker_map:
                    # Try to match with previous chunk's speakers
                    matched = self._match_speaker_across_chunks(
                        chunk_idx,
                        local_speaker,
                        chunk_results
                    )

                    if matched:
                        self.global_speaker_map[key] = matched
                    else:
                        # Assign new global ID
                        global_id = f"Speaker {chr(65 + self.next_global_id)}"
                        self.global_speaker_map[key] = global_id
                        self.next_global_id += 1

    def _match_speaker_across_chunks(
        self,
        chunk_idx: int,
        local_speaker: str,
        chunk_results: List[Dict]
    ) -> str:
        """
        Attempt to match speaker with previous chunk using boundary overlap.

        Args:
            chunk_idx: Current chunk index
            local_speaker: Local speaker label in current chunk
            chunk_results: All chunk results

        Returns:
            Global speaker ID if match found, None otherwise
        """
        if chunk_idx == 0:
            return None  # First chunk, no previous to match

        # Get segments from current and previous chunk
        current_segments = chunk_results[chunk_idx]["segments"]
        previous_segments = chunk_results[chunk_idx - 1]["segments"]

        # Find segments near boundary (last 30s of prev, first 30s of current)
        boundary_threshold = 30.0  # seconds

        # Get speakers at end of previous chunk
        prev_duration = chunk_results[chunk_idx - 1].get("duration", 0)
        prev_boundary_speakers = set()

        for seg in reversed(previous_segments):
            if seg.get("start") is not None:
                if prev_duration - seg["start"] <= boundary_threshold:
                    if seg.get("speaker"):
                        prev_boundary_speakers.add(seg["speaker"])
                else:
                    break

        # Get speakers at start of current chunk
        curr_boundary_speakers = set()

        for seg in current_segments:
            if seg.get("start") is not None:
                if seg["start"] <= boundary_threshold:
                    if seg.get("speaker") == local_speaker:
                        curr_boundary_speakers.add(seg["speaker"])
                else:
                    break

        # Simple heuristic: if this is the only speaker at boundary in both chunks,
        # assume it's the same person
        if len(prev_boundary_speakers) == 1 and local_speaker in curr_boundary_speakers:
            prev_speaker = list(prev_boundary_speakers)[0]
            prev_key = f"chunk_{chunk_idx - 1}_{prev_speaker}"

            if prev_key in self.global_speaker_map:
                return self.global_speaker_map[prev_key]

        return None

    def _get_global_speaker(self, chunk_idx: int, local_speaker: str) -> str:
        """
        Get global speaker ID for a local speaker in a chunk.

        Args:
            chunk_idx: Chunk index
            local_speaker: Local speaker label

        Returns:
            Global speaker ID
        """
        key = f"chunk_{chunk_idx}_{local_speaker}"
        return self.global_speaker_map.get(key, local_speaker)

    def get_speaker_count(self) -> int:
        """Get total number of unique global speakers."""
        unique_speakers = set(self.global_speaker_map.values())
        return len(unique_speakers)

    def get_speaker_timeline(self, segments: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Generate timeline showing when each speaker speaks.

        Args:
            segments: List of segments with speaker labels

        Returns:
            Dictionary mapping speaker IDs to their speaking segments
        """
        timeline = {}

        for seg in segments:
            speaker = seg.get("speaker")
            if not speaker:
                continue

            if speaker not in timeline:
                timeline[speaker] = []

            timeline[speaker].append({
                "start": seg.get("start"),
                "end": seg.get("end"),
                "text": seg.get("text", "")
            })

        return timeline

    def get_speaker_statistics(self, segments: List[Dict]) -> Dict[str, Any]:
        """
        Calculate speaking time and word count for each speaker.

        Args:
            segments: List of segments with speaker labels and timestamps

        Returns:
            Statistics for each speaker
        """
        stats = {}

        for seg in segments:
            speaker = seg.get("speaker")
            if not speaker:
                continue

            if speaker not in stats:
                stats[speaker] = {
                    "total_time": 0.0,
                    "word_count": 0,
                    "segment_count": 0
                }

            # Calculate duration
            if seg.get("start") is not None and seg.get("end") is not None:
                duration = seg["end"] - seg["start"]
                stats[speaker]["total_time"] += duration

            # Count words
            text = seg.get("text", "")
            stats[speaker]["word_count"] += len(text.split())

            stats[speaker]["segment_count"] += 1

        # Calculate percentages
        total_time = sum(s["total_time"] for s in stats.values())
        total_words = sum(s["word_count"] for s in stats.values())

        for speaker in stats:
            if total_time > 0:
                stats[speaker]["time_percentage"] = (
                    stats[speaker]["total_time"] / total_time * 100
                )
            else:
                stats[speaker]["time_percentage"] = 0

            if total_words > 0:
                stats[speaker]["word_percentage"] = (
                    stats[speaker]["word_count"] / total_words * 100
                )
            else:
                stats[speaker]["word_percentage"] = 0

        return stats
