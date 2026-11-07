using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows.Media;
using Drawing = System.Drawing;
using Forms = System.Windows.Forms;
namespace ModelTide {
  public static class Theme {
    private static readonly Dictionary<string, object> Catalog = Load();
    private static readonly Dictionary<string, object> Choices = (Dictionary<string, object>)Catalog["themes"];
    private static readonly Dictionary<string, Brush> Brushes = new Dictionary<string, Brush>();
    public static string Id = Convert.ToString(Catalog["default"]);
    public static IEnumerable<string> Ids { get { return Choices.Keys; } }
    private static Dictionary<string, object> Load() {
      using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ModelTide.themes.json"))
      using (var reader = new StreamReader(stream)) return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
    }
    public static string Normalize(string id) { return id != null && Choices.ContainsKey(id) ? id : Convert.ToString(Catalog["default"]); }
    public static string Label(string id) { return Locale.T(Convert.ToString(((Dictionary<string, object>)Choices[id])["label"])); }
    public static bool Set(string id) {
      id = Normalize(id); if (id == Id) return false;
      Id = id; Brushes.Clear(); return true;
    }
    public static string Hex(string role) { return Convert.ToString(((Dictionary<string, object>)((Dictionary<string, object>)Choices[Id])["colors"])[role]); }
    public static Drawing.Color Color(string role) { return Drawing.ColorTranslator.FromHtml(Hex(role)); }
    public static Brush Brush(string role) {
      Brush brush;
      if (!Brushes.TryGetValue(role, out brush)) {
        var solid = (SolidColorBrush)new BrushConverter().ConvertFromString(Hex(role)); solid.Freeze(); Brushes[role] = brush = solid;
      }
      return brush;
    }
    public static void ApplyMenu(Forms.ToolStrip menu) {
      menu.Renderer = new MenuRenderer(); menu.BackColor = Color("bg"); menu.ForeColor = Color("ink");
      foreach (Forms.ToolStripItem item in menu.Items) {
        item.ForeColor = Color("ink");
        var sub = item as Forms.ToolStripDropDownItem;
        if (sub != null && sub.HasDropDownItems) ApplyMenu(sub.DropDown);
      }
    }
    private class MenuColors : Forms.ProfessionalColorTable {
      public MenuColors() { UseSystemColors = false; }
      public override Drawing.Color ToolStripDropDownBackground { get { return Color("bg"); } }
      public override Drawing.Color MenuBorder { get { return Color("line"); } }
      public override Drawing.Color MenuItemBorder { get { return Color("accent"); } }
      public override Drawing.Color MenuItemSelected { get { return Color("selected"); } }
      public override Drawing.Color MenuItemSelectedGradientBegin { get { return Color("selected"); } }
      public override Drawing.Color MenuItemSelectedGradientEnd { get { return Color("selected"); } }
      public override Drawing.Color MenuItemPressedGradientBegin { get { return Color("selected"); } }
      public override Drawing.Color MenuItemPressedGradientMiddle { get { return Color("selected"); } }
      public override Drawing.Color MenuItemPressedGradientEnd { get { return Color("selected"); } }
      public override Drawing.Color ImageMarginGradientBegin { get { return Color("surface"); } }
      public override Drawing.Color ImageMarginGradientMiddle { get { return Color("surface"); } }
      public override Drawing.Color ImageMarginGradientEnd { get { return Color("surface"); } }
      public override Drawing.Color CheckBackground { get { return Color("selected"); } }
      public override Drawing.Color CheckSelectedBackground { get { return Color("selected"); } }
      public override Drawing.Color CheckPressedBackground { get { return Color("selected"); } }
      public override Drawing.Color SeparatorDark { get { return Color("line"); } }
      public override Drawing.Color SeparatorLight { get { return Color("line"); } }
    }
    private class MenuRenderer : Forms.ToolStripProfessionalRenderer {
      public MenuRenderer() : base(new MenuColors()) { RoundedEdges = false; }
      protected override void OnRenderItemText(Forms.ToolStripItemTextRenderEventArgs e) {
        Forms.TextRenderer.DrawText(e.Graphics, e.Text, e.TextFont, e.TextRectangle, Color(e.Item.Enabled ? "ink" : "muted"), e.TextFormat);
      }
      protected override void OnRenderArrow(Forms.ToolStripArrowRenderEventArgs e) { e.ArrowColor = Color("ink"); base.OnRenderArrow(e); }
      protected override void OnRenderItemCheck(Forms.ToolStripItemImageRenderEventArgs e) {
        var r = e.ImageRectangle;
        using (var pen = new Drawing.Pen(Color("accent"), 2)) e.Graphics.DrawLines(pen, new[] {
          new Drawing.Point(r.Left + 2, r.Top + r.Height / 2),
          new Drawing.Point(r.Left + r.Width / 2 - 1, r.Bottom - 3),
          new Drawing.Point(r.Right - 2, r.Top + 3)
        });
      }
    }
  }
}
