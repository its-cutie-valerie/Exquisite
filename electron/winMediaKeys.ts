import { createRequire } from 'node:module';
// electron/winMediaKeys.ts - Windows-only media key sender using user32.keybd_event
// Sends real media key taps so the active system player (Spotify/Tidal/Etc) responds.

let keyTap: (vk: number) => void = () => {};

if (process.platform === 'win32') {
  try {
    // Lazy require to avoid issues on non-Windows and ESM contexts
    const req = createRequire(import.meta.url);
    const ffi = req('ffi-napi');
    const user32 = ffi.Library('user32', {
      keybd_event: ['void', ['uchar', 'uchar', 'uint32', 'uint64']],
    });
    const KEYEVENTF_KEYUP = 0x0002;
    keyTap = (vk: number) => {
      try {
        user32.keybd_event(vk, 0, 0, 0);
        setTimeout(() => user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0), 10);
      } catch (e) {
        // Best-effort; log once if needed
        console.warn('[winMediaKeys] keybd_event failed', e);
      }
    };
  } catch (e) {
    console.warn('[winMediaKeys] ffi-napi not available; media key simulation disabled');
  }
}

const VK = {
  MEDIA_NEXT_TRACK: 0xB0,
  MEDIA_PREV_TRACK: 0xB1,
  MEDIA_STOP: 0xB2,
  MEDIA_PLAY_PAUSE: 0xB3,
};

export function mediaPlayPause() { keyTap(VK.MEDIA_PLAY_PAUSE); }
export function mediaNext() { keyTap(VK.MEDIA_NEXT_TRACK); }
export function mediaPrevious() { keyTap(VK.MEDIA_PREV_TRACK); }
export function mediaStop() { keyTap(VK.MEDIA_STOP); }

export default { mediaPlayPause, mediaNext, mediaPrevious, mediaStop };
