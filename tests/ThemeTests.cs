using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ModelTide;
using Forms = System.Windows.Forms;
using Drawing = System.Drawing;
class ThemeTests {
  [STAThread] static void Main(string[] args) {
    Entry.Pipe = "modeltide-theme-test-" + System.Diagnostics.Process.GetCurrentProcess().Id;
    var widget = new Widget();
    var setup = typeof(Widget).GetMethod("SetupTray", BindingFlags.Instance | BindingFlags.NonPublic);
    var trayField = typeof(Widget).GetField("tray", BindingFlags.Instance | BindingFlags.NonPublic);
    var themesField = typeof(Widget).GetField("themeItems", BindingFlags.Instance | BindingFlags.NonPublic);
    foreach (string id in Theme.Ids) {
      Theme.Set(id); Locale.Language = id == "light" ? "en" : "zh-CN";
      setup.Invoke(widget, null);
      var tray = (Forms.NotifyIcon)trayField.GetValue(widget);
      var items = (Dictionary<string, Forms.ToolStripMenuItem>)themesField.GetValue(widget);
      if (!items[id].Checked || items[id].Text != Theme.Label(id)) throw new Exception("Theme menu selection or translation missing");
      int checkedCount = 0; foreach (var item in items.Values) if (item.Checked) checkedCount++;
      if (checkedCount != 1 || tray.ContextMenuStrip.BackColor != Theme.Color("bg")) throw new Exception("Menu did not receive the selected theme");
      var face = (Face)widget.Content; face.Set("327M", "327,000,000 Tokens"); face.InvalidateVisual();
      face.Measure(new Size(48, 84)); face.Arrange(new Rect(0, 0, 48, 84)); face.UpdateLayout();
      var bitmap = new RenderTargetBitmap(72, 126, 144, 144, PixelFormats.Pbgra32); bitmap.Render(face);
      byte[] pixel = new byte[4]; bitmap.CopyPixels(new Int32Rect(36, 124, 1, 1), pixel, 4, 0);
      var bg = Theme.Color("bg");
      if (pixel[0] != bg.B || pixel[1] != bg.G || pixel[2] != bg.R) throw new Exception("Widget kept the old theme: " + id);
      var png = new PngBitmapEncoder(); png.Frames.Add(BitmapFrame.Create(bitmap));
      using (var file = File.Create(Path.Combine(args[0], "widget-" + id + ".png"))) png.Save(file);
      // Render the real WinForms menu and its theme submenu for visual review.
      var menu = tray.ContextMenuStrip; menu.Show(new Drawing.Point(20, 20)); Forms.Application.DoEvents();
      using (var image = new Drawing.Bitmap(menu.Width, menu.Height)) {
        menu.DrawToBitmap(image, new Drawing.Rectangle(Drawing.Point.Empty, image.Size)); image.Save(Path.Combine(args[0], "tray-" + id + ".png"));
      }
      menu.Close();
    }
    ((Forms.NotifyIcon)trayField.GetValue(widget)).Dispose();
    if (Theme.Normalize("invalid") != "violet") throw new Exception("Missing legacy theme fallback");
    Console.WriteLine("PASS: native widget paints, menu colors, exclusive selection, labels and legacy fallback.");
  }
}
