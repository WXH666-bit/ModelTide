using System;
using System.Threading;
class CodexStub {
  static void Main(string[] args) {
    if (args.Length == 2 && args[0] == "--event") {
      using (var signal = new EventWaitHandle(false, EventResetMode.ManualReset, args[1])) {
        signal.Set(); Thread.Sleep(5000);
      }
      return;
    }
    // Deliberately no window: hidden/minimized Codex must still count as running.
    Thread.Sleep(Timeout.Infinite);
  }
}
