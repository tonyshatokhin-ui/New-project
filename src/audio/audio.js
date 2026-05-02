const bgMusic = new Audio("assets/bg-music.mp3");
const defeatSound = new Audio("assets/defeat-sfx.mp3");

bgMusic.loop = true;
bgMusic.preload = "auto";
bgMusic.volume = 0.35;
defeatSound.preload = "auto";
defeatSound.volume = 0.55;

let sharedAudioContext = null;
let lastSliderSoundAt = 0;

function getSharedAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

function createUiVoice(context, {
  type = "triangle",
  frequency = 440,
  start = 0,
  duration = 0.08,
  gainPeak = 0.06,
  destination = context.destination,
  frequencyEnd = null,
} = {}) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime + start;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (frequencyEnd) {
    oscillator.frequency.exponentialRampToValueAtTime(frequencyEnd, startTime + duration);
  }
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function tryStartMusic() {
  const context = getSharedAudioContext();
  if (context?.state === "suspended") {
    context.resume().catch(() => {});
  }
  if (!globalThis.uiState.musicOn) return;
  bgMusic.muted = false;
  bgMusic.play().then(() => {
    globalThis.uiState.audioReady = true;
  }).catch(() => {});
}

function playDefeatSound() {
  if (!globalThis.uiState.musicOn) return;
  try {
    defeatSound.currentTime = 0;
    defeatSound.play().catch(() => {});
  } catch (_) {}
}

function playSuccessSound() {
  if (!globalThis.uiState.musicOn) return;
  const context = getSharedAudioContext();
  if (!context) return;
  try {
    createUiVoice(context, { frequency: 660, frequencyEnd: 990, duration: 0.22, gainPeak: 0.08 });
  } catch (_) {}
}

function playScoutMoveSound() {
  if (!globalThis.uiState.musicOn) return;
  const context = getSharedAudioContext();
  if (!context) return;
  try {
    const master = context.createGain();
    const startTime = context.currentTime;
    master.gain.setValueAtTime(0.12, startTime);
    master.connect(context.destination);

    const notes = [
      { frequency: 220, start: 0, duration: 0.08 },
      { frequency: 280, start: 0.07, duration: 0.08 },
      { frequency: 340, start: 0.14, duration: 0.09 },
    ];

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(note.frequency, startTime + note.start);
      gain.gain.setValueAtTime(0.0001, startTime + note.start);
      gain.gain.exponentialRampToValueAtTime(0.7, startTime + note.start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.start + note.duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(startTime + note.start);
      oscillator.stop(startTime + note.start + note.duration);
    });
  } catch (_) {}
}

function playButtonClickSound() {
  if (!globalThis.uiState.musicOn) return;
  const context = getSharedAudioContext();
  if (!context) return;
  try {
    createUiVoice(context, { type: "square", frequency: 420, frequencyEnd: 360, duration: 0.06, gainPeak: 0.035 });
  } catch (_) {}
}

function playTurnAdvanceSound() {
  if (!globalThis.uiState.musicOn) return;
  const context = getSharedAudioContext();
  if (!context) return;
  try {
    createUiVoice(context, { type: "triangle", frequency: 320, frequencyEnd: 480, duration: 0.11, gainPeak: 0.045 });
    createUiVoice(context, { type: "triangle", frequency: 480, frequencyEnd: 720, duration: 0.14, gainPeak: 0.06, start: 0.08 });
    createUiVoice(context, { type: "sine", frequency: 180, frequencyEnd: 220, duration: 0.18, gainPeak: 0.025, start: 0.02 });
  } catch (_) {}
}

function playTileSelectSound() {
  if (!globalThis.uiState.musicOn) return;
  const context = getSharedAudioContext();
  if (!context) return;
  try {
    createUiVoice(context, { type: "sine", frequency: 380, frequencyEnd: 520, duration: 0.11, gainPeak: 0.045 });
    createUiVoice(context, { type: "triangle", frequency: 240, frequencyEnd: 300, duration: 0.09, gainPeak: 0.02, start: 0.02 });
  } catch (_) {}
}

function playSliderTickSound() {
  if (!globalThis.uiState.musicOn) return;
  const now = performance.now();
  if (now - lastSliderSoundAt < 45) return;
  lastSliderSoundAt = now;
  const context = getSharedAudioContext();
  if (!context) return;
  try {
    createUiVoice(context, { type: "triangle", frequency: 260, frequencyEnd: 285, duration: 0.045, gainPeak: 0.02 });
  } catch (_) {}
}

Object.assign(globalThis, {
  tryStartMusic,
  playDefeatSound,
  playSuccessSound,
  playScoutMoveSound,
  playButtonClickSound,
  playTurnAdvanceSound,
  playTileSelectSound,
  playSliderTickSound,
});
