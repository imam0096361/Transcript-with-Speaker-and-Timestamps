
// Helper to write a string to a DataView
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Convert an AudioBuffer to a WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44; // 2 bytes per sample
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let offset = 0;

    // Write WAV container
    // RIFF chunk descriptor
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    // FMT sub-chunk
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
    view.setUint16(offset, 1, true); offset += 2; // AudioFormat (PCM)
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4; // ByteRate
    view.setUint16(offset, numOfChan * 2, true); offset += 2; // BlockAlign
    view.setUint16(offset, 16, true); offset += 2; // BitsPerSample
    // data sub-chunk
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, buffer.length * numOfChan * 2, true); offset += 4;

    // Get PCM data
    for (i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // Write the interleaved PCM samples
    let pos = 0;
    while (pos < buffer.length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF); // scale to 16-bit
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([view], { type: 'audio/wav' });
}


export async function sliceAudio(file: File, chunkDurationSeconds: number): Promise<Blob[]> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const { sampleRate, numberOfChannels, duration } = originalBuffer;
    const chunkLength = sampleRate * chunkDurationSeconds;
    const numChunks = Math.ceil(duration / chunkDurationSeconds);
    const chunks: Blob[] = [];

    for (let i = 0; i < numChunks; i++) {
        const start = i * chunkLength;
        const end = Math.min(start + chunkLength, originalBuffer.length);
        const chunkBufferLength = end - start;

        if (chunkBufferLength <= 0) continue;

        const chunkBuffer = audioContext.createBuffer(
            numberOfChannels,
            chunkBufferLength,
            sampleRate
        );

        for (let j = 0; j < numberOfChannels; j++) {
            const channelData = originalBuffer.getChannelData(j);
            const chunkChannelData = chunkBuffer.getChannelData(j);
            chunkChannelData.set(channelData.subarray(start, end));
        }

        chunks.push(audioBufferToWav(chunkBuffer));
    }

    // Close the context to release resources
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
    
    return chunks;
}
