# Edited Recording Credits

These five assets are derivatives of user-supplied Pixabay recordings, not
MIT-licensed synthesized sounds. They are included as integrated effects in
the Windward game, not as a standalone sound library. Do not redistribute
them as standalone stock audio or assume the game's MIT license covers them.

The original MP3 files are not included in this repository and were not modified.
Source pages and the Pixabay Content License were checked on 2026-09-25.

| Game asset | Source and creator | Edit |
| --- | --- | --- |
| `hull-recorded.wav` | [Creaking Wood, VoiceBosch](https://pixabay.com/sound-effects/film-special-effects-creaking-wood-199971/) | Three excerpts from the 38-second source, lowered pitch/speed, filtering, separate levels and fades; arranged with gaps in an 18-second loop. |
| `turn-recorded-1.wav` | [Creaking, DRAGON-STUDIO](https://pixabay.com/sound-effects/film-special-effects-creaking-401724/) | Excerpt at 0.12 s, 0.82x speed/pitch, 2.2 kHz low-pass, fades; 2.9 seconds. |
| `turn-recorded-2.wav` | [Creaking Wood HQ, TanwerAman](https://pixabay.com/sound-effects/creaking-wood-hq-257176/) | Excerpt at 0.05 s, 0.90x speed/pitch, 3.1 kHz low-pass, fades; 2.8 seconds. |
| `turn-recorded-3.wav` | [Creaking Wood, Breviceps (Freesound), via freesound_community](https://pixabay.com/sound-effects/creaking-wood-46095/) | Excerpt at 0.03 s, 0.88x speed/pitch, 2.7 kHz low-pass, fades; 2.3 seconds. |
| `arrival-bell-recorded.wav` | [Opening Bell, u_7xr5ffk4oq](https://pixabay.com/sound-effects/film-special-effects-opening-bell-421471/) | Three original strikes at 0.94x pitch/speed, arranged 0.18 s apart; 140 Hz high-pass and 6.2 kHz low-pass, short fades and subtle final-only reverb; 2.4 seconds. |

License: [Pixabay Content License summary](https://pixabay.com/service/license-summary/)
and [binding terms](https://pixabay.com/service/terms/), sections 5 and 6.
The pages state that these recordings are available under the Pixabay Content
License. This is separate from MIT and includes restrictions on standalone
redistribution. The source creators retain their rights. No endorsement is implied.

All outputs: mono, 32,000 Hz, 16-bit PCM WAV. Creaks: 85 Hz high-pass; 80 ms fade-in
and 240 ms fade-out per excerpt. Hull peak <= 0.25, turn peak <= 0.5.
Runtime mixes these files with the game's other effects and changes their
level according to vessel speed and turning. All runtime mixing remains unchanged.
The bell plays once on port entry, with a peak limit of 0.55 and RMS limit of
0.105. Its final-only reverb is rendered offline; there is no runtime synthesis.

## Reproduction

With Node.js, Playwright and Microsoft Edge installed:

```powershell
node build-recorded-creaks.cjs --source-dir=C:/path/to/your/downloads --force
node build-recorded-bell.cjs --source=C:/path/to/u_7xr5ffk4oq-opening-bell-421471.mp3 --force
```

For the creak builder, `--inspect` reads the original files without writing outputs.
Full recipes are in the two build scripts. Existing outputs are protected unless `--force`
is passed. The script never changes the input MP3s or the old synthesized WAVs.

Source SHA-256 hashes:

```text
voicebosch-creaking-wood-199971.mp3
a12c0bd9301082aa3beb95abca5b5a20864fc1d0fa7e8443d0c95b35842f18dc
dragon-studio-creaking-401724.mp3
5a3f312a352a086bb708e90c09456725e32efca69791b4d0ec0a88d8fdbe435b
tanweraman-creaking-wood-hq-257176.mp3
4251647759c66702cbb715abcc8eb059e470ea3455ee6c4009a61cd1ff84ae3a
freesound_community-creaking-wood-46095.mp3
19e0bdade5bfea7d3365b0c6ecfad8e5d3cc010d7c64be809613e4205cd2599e
u_7xr5ffk4oq-opening-bell-421471.mp3
5dbf4885ac33a6fad476f778fea063fa4ae9b456b8a843a4507b85c340191a23
```
