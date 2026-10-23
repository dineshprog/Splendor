/**
 * Splendor Audio Engine - Procedural Web Audio API Sound Synthesizer
 * 100% self-contained, zero external asset downloads, zero latency, tactile feedback.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
    this.volume = 0.6;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext initialization failed:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this.enabled ? this.volume : 0,
        this.ctx.currentTime
      );
    }
    return this.enabled;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && this.enabled) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  vibrate(pattern = [15]) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  /**
   * Heavy 14g clay poker chip clink sound
   */
  playChipClink() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;
    this.vibrate([15]);

    const now = this.ctx.currentTime;

    // Dual resonant frequencies mimicking heavy clay chip strike
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(2400 + Math.random() * 200, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.04);

    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3600 + Math.random() * 300, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.035);

    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    // Subtle noise transient for tactile ceramic texture
    const bufferSize = this.ctx.sampleRate * 0.02;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(3000, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    noise.start(now);
    osc1.stop(now + 0.06);
    osc2.stop(now + 0.05);
    noise.stop(now + 0.03);
  }

  /**
   * Pure crystalline gem chime
   */
  playGemChime(frequencyMultiplier = 1) {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const baseFreq = 880 * frequencyMultiplier;

    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(baseFreq * 2.756, now); // Metallic non-harmonic overtone

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    overtone.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.4);
    overtone.stop(now + 0.4);
  }

  /**
   * Crisp linen card snap / deal sound
   */
  playCardSnap() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;
    this.vibrate([10]);

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.07;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.06);
    filter.Q.setValueAtTime(3, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.08);
  }

  /**
   * Card purchase fanfare: multi-tone crystalline arpeggio
   */
  playCardPurchase() {
    if (!this.enabled) return;
    this.ensureContext();
    this.vibrate([20, 50, 20]);

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.28);
      }, idx * 60);
    });
  }

  /**
   * Royal Renaissance noble arrival fanfare
   */
  playNobleFanfare() {
    if (!this.enabled) return;
    this.ensureContext();
    this.vibrate([30, 40, 30, 40, 60]);

    const chord = [440, 554.37, 659.25, 880]; // A major
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.75);
      }, idx * 80);
    });
  }

  /**
   * Arcane Super Power Awakening Fanfare
   */
  playPowerUnlocked() {
    if (!this.enabled) return;
    this.ensureContext();
    this.vibrate([40, 50, 40, 60, 100]);

    // Ascending mystical arpeggio with shimmering resonance
    const notes = [329.63, 440, 554.37, 659.25, 880, 1108.73]; // E4, A4, C#5, E5, A5, C#6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, now);

        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.9);
      }, idx * 70);
    });
  }

  /**
   * Warm turn alert bell
   */
  playTurnChime() {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  /**
   * Majestic victory progression
   */
  playVictory() {
    if (!this.enabled) return;
    this.ensureContext();

    const melody = [
      { freq: 523.25, delay: 0 },    // C5
      { freq: 659.25, delay: 160 },  // E5
      { freq: 783.99, delay: 320 },  // G5
      { freq: 1046.5, delay: 480 },  // C6
      { freq: 1318.5, delay: 680 }   // E6
    ];

    melody.forEach(item => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(item.freq, now);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.65);
      }, item.delay);
    });
  }
}

export const soundEngine = new SoundEngine();

