using System;
using System.Reflection;
class VisibilityTests {
  static int Main(string[] args) {
    var method = Assembly.LoadFrom(args[0]).GetType("ModelTide.Native").GetMethod("ShouldShowWidget");
    var cases = new[] {
      new { Name = "Codex active", Only = true, Usable = true, Active = true, Expected = true },
      new { Name = "another application active", Only = true, Usable = true, Active = false, Expected = false },
      new { Name = "Codex closed before first attachment", Only = true, Usable = false, Active = false, Expected = false },
      new { Name = "Codex minimized even if widget was active", Only = true, Usable = false, Active = true, Expected = false },
      new { Name = "desktop mode with another app active", Only = false, Usable = true, Active = false, Expected = true },
      new { Name = "desktop mode with Codex closed", Only = false, Usable = false, Active = false, Expected = true },
      new { Name = "desktop mode with Codex minimized", Only = false, Usable = false, Active = true, Expected = true },
      new { Name = "desktop mode with Codex active", Only = false, Usable = true, Active = true, Expected = true }
    };
    foreach (var item in cases) if ((bool)method.Invoke(null, new object[] {item.Only, item.Usable, item.Active}) != item.Expected) throw new Exception(item.Name);
    Console.WriteLine("PASS: 8 native widget visibility cases."); return 0;
  }
}
