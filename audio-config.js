(function (root) {
  const config = {
    version: '36',
    master: .45,
    sfx: {
      gain: 1,
      sounds: {
        water: { file: 'assets/audio/water.wav', gain: 1, loop: true },
        wind: { file: 'assets/audio/wind.wav', gain: 1, loop: true },
        sails: { file: 'assets/audio/sails.wav', gain: .35, loop: true },
        hull: { file: 'assets/audio/hull-recorded.wav', gain: .35, loop: true },
        turn1: { file: 'assets/audio/turn-recorded-1.wav', gain: 1 },
        turn2: { file: 'assets/audio/turn-recorded-2.wav', gain: 1 },
        turn3: { file: 'assets/audio/turn-recorded-3.wav', gain: 1 },
        gull: { file: 'assets/audio/gull.wav', gain: .085 },
        bell: { file: 'assets/audio/arrival-bell.wav', gain: 1 }
      }
    },
    // Reserved for future background music; never loaded by the effects player.
    music: { gain: 1, tracks: {} }
  };
  if (typeof module !== 'undefined') module.exports = config;
  root.WindwardAudio = config;
})(typeof window !== 'undefined' ? window : globalThis);
