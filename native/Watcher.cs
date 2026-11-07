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
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder path, ref int length);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  static bool WidgetRunning(string id) {
    try { using (Mutex.OpenExisting("Local\\" + id)) return true; }
    catch (WaitHandleCannotBeOpenedException) { return false; }
  }
  static bool HasCodex() {
    // A hidden/minimized window is still a live session. Inspect executable paths,
    // including all instances, instead of using foreground or visible windows.
    string testExe = Environment.GetEnvironmentVariable("MODELTIDE_TEST_STANDALONE") == "1" &&
      !String.IsNullOrEmpty(Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR"))
      ? Environment.GetEnvironmentVariable("MODELTIDE_TEST_CODEX_EXE") : null;
    string[] names = String.IsNullOrEmpty(testExe) ? new[] { "Codex", "ChatGPT" } : new[] { Path.GetFileNameWithoutExtension(testExe) };
    bool found = false;
    foreach (string name in names) foreach (Process candidate in Process.GetProcessesByName(name)) {
      using (candidate) {
        IntPtr process = OpenProcess(0x1000, false, (uint)candidate.Id);
        if (process == IntPtr.Zero) continue;
        try {
          var path = new StringBuilder(1024); int size = path.Capacity;
          if (QueryFullProcessImageName(process, 0, path, ref size)) {
            string exe = path.ToString();
            found |= !String.IsNullOrEmpty(testExe) ? String.Equals(exe, testExe, StringComparison.OrdinalIgnoreCase) :
              exe.IndexOf("\\OpenAI.Codex_", StringComparison.OrdinalIgnoreCase) >= 0 &&
              (exe.EndsWith("\\app\\ChatGPT.exe", StringComparison.OrdinalIgnoreCase) || exe.EndsWith("\\app\\Codex.exe", StringComparison.OrdinalIgnoreCase));
          }
        } finally { CloseHandle(process); }
      }
    }
    return found;
  }
  [STAThread] static void Main() {
    string root = AppDomain.CurrentDomain.BaseDirectory;
    string data = Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ModelTide");
    string identity = Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR") ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), id;
    using (var sha = SHA256.Create()) id = "modeltide-" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(identity))).Replace("-", "").ToLowerInvariant().Substring(0, 16);
    bool fresh;
    using (var mutex = new Mutex(true, "Local\\" + id + "-watcher", out fresh)) {
      if (!fresh) return;
      using (var updating = new EventWaitHandle(false, EventResetMode.ManualReset, "Local\\" + id + "-updating")) {
      using (var stopped = new EventWaitHandle(false, EventResetMode.ManualReset, "Local\\" + id + "-codex-stopped")) {
      bool hadCodex = false, pendingStart = false;
      while (true) {
        if (updating.WaitOne(0)) return;
        // Settings can briefly be incomplete while the collector saves a tray change.
        try { var cfg = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(data, "settings.json"))); if (cfg == null || !cfg.ContainsKey("followCodex")) { Thread.Sleep(2000); continue; } if (!Convert.ToBoolean(cfg["followCodex"])) { stopped.Reset(); return; } }
        catch (IOException) { Thread.Sleep(2000); continue; }
        catch (ArgumentException) { Thread.Sleep(2000); continue; }
        bool codex = HasCodex();
        if (!codex) { stopped.Set(); pendingStart = false; }
        else {
          if (!hadCodex) pendingStart = true;
          // Do not clear a shutdown already in progress until the previous owner
          // has released its mutex (after its collector has exited).
          if (pendingStart && (!stopped.WaitOne(0) || !WidgetRunning(id))) {
            stopped.Reset();
            if (!WidgetRunning(id)) {
              try { using (Process.Start(new ProcessStartInfo(Path.Combine(root, "ModelTide.exe"), "--watcher") { UseShellExecute = false, CreateNoWindow = true })) {} }
              catch { if (updating.WaitOne(2000)) return; continue; }
            }
            pendingStart = false;
          }
        }
        hadCodex = codex;
        if (updating.WaitOne(2000)) return;
      }
      }
      }
    }
  }
}
