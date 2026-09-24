(function (root) {
  const config = {
    version: '21',
    master: .45,
    sounds: {
      water: { file: 'assets/audio/water.wav', gain: 1, loop: true },
      wind: { file: 'assets/audio/wind.wav', gain: 1, loop: true },
      sails: { file: 'assets/audio/sails.wav', gain: .35, loop: true },
      hull: { file: 'assets/audio/hull.wav', gain: .35, loop: true },
      turn1: { file: 'assets/audio/turn-1.wav', gain: 1 },
      turn2: { file: 'assets/audio/turn-2.wav', gain: 1 },
      turn3: { file: 'assets/audio/turn-3.wav', gain: 1 },
      gull: { file: 'assets/audio/gull.wav', gain: .085 },
      bell: { file: 'assets/audio/arrival-bell.wav', gain: 1 }
    }
  };
  if (typeof module !== 'undefined') module.exports = config;
  root.WindwardAudio = config;
})(typeof window !== 'undefined' ? window : globalThis);
