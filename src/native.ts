import koffi from 'koffi';
export interface NativeWindow { handle: number; x: number; y: number; width: number; height: number; minimized: boolean }
export function createTracker() {
  if (process.platform !== 'win32') return { current: (): NativeWindow | null => null, foreground: () => 0 };
  const user = koffi.load('user32.dll'), kernel = koffi.load('kernel32.dll');
  const Rect = koffi.struct('ModelTideRect', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  const enumType = koffi.proto('bool __stdcall ModelTideEnum(uintptr_t hwnd, intptr_t param)');
  const enumerate = user.func('bool __stdcall EnumWindows(ModelTideEnum *cb, intptr_t param)');
  const visible = user.func('bool __stdcall IsWindowVisible(uintptr_t hwnd)');
  const valid = user.func('bool __stdcall IsWindow(uintptr_t hwnd)');
  const iconic = user.func('bool __stdcall IsIconic(uintptr_t hwnd)');
  const getRect = user.func('GetWindowRect', 'bool', ['uintptr_t', koffi.out(koffi.pointer(Rect))]);
  const getPid = user.func('GetWindowThreadProcessId', 'uint32', ['uintptr_t', koffi.out(koffi.pointer('uint32'))]);
  const openProcess = kernel.func('uintptr_t __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)');
  const close = kernel.func('bool __stdcall CloseHandle(uintptr_t handle)');
  const path = kernel.func('QueryFullProcessImageNameW', 'bool', ['uintptr_t', 'uint32', 'void *', koffi.inout(koffi.pointer('uint32'))]);
  const foreground = user.func('uintptr_t __stdcall GetForegroundWindow()');
  let target = 0, nextSearch = 0;
  function isCodex(hwnd: number) {
    const pid = [0]; getPid(hwnd, pid);
    const handle = openProcess(0x1000, false, pid[0]);
    if (!handle) return false;
    try {
      const buf = Buffer.alloc(2048), length = [1024];
      if (!path(handle, 0, buf, length)) return false;
      return /[\\/]OpenAI\.Codex_[^\\/]+[\\/]app[\\/](ChatGPT|Codex)\.exe$/i.test(buf.toString('utf16le', 0, length[0] * 2));
    } finally { close(handle); }
  }
  return {
    foreground: (): number => Number(foreground()),
    current(): NativeWindow | null {
      if (target && !valid(target)) target = 0;
      if (Date.now() > nextSearch) {
        const front = Number(foreground());
        if (visible(front) && isCodex(front)) target = front;
        else if (!target) enumerate((hwnd: number) => { if (visible(hwnd) && isCodex(hwnd)) { target = Number(hwnd); return false; } return true; }, 0);
        nextSearch = Date.now() + 2000;
      }
      if (!target) return null;
      const r = { left: 0, top: 0, right: 0, bottom: 0 };
      if (!getRect(target, r)) return null;
      return { handle: target, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, minimized: Boolean(iconic(target) || !visible(target)) };
    }
  };
}
