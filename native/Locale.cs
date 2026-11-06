using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Web.Script.Serialization;
namespace ModelTide {
  public static class Locale {
    private static readonly Dictionary<string, object> Catalog = Load();
    public static string Language = "zh-CN";
    private static Dictionary<string, object> Load() {
      using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ModelTide.locales.json"))
      using (var reader = new StreamReader(stream)) return new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
    }
    public static string T(string key) {
      var messages = (Dictionary<string, object>)Catalog["messages"];
      return Convert.ToString(((Dictionary<string, object>)messages[Language])[key]);
    }
    public static IEnumerable Zones { get { return (IEnumerable)Catalog["timezones"]; } }
  }
}
