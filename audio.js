// audio.js - Retro Arcade Sound Effects & Chiptune Music Generator

class ArcadeAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmInterval = null;
    this.currentStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return this.muted;
  }

  // Play a synthesized tone or noise
  playTone(freq, type = 'square', duration = 0.1, volume = 0.2, freqEnd = null) {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playNoise(duration = 0.15, volume = 0.25) {
    if (this.muted || !this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start();
    } catch (e) {}
  }

  // Punch Light
  punchLight() {
    this.playTone(320, 'square', 0.08, 0.15, 120);
    this.playNoise(0.06, 0.12);
  }

  // Punch Heavy
  punchHeavy() {
    this.playTone(260, 'sawtooth', 0.16, 0.25, 60);
    this.playNoise(0.14, 0.25);
  }

  // Kick
  kick() {
    this.playTone(180, 'triangle', 0.18, 0.25, 40);
    this.playNoise(0.12, 0.2);
  }

  // Swoosh attack whiff
  swoosh() {
    this.playTone(450, 'sine', 0.1, 0.08, 150);
  }

  // Block hit
  block() {
    this.playTone(600, 'square', 0.08, 0.2, 400);
  }

  // Special projectile shoot
  specialShoot() {
    this.playTone(300, 'sawtooth', 0.25, 0.2, 900);
  }

  // Special projectile explosion
  specialHit() {
    this.playTone(150, 'sawtooth', 0.35, 0.3, 30);
    this.playNoise(0.3, 0.35);
  }

  // Super Activation (CPI / PODER MÁXIMO!)
  superActivate() {
    [400, 550, 700, 950].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.18, 0.22, f * 1.3), i * 60);
    });
  }

  // Round Bell
  roundBell() {
    this.playTone(1100, 'sine', 0.6, 0.35, 900);
    setTimeout(() => this.playTone(1100, 'sine', 0.8, 0.4, 900), 200);
  }

  // KO Gong
  koGong() {
    this.playTone(150, 'sawtooth', 0.9, 0.45, 40);
    this.playNoise(0.6, 0.4);
    setTimeout(() => this.playTone(100, 'triangle', 1.2, 0.5, 30), 100);
  }

  // Menu Select Beep
  menuSelect() {
    this.playTone(440, 'square', 0.08, 0.15, 660);
  }

  // Menu Confirm
  menuConfirm() {
    this.playTone(523.25, 'triangle', 0.1, 0.2);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.18, 0.25), 90);
  }

  // Announcer Voice with Web Speech API
  speak(text) {
    if (this.muted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.15;
      utterance.pitch = 0.9;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  // 16-Bit Chiptune BGM Generator (Street Fighter Arcade style)
  startBGM() {
    if (this.muted || this.bgmPlaying || !this.ctx) return;
    this.bgmPlaying = true;
    this.currentStep = 0;

    // Bassline and Lead notes (in Hz)
    const bass = [110, 110, 130.81, 110, 146.83, 130.81, 110, 98];
    const lead = [
      440, 0, 523.25, 587.33, 659.25, 587.33, 523.25, 440,
      659.25, 698.46, 659.25, 587.33, 523.25, 440, 392, 440
    ];

    const stepDuration = 140; // ms per 16th note

    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.bgmPlaying || !this.ctx) return;
      const bNote = bass[this.currentStep % bass.length];
      const lNote = lead[this.currentStep % lead.length];

      // Bass note
      if (bNote) {
        this.playTone(bNote, 'triangle', 0.12, 0.09, bNote * 0.95);
      }
      // Lead note
      if (lNote && this.currentStep % 2 === 0) {
        this.playTone(lNote, 'square', 0.11, 0.045);
      }
      // Hi-hat noise
      if (this.currentStep % 2 === 1) {
        this.playTone(1800, 'sine', 0.03, 0.02, 1000);
      }
      // Snare on every 4th step
      if (this.currentStep % 4 === 2) {
        this.playNoise(0.08, 0.07);
      }

      this.currentStep = (this.currentStep + 1) % 64;
    }, stepDuration);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const arcadeAudio = new ArcadeAudio();
