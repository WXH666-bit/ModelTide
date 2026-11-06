using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
class Watcher {
  delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder path, ref int length);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static bool HasCodex() {
    bool found = false;
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); IntPtr process = OpenProcess(0x1000, false, pid); if (process == IntPtr.Zero) return true;
      try { var path = new StringBuilder(1024); int size = path.Capacity;
        if (QueryFullProcessImageName(process, 0, path, ref size)) { string exe = path.ToString(); found = exe.IndexOf("\\OpenAI.Codex_", StringComparison.OrdinalIgnoreCase) >= 0 && (exe.EndsWith("\\app\\ChatGPT.exe", StringComparison.OrdinalIgnoreCase) || exe.EndsWith("\\app\\Codex.exe", StringComparison.OrdinalIgnoreCase)); }
      } finally { CloseHandle(process); }
      return !found;
    }, IntPtr.Zero); return found;
  }
  [STAThread] static void Main() {
    string root = AppDomain.CurrentDomain.BaseDirectory;
    string data = Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ModelTide");
    string identity = Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR") ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), id;
    using (var sha = SHA256.Create()) id = "modeltide-" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(identity))).Replace("-", "").ToLowerInvariant().Substring(0, 16);
    bool fresh;
    using (var mutex = new Mutex(true, "Local\\" + id + "-watcher", out fresh)) {
      if (!fresh) return;
      bool hadCodex = false;
      while (true) {
        // Settings can briefly be incomplete while the collector saves a tray change.
        try { var cfg = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(data, "settings.json"))); if (cfg == null || !cfg.ContainsKey("followCodex")) { Thread.Sleep(2000); continue; } if (!Convert.ToBoolean(cfg["followCodex"])) return; }
        catch (IOException) { Thread.Sleep(2000); continue; }
        catch (ArgumentException) { Thread.Sleep(2000); continue; }
        bool codex = HasCodex();
        if (codex && !hadCodex) {
          bool running = false;
          try { using (Mutex.OpenExisting("Local\\" + id)) running = true; } catch (WaitHandleCannotBeOpenedException) {}
          if (!running) { try { Process.Start(new ProcessStartInfo(Path.Combine(root, "ModelTide.exe")) { UseShellExecute = false, CreateNoWindow = true }); } catch {} }
        }
        hadCodex = codex;
        Thread.Sleep(2000);
      }
    }
  }
}
