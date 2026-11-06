using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Forms = System.Windows.Forms;

namespace ModelTide {
  public static class Entry {
    public static string Pipe;
    public static string Root = AppDomain.CurrentDomain.BaseDirectory;
    public static JavaScriptSerializer Json = new JavaScriptSerializer();
    [STAThread] public static void Main() {
      string source = Environment.GetEnvironmentVariable("MODELTIDE_DATA_DIR") ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
      using (var sha = SHA256.Create()) Pipe = "modeltide-" + BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(source))).Replace("-", "").ToLowerInvariant().Substring(0, 16);
      bool fresh;
      using (var mutex = new Mutex(true, "Local\\" + Pipe, out fresh)) {
        if (!fresh) { try { Rpc("open", null).Wait(2500); } catch {} return; }
        RenderOptions.ProcessRenderMode = RenderMode.SoftwareOnly;
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        app.Run(new Widget());
      }
    }
    public static Task<Dictionary<string, object>> Rpc(string method, object parameters) {
      return Task.Run(() => {
        using (var pipe = new NamedPipeClientStream(".", Pipe, PipeDirection.InOut, PipeOptions.Asynchronous)) {
          pipe.Connect(2500);
          var writer = new StreamWriter(pipe, new UTF8Encoding(false));
          writer.WriteLine(Json.Serialize(new { method = method, @params = parameters ?? new object() })); writer.Flush();
          var reader = new StreamReader(pipe, Encoding.UTF8);
          var read = reader.ReadLineAsync();
          if (!read.Wait(12000)) throw new IOException(Locale.T("timeout"));
          var reply = Json.Deserialize<Dictionary<string, object>>(read.Result);
          if (reply.ContainsKey("error")) throw new IOException(Convert.ToString(reply["error"]));
          return reply["result"] as Dictionary<string, object>;
        }
      });
    }
  }
  public class Widget : Window {
    private readonly Face face = new Face();
    private readonly DispatcherTimer follow = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(300) };
    private readonly DispatcherTimer poll = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
    private Forms.NotifyIcon tray;
    private Forms.ToolStripMenuItem followItem, startupItem, topItem;
    private readonly Dictionary<string, Forms.ToolStripMenuItem> zoneItems = new Dictionary<string, Forms.ToolStripMenuItem>();
    private Process collector, detail;
    private IntPtr hwnd, target;
    private DateTime searchAfter = DateTime.MinValue;
    private bool dragging, querying, closing, everAttached;
    private double? offsetX, offsetY;
    private long commandSequence;
    private Native.RECT targetRect;
    private bool standalone = Environment.GetEnvironmentVariable("MODELTIDE_TEST_STANDALONE") == "1";
    public Widget() {
      Title = Locale.T("miniTitle"); Width = 48; Height = 84; Left = 4; Top = 650;
      WindowStyle = WindowStyle.None; ResizeMode = ResizeMode.NoResize; AllowsTransparency = true;
      Background = Brushes.Transparent; Topmost = true; ShowInTaskbar = standalone; ShowActivated = false;
      Content = face;
      SourceInitialized += (s, e) => { hwnd = new WindowInteropHelper(this).Handle; };
      Loaded += async (s, e) => { SetupTray(); StartCollector(); follow.Tick += (a, b) => Follow(); follow.Start(); poll.Tick += async (a, b) => await Update(); poll.Start(); await Update(); };
      face.MouseLeftButtonDown += async (s, e) => {
        if (e.GetPosition(face).Y < 11) {
          dragging = true;
          try { DragMove(); } finally { dragging = false; }
          if (target != IntPtr.Zero) {
            Native.RECT r; Native.GetWindowRect(hwnd, out r); Native.GetWindowRect(target, out targetRect);
            double scale = Native.GetDpiForWindow(target) / 96.0;
            offsetX = (r.left - targetRect.left) / scale; offsetY = (r.top - targetRect.top) / scale;
            try { await Entry.Rpc("settings", new { offset = new { x = offsetX, y = offsetY } }); } catch {}
          }
        } else OpenDetail();
      };
      face.MouseRightButtonUp += (s, e) => { if (tray != null) tray.ContextMenuStrip.Show(Forms.Cursor.Position); };
      Closing += (s, e) => { closing = true; follow.Stop(); poll.Stop(); if (tray != null) tray.Dispose(); if (detail != null) { try { detail.CloseMainWindow(); } catch {} } };
    }
    private void SetupTray() {
      if (tray == null) {
        tray = new Forms.NotifyIcon { Visible = true, Icon = System.Drawing.Icon.ExtractAssociatedIcon(System.Reflection.Assembly.GetExecutingAssembly().Location) };
        tray.DoubleClick += (s, e) => Dispatcher.Invoke(new Action(OpenDetail));
      }
      tray.Text = Locale.T("trayTitle");
      var oldMenu = tray.ContextMenuStrip;
      var menu = new Forms.ContextMenuStrip();
      menu.Items.Add(Locale.T("open"), null, (s, e) => Dispatcher.Invoke(new Action(OpenDetail)));
      menu.Items.Add(Locale.T("refreshStats"), null, async (s, e) => { try { await Entry.Rpc("refresh", null); await Update(); } catch {} });
      menu.Items.Add(Locale.T("reset"), null, async (s, e) => { offsetX = offsetY = null; try { await Entry.Rpc("settings", new { offset = (object)null }); } catch {} Follow(); });
      menu.Items.Add(new Forms.ToolStripSeparator());
      topItem = new Forms.ToolStripMenuItem(Locale.T("alwaysOnTop")); topItem.Checked = true; topItem.Click += async (s, e) => await Setting(new { alwaysOnTop = !topItem.Checked }); menu.Items.Add(topItem);
      var zones = new Forms.ToolStripMenuItem(Locale.T("timezone")); zoneItems.Clear();
      foreach (Dictionary<string, object> zone in Locale.Zones) {
        string id = Convert.ToString(zone["id"]);
        var item = new Forms.ToolStripMenuItem(Convert.ToString(zone[Locale.Language]) + " · " + id);
        item.Click += async (s, e) => await Setting(new { timezone = id });
        zones.DropDownItems.Add(item); zoneItems[id] = item;
      }
      zones.DropDownItems.Add(Locale.T("moreSettings"), null, (s, e) => OpenDetail()); menu.Items.Add(zones);
      var languages = new Forms.ToolStripMenuItem(Locale.T("language"));
      var chinese = new Forms.ToolStripMenuItem("简体中文") { Checked = Locale.Language == "zh-CN" };
      var english = new Forms.ToolStripMenuItem("English") { Checked = Locale.Language == "en" };
      chinese.Click += async (s, e) => await Setting(new { language = "zh-CN" });
      english.Click += async (s, e) => await Setting(new { language = "en" });
      languages.DropDownItems.Add(chinese); languages.DropDownItems.Add(english); menu.Items.Add(languages);
      followItem = new Forms.ToolStripMenuItem(Locale.T("followCodex")); followItem.Click += async (s, e) => await Setting(new { followCodex = !followItem.Checked }); menu.Items.Add(followItem);
      startupItem = new Forms.ToolStripMenuItem(Locale.T("launchAtLogin")); startupItem.Click += async (s, e) => await Setting(new { launchAtLogin = !startupItem.Checked }); menu.Items.Add(startupItem);
      menu.Items.Add(new Forms.ToolStripSeparator());
      menu.Items.Add(Locale.T("quit"), null, (s, e) => Dispatcher.Invoke(new Action(Close)));
      tray.ContextMenuStrip = menu; if (oldMenu != null) oldMenu.Dispose();
    }
    private async Task Setting(object value) {
      try { await Entry.Rpc("settings", value); await Update(); }
      catch (Exception e) { tray.ShowBalloonTip(4000, "ModelTide", e.Message, Forms.ToolTipIcon.Warning); }
    }
    private void StartCollector() {
      try {
        string script = Path.Combine(Entry.Root, "resources", "collector.cjs");
        if (!File.Exists(script)) script = Path.GetFullPath(Path.Combine(Entry.Root, "..", "dist", "collector.cjs"));
        string bundledNode = Path.Combine(Entry.Root, "resources", "node.exe");
        string node = Environment.GetEnvironmentVariable("MODELTIDE_NODE_PATH") ?? (File.Exists(bundledNode) ? bundledNode : "node");
        var info = new ProcessStartInfo(node, "--max-old-space-size=64 --max-semi-space-size=4 \"" + script + "\" --owner-pid=" + Process.GetCurrentProcess().Id) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Entry.Root };
        info.EnvironmentVariables["MODELTIDE_WIDGET_EXE"] = System.Reflection.Assembly.GetExecutingAssembly().Location;
        collector = Process.Start(info);
      } catch (Exception e) { face.Set("!", Locale.T("nodeRequired") + ": " + e.Message); }
    }
    private async Task Update() {
      if (querying || closing) return; querying = true;
      try {
        var result = await Entry.Rpc("snapshot", null);
        var usage = (Dictionary<string, object>)result["usage"];
        var coverage = (Dictionary<string, object>)usage["coverage"];
        var summary = usage["summary"] as Dictionary<string, object>;
        var settings = (Dictionary<string, object>)result["settings"];
        string language = settings.ContainsKey("language") && Convert.ToString(settings["language"]) == "en" ? "en" : "zh-CN";
        if (language != Locale.Language) { Locale.Language = language; Title = Locale.T("miniTitle"); SetupTray(); face.InvalidateVisual(); }
        foreach (var zone in zoneItems) zone.Value.Checked = zone.Key == Convert.ToString(settings["timezone"]);
        if (settings.ContainsKey("followCodex")) followItem.Checked = Convert.ToBoolean(settings["followCodex"]);
        startupItem.Checked = Convert.ToBoolean(settings["launchAtLogin"]);
        if (settings.ContainsKey("alwaysOnTop")) { topItem.Checked = Convert.ToBoolean(settings["alwaysOnTop"]); Topmost = topItem.Checked; }
        var saved = settings["offset"] as Dictionary<string, object>;
        if (!dragging && saved != null) { offsetX = Convert.ToDouble(saved["x"]); offsetY = Convert.ToDouble(saved["y"]); }
        string amount = summary == null ? (Convert.ToString(coverage["state"]) == "indexing" ? "···" : "—") : Compact(Convert.ToDouble(summary["total"]));
        string tooltip = summary == null ? Locale.T("noUsage") : Convert.ToDouble(summary["total"]).ToString("N0", CultureInfo.InvariantCulture) + " Tokens";
        tooltip += "\n" + Locale.T("timezone") + ": " + settings["timezone"] + "\n" + coverage["message"] + "\n" + Locale.T("clickHint");
        if (result.ContainsKey("error") && result["error"] != null) tooltip = Convert.ToString(result["error"]);
        face.Set(amount, tooltip);
        long seq = Convert.ToInt64(result["commandSequence"]);
        if (seq != commandSequence) {
          commandSequence = seq;
          switch (Convert.ToString(result["command"])) { case "open": OpenDetail(); break; case "reset": offsetX = offsetY = null; Follow(); break; case "quit": Close(); break; }
        }
      } catch (Exception e) { face.Set("···", Locale.T("connecting") + ": " + e.Message); }
      finally { querying = false; }
    }
    private static string Compact(double value) {
      double scale = value >= 1e9 ? 1e9 : value >= 1e6 ? 1e6 : value >= 1e3 ? 1e3 : 1;
      string unit = scale == 1e9 ? "B" : scale == 1e6 ? "M" : scale == 1e3 ? "K" : "";
      return (value / scale).ToString(value / scale >= 100 || scale == 1 ? "0" : "0.#", CultureInfo.InvariantCulture) + unit;
    }
    private void OpenDetail() {
      if (detail != null) { try { if (!detail.HasExited) { Native.SetForegroundWindow(detail.MainWindowHandle); return; } } catch {} }
      try {
        string exe = Path.Combine(Entry.Root, "ModelTide-Details.exe");
        string prefix = "";
        if (!File.Exists(exe)) { exe = Path.GetFullPath(Path.Combine(Entry.Root, "..", "node_modules", "electron", "dist", "electron.exe")); prefix = "\"" + Path.GetFullPath(Path.Combine(Entry.Root, "..")) + "\" "; }
        var info = new ProcessStartInfo(exe, prefix + "--x=" + Math.Round(Left) + " --y=" + Math.Round(Top)) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = Entry.Root };
        info.EnvironmentVariables["MODELTIDE_WIDGET_EXE"] = System.Reflection.Assembly.GetExecutingAssembly().Location;
        info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
        detail = Process.Start(info); detail.EnableRaisingEvents = true;
        detail.Exited += (s, e) => { if (!closing) Dispatcher.BeginInvoke(new Action(() => { detail = null; Follow(); })); };
        Hide();
      } catch (Exception e) { face.Set("!", Locale.T("detailFailed") + ": " + e.Message); Show(); }
    }
    private void Follow() {
      if (closing || dragging) return;
      if (detail != null) { try { if (!detail.HasExited) { if (IsVisible) Hide(); return; } } catch {} detail = null; }
      if (standalone) { if (!IsVisible) Show(); if (!Native.IsWindowVisible(hwnd)) Native.ShowWindow(hwnd, 4); return; }
      if (target != IntPtr.Zero && !Native.IsWindow(target)) target = IntPtr.Zero;
      if (DateTime.UtcNow >= searchAfter) {
        IntPtr front = Native.GetForegroundWindow();
        if (IsCodex(front)) target = front;
        else if (target == IntPtr.Zero) Native.EnumWindows((h, p) => { if (IsCodex(h)) { target = h; return false; } return true; }, IntPtr.Zero);
        searchAfter = DateTime.UtcNow.AddSeconds(2);
      }
      if (target == IntPtr.Zero) { if (everAttached && IsVisible) Hide(); return; }
      everAttached = true;
      var foreground = Native.GetForegroundWindow();
      if (Native.IsIconic(target) || !Native.IsWindowVisible(target) || (foreground != target && foreground != hwnd)) { if (IsVisible) Hide(); return; }
      if (!Native.GetWindowRect(target, out targetRect)) return;
      double dpi = Native.GetDpiForWindow(target) / 96.0;
      double dockX = offsetX ?? 2, dockY = offsetY ?? Math.Max(80, (targetRect.bottom - targetRect.top) / dpi - 188);
      int x = targetRect.left + (int)Math.Round(dockX * dpi), y = targetRect.top + (int)Math.Round(dockY * dpi);
      int w = (int)Math.Round(48 * dpi), hgt = (int)Math.Round(84 * dpi);
      var rect = new Native.RECT { left = x, top = y, right = x + w, bottom = y + hgt };
      var monitor = new Native.MONITORINFO { cbSize = Marshal.SizeOf(typeof(Native.MONITORINFO)) };
      Native.GetMonitorInfo(Native.MonitorFromRect(ref rect, 2), ref monitor);
      x = Math.Max(monitor.rcWork.left, Math.Min(x, monitor.rcWork.right - w)); y = Math.Max(monitor.rcWork.top, Math.Min(y, monitor.rcWork.bottom - hgt));
      Native.SetWindowPos(hwnd, IntPtr.Zero, x, y, w, hgt, 0x0014);
      if (!IsVisible) Show(); if (!Native.IsWindowVisible(hwnd)) Native.ShowWindow(hwnd, 4);
    }
    private static bool IsCodex(IntPtr window) {
      if (window == IntPtr.Zero || !Native.IsWindowVisible(window)) return false;
      uint pid; Native.GetWindowThreadProcessId(window, out pid);
      IntPtr process = Native.OpenProcess(0x1000, false, pid); if (process == IntPtr.Zero) return false;
      try {
        var path = new StringBuilder(1024); int length = path.Capacity;
        if (!Native.QueryFullProcessImageName(process, 0, path, ref length)) return false;
        string p = path.ToString();
        return p.IndexOf("\\OpenAI.Codex_", StringComparison.OrdinalIgnoreCase) >= 0 && (p.EndsWith("\\app\\ChatGPT.exe", StringComparison.OrdinalIgnoreCase) || p.EndsWith("\\app\\Codex.exe", StringComparison.OrdinalIgnoreCase));
      } finally { Native.CloseHandle(process); }
    }
  }
  public class Face : FrameworkElement {
    private string amount = "···";
    private ImageSource character;
    private static Brush Bg = Brush("#202020"), Ink = Brush("#F2EFFF"), Accent = Brush("#C4B5F2"), Muted = Brush("#ADA4BF"), Black = Brush("#111016");
    public Face() {
      string path = Path.Combine(Entry.Root, "resources", "logo.png");
      if (!File.Exists(path)) path = Path.GetFullPath(Path.Combine(Entry.Root, "..", "src", "ui", "assets", "logo.png"));
      if (File.Exists(path)) { var image = new BitmapImage(); image.BeginInit(); image.UriSource = new Uri(path); image.CacheOption = BitmapCacheOption.OnLoad; image.DecodePixelWidth = 128; image.EndInit(); image.Freeze(); character = image; }
    }
    private static Brush Brush(string hex) { var b = (SolidColorBrush)new BrushConverter().ConvertFromString(hex); b.Freeze(); return b; }
    public void Set(string value, string tooltip) { ToolTip = tooltip; if (amount != value) { amount = value; InvalidateVisual(); } }
    protected override void OnRender(DrawingContext dc) {
      base.OnRender(dc);
      dc.PushTransform(new ScaleTransform(.75, .75));
      dc.DrawRoundedRectangle(Bg, null, new Rect(0, 0, 64, 112), 4, 4);
      for (int i = 0; i < 3; i++) dc.DrawLine(new Pen(Muted, 1.3), new Point(19 + i * 9, 9), new Point(25 + i * 9, 9));
      if (character != null) dc.DrawImage(character, new Rect(7, 12, 50, 50));
      Text(dc, Locale.T("miniToday"), 10, Accent, 63, true);
      Text(dc, amount, amount.Length > 5 ? 17 : 20, Ink, 75, true);
      Text(dc, "TOKENS", 8.5, Muted, 99, true);
      dc.Pop();
    }
    private void Text(DrawingContext dc, string text, double size, Brush brush, double y, bool bold) {
      var f = new FormattedText(text, CultureInfo.GetCultureInfo("zh-CN"), FlowDirection.LeftToRight, new Typeface(new FontFamily("Segoe UI, Microsoft YaHei UI"), FontStyles.Normal, bold ? FontWeights.Bold : FontWeights.Normal, FontStretches.Normal), size, brush, VisualTreeHelper.GetDpi(this).PixelsPerDip);
      dc.DrawText(f, new Point((64 - f.Width) / 2, y));
    }
  }
  public static class Native {
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor, rcWork; public uint dwFlags; }
    public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr param);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromRect(ref RECT r, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr h, ref MONITORINFO info);
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder path, ref int size);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  }
}
