using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Win32;
using Forms = System.Windows.Forms;

namespace ModelTide {
  public sealed class InstallPlan {
    public string Installer, Sha256, Directory, Identity, Language, Version;
    public int CollectorPid;
  }
  public static class UpdateInstaller {
    public static string EventName(string identity) { return "Local\\" + identity + "-updating"; }
    public static bool IsUpdating(string identity) {
      try { using (var signal = EventWaitHandle.OpenExisting(EventName(identity))) return signal.WaitOne(0); }
      catch (WaitHandleCannotBeOpenedException) { return false; }
    }
    public static Process Launch(InstallPlan plan) {
      string helper = Path.Combine(Path.GetDirectoryName(plan.Installer), "ModelTide-Update.exe");
      string current = Assembly.GetExecutingAssembly().Location;
      File.Copy(current, helper, true);
      if (File.Exists(current + ".config")) File.Copy(current + ".config", helper + ".config", true);
      string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(plan)));
      return Process.Start(new ProcessStartInfo(helper, "--apply-update " + encoded) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Path.GetDirectoryName(helper) });
    }
    public static string InstallerArguments(string directory) {
      // NSIS /D must be the last argument and must not be quoted, including spaces.
      if (!Path.IsPathRooted(directory) || directory.IndexOfAny(new[] { '"', '\r', '\n' }) >= 0) throw new InvalidDataException(Locale.T("updateInvalidTarget"));
      return "/S /UPDATE /D=" + Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar);
    }
    private static List<Process> OwnedProcesses(InstallPlan plan) {
      var owned = new List<Process>();
      string root = Path.GetFullPath(plan.Directory).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
      foreach (var process in Process.GetProcesses()) {
        bool keep = false;
        try {
          if (process.Id == Process.GetCurrentProcess().Id) continue;
          if (process.Id == plan.CollectorPid) keep = true;
          else if (process.ProcessName == "ModelTide" || process.ProcessName == "ModelTide-Details" || process.ProcessName == "ModelTide-Watcher" || process.ProcessName == "node") {
            string path = process.MainModule.FileName;
            keep = path.StartsWith(root, StringComparison.OrdinalIgnoreCase);
          }
          if (keep) owned.Add(process);
        } catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception) { }
        finally { if (!keep) process.Dispose(); }
      }
      return owned;
    }
    public static int Run(string encoded) {
      InstallPlan plan = null; bool stopped = false, installed = false;
      EventWaitHandle signal = null;
      try {
        plan = new JavaScriptSerializer().Deserialize<InstallPlan>(Encoding.UTF8.GetString(Convert.FromBase64String(encoded)));
        Locale.Language = plan.Language == "en" ? "en" : "zh-CN";
        if (!Regex.IsMatch(plan.Identity ?? "", @"\Amodeltide-[0-9a-f]{16}\z") || !Regex.IsMatch(plan.Sha256 ?? "", @"\A[0-9a-f]{64}\z")) throw new InvalidDataException(Locale.T("updateInvalidTarget"));
        string arguments = InstallerArguments(plan.Directory);
        if (!File.Exists(Path.Combine(plan.Directory, "ModelTide.exe")) || Path.GetFileName(plan.Installer) != "ModelTide-" + plan.Version + "-Setup-x64.exe") throw new InvalidDataException(Locale.T("updateInvalidTarget"));
        if (UpdateClient.HashFile(plan.Installer) != plan.Sha256) throw new InvalidDataException(Locale.T("updateHashMismatch"));
        bool fresh;
        using (var mutex = new Mutex(true, "Local\\" + plan.Identity + "-installer", out fresh)) {
          if (!fresh) return 1;
          signal = new EventWaitHandle(false, EventResetMode.ManualReset, EventName(plan.Identity));
          var owned = OwnedProcesses(plan);
          try {
            signal.Set(); stopped = true;
            var deadline = DateTime.UtcNow.AddSeconds(35);
            foreach (var process in owned) {
              int remaining = Math.Max(0, (int)(deadline - DateTime.UtcNow).TotalMilliseconds);
              if (!process.WaitForExit(remaining)) throw new IOException(Locale.T("updateCloseFailed"));
            }
          } finally { foreach (var process in owned) process.Dispose(); }
          using (var installer = Process.Start(new ProcessStartInfo(plan.Installer, arguments) { UseShellExecute = false, CreateNoWindow = true })) {
            installer.WaitForExit();
            if (installer.ExitCode != 0) throw new IOException(Locale.T("updateInstallFailed") + " (" + installer.ExitCode + ")");
          }
          string actual = FileVersionInfo.GetVersionInfo(Path.Combine(plan.Directory, "ModelTide.exe")).ProductVersion;
          if (actual != plan.Version) throw new IOException(Locale.T("updateInstallFailed"));
          installed = true;
        }
      } catch (Exception e) {
        Forms.MessageBox.Show(Locale.T("updateFailed") + "\n" + e.Message, "ModelTide", Forms.MessageBoxButtons.OK, Forms.MessageBoxIcon.Warning);
      } finally {
        if (signal != null) { signal.Reset(); signal.Dispose(); }
        if (stopped && plan != null) {
          try {
            Process.Start(new ProcessStartInfo(Path.Combine(plan.Directory, "ModelTide.exe")) { UseShellExecute = false, CreateNoWindow = true });
            string data = Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "ModelTide");
            var settings = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(data, "settings.json")));
            if (settings.ContainsKey("followCodex") && Convert.ToBoolean(settings["followCodex"])) Process.Start(new ProcessStartInfo(Path.Combine(plan.Directory, "ModelTide-Watcher.exe")) { UseShellExecute = false, CreateNoWindow = true });
          } catch (Exception e) { Forms.MessageBox.Show(Locale.T("updateRestartFailed") + "\n" + e.Message, "ModelTide"); }
        }
        if (installed) {
          // Windows/exFAT can briefly retain an executable mapping after exit.
          // A cache-cleanup failure must not turn a completed update into a crash.
          for (int attempt = 0; attempt < 4; attempt++) {
            try { File.Delete(plan.Installer); break; }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            if (attempt < 3) Thread.Sleep(500);
          }
        }
      }
      return installed ? 0 : 1;
    }
  }
}
