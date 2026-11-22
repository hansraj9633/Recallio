export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // Ignore probe error
    }
  }
  return '';
}

export function getExtensionFromMimeType(mimeType: string): string {
  const lower = (mimeType || '').toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  return 'webm';
}

export async function extractWaveformPeaks(blob: Blob, barCount = 64): Promise<number[]> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return generateFallbackPeaks(barCount);
    }
    const ctx = new AudioCtx();
    try {
      const buffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(buffer);
      const channelData = audioBuffer.getChannelData(0);
      const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
      const peaks: number[] = [];
      let maxPeak = 0.01;
      for (let i = 0; i < barCount; i++) {
        const start = i * blockSize;
        const end = Math.min(channelData.length, start + blockSize);
        let sum = 0;
        for (let j = start; j < end; j++) {
          const val = Math.abs(channelData[j]);
          if (val > sum) sum = val;
        }
        peaks.push(sum);
        if (sum > maxPeak) maxPeak = sum;
      }
      return peaks.map((p) => Math.max(0.12, Math.min(1, p / maxPeak)));
    } finally {
      await ctx.close().catch(() => {});
    }
  } catch {
    return generateFallbackPeaks(barCount);
  }
}

export async function measureAudioDuration(blob: Blob): Promise<number> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      try {
        const buffer = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buffer);
        if (Number.isFinite(decoded.duration) && decoded.duration > 0) {
          return decoded.duration;
        }
      } finally {
        await ctx.close().catch(() => {});
      }
    }
  } catch {
    // Fallback to HTMLAudioElement
  }

  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const cleanup = () => {
      URL.revokeObjectURL(url);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (audio.duration === Infinity) {
        audio.currentTime = 1e10;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
          cleanup();
          resolve(dur);
        };
      } else {
        const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
        cleanup();
        resolve(dur);
      }
    };
    audio.onerror = () => {
      cleanup();
      resolve(0);
    };
    audio.src = url;
  });
}

function generateFallbackPeaks(barCount: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const wave = 0.35 + 0.45 * Math.abs(Math.sin(i * 0.42) * Math.cos(i * 0.17));
    peaks.push(Number(wave.toFixed(2)));
  }
  return peaks;
}

/**
 * Generates a real playable 16-bit mono PCM WAV audio Blob with gentle
 * harmonic acoustic cues so initial sample notes play via real HTML5 Audio.
 */
export function createSampleWavBlob(durationSeconds: number, baseFreq: number): {
  blob: Blob;
  peaks: number[];
} {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const barCount = 64;
  const samplesPerBar = Math.floor(numSamples / barCount);
  const peaks = new Array<number>(barCount).fill(0);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Gentle phrase-like amplitude envelope simulating spoken explanation cadences
    const phraseEnvelope =
      0.55 +
      0.45 * Math.sin(2 * Math.PI * 0.38 * t) * Math.cos(2 * Math.PI * 0.19 * t);
    const fadeIn = Math.min(1, t / 0.2);
    const fadeOut = Math.min(1, (durationSeconds - t) / 0.35);
    const tone =
      0.55 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.28 * Math.sin(2 * Math.PI * (baseFreq * 1.25) * t) +
      0.17 * Math.sin(2 * Math.PI * (baseFreq * 1.5) * t);

    const sample = Math.max(-1, Math.min(1, tone * phraseEnvelope * fadeIn * fadeOut * 0.18));
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);

    const barIdx = Math.min(barCount - 1, Math.floor(i / samplesPerBar));
    const absAmp = Math.abs(phraseEnvelope * fadeIn * fadeOut);
    if (absAmp > peaks[barIdx]) peaks[barIdx] = absAmp;
  }

  const normalizedPeaks = peaks.map((p) => Number(Math.max(0.18, Math.min(1, p)).toFixed(2)));
  return {
    blob: new Blob([buffer], { type: 'audio/wav' }),
    peaks: normalizedPeaks,
  };
}
