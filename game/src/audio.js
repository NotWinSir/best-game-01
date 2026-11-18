// Every sound in Emberwyrm is synthesised with WebAudio: no audio files, nothing to load, and
// the game stays silent until the player's first press (a browser rule), then hums. Short
// envelopes of oscillators and filtered noise give the pops, crunches and chimes; a slow
// two-oscillator drone and a soft pentatonic pluck pattern make the night music. One master
// gain keeps it gentle, and M mutes.

const MUSIC_NOTES = [0, 3, 5, 7, 10, 12, 10, 7]; // a minor-pentatonic walk, in semitones
const MUSIC_ROOT = 196; // G3

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;
  let droneNodes = null;

  function ensure() {
    if (context !== null) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    return true;
  }

  function tone({ freq, freqEnd = null, type = 'sine', seconds = 0.15, gain = 0.2, at = 0, dest = null }) {
    if (!ensure()) return;
    const t0 = context.currentTime + at;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + seconds);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(amp).connect(dest ?? master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  function noise({ seconds = 0.2, gain = 0.2, freq = 800, at = 0 }) {
    if (!ensure()) return;
    const t0 = context.currentTime + at;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const amp = context.createGain();
    amp.gain.value = gain;
    source.connect(filter).connect(amp).connect(master);
    source.start(t0);
  }

  function startDrone() {
    if (!ensure() || droneNodes !== null) return;
    const oscA = context.createOscillator();
    const oscB = context.createOscillator();
    const amp = context.createGain();
    oscA.type = 'triangle';
    oscA.frequency.value = 49; // G1
    oscB.type = 'sine';
    oscB.frequency.value = 98.2; // a hair off G2, so the pair breathes
    amp.gain.value = 0.05;
    oscA.connect(amp);
    oscB.connect(amp);
    amp.connect(musicGain);
    oscA.start();
    oscB.start();
    droneNodes = { oscA, oscB, amp };
  }

  return {
    /** Call from any user gesture: wakes the context and starts the night drone. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume();
      startDrone();
    },
    /** Advance the music pattern; call once a frame with the elapsed seconds. */
    update(seconds) {
      if (context === null || muted) return;
      musicTimer -= seconds;
      if (musicTimer <= 0) {
        musicTimer = 0.42;
        const semis = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
        musicStep += 1;
        const freq = MUSIC_ROOT * Math.pow(2, semis / 12);
        tone({ freq, type: 'sine', seconds: 0.5, gain: 0.11, dest: musicGain });
        if (musicStep % 4 === 0) tone({ freq: freq / 2, type: 'triangle', seconds: 0.8, gain: 0.07, dest: musicGain });
      }
    },
    ember(combo) {
      const lift = Math.min(combo, 8) * 40;
      tone({ freq: 660 + lift, freqEnd: 990 + lift, type: 'sine', seconds: 0.09, gain: 0.12 });
    },
    crush(count) {
      noise({ seconds: 0.25, gain: 0.3, freq: 500 });
      tone({ freq: 180, freqEnd: 55, type: 'square', seconds: 0.22, gain: 0.18 });
      if (count >= 3) tone({ freq: 880, freqEnd: 1320, type: 'sine', seconds: 0.3, gain: 0.14, at: 0.05 });
    },
    hurt() {
      tone({ freq: 220, freqEnd: 70, type: 'sawtooth', seconds: 0.35, gain: 0.25 });
      noise({ seconds: 0.3, gain: 0.2, freq: 300 });
    },
    dash() {
      noise({ seconds: 0.16, gain: 0.1, freq: 1800 });
    },
    choose() {
      tone({ freq: 523, type: 'sine', seconds: 0.12, gain: 0.14 });
      tone({ freq: 784, type: 'sine', seconds: 0.2, gain: 0.14, at: 0.09 });
    },
    nightClear() {
      [392, 523, 659, 784].forEach((freq, i) => tone({ freq, type: 'sine', seconds: 0.35, gain: 0.13, at: i * 0.11 }));
    },
    gameOver() {
      [330, 262, 196, 131].forEach((freq, i) => tone({ freq, type: 'triangle', seconds: 0.5, gain: 0.16, at: i * 0.16 }));
    },
    victory() {
      [392, 523, 659, 784, 1047].forEach((freq, i) => tone({ freq, type: 'sine', seconds: 0.5, gain: 0.14, at: i * 0.12 }));
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
