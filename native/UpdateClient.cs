using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace ModelTide {
  public sealed class ReleaseUpdate {
    public string Version, FileName, DownloadUrl, ChecksumsUrl;
    public long Size;
  }
  public sealed class VerifiedUpdate {
    public string Installer, Sha256;
  }
  public sealed class UpdateClient : IDisposable {
    public const string Repository = "WXH666-bit/ModelTide";
    public const string LatestUrl = "https://api.github.com/repos/" + Repository + "/releases/latest";
    private const long MaximumInstallerSize = 512L * 1024 * 1024;
    private readonly HttpClient http;
    public static string CurrentVersion {
      get { return ((AssemblyInformationalVersionAttribute)Attribute.GetCustomAttribute(Assembly.GetExecutingAssembly(), typeof(AssemblyInformationalVersionAttribute))).InformationalVersion; }
    }
    public UpdateClient() : this(new HttpClient()) { }
    public UpdateClient(HttpClient client) {
      http = client;
      ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
      http.Timeout = Timeout.InfiniteTimeSpan;
      http.DefaultRequestHeaders.UserAgent.ParseAdd("ModelTide/" + CurrentVersion);
      http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
    }
    public static bool IsNewer(string release, string current) {
      if (!Regex.IsMatch(release ?? "", @"\A(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\z")) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
      Version next, installed;
      if (!Version.TryParse(release, out next) || !Version.TryParse(current.Split('-')[0], out installed)) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
      int order = next.CompareTo(installed);
      return order > 0 || (order == 0 && current.Contains("-"));
    }
    public static ReleaseUpdate ParseRelease(string json, string current) {
      var value = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
      if (value == null || !value.ContainsKey("draft") || !value.ContainsKey("prerelease") || Convert.ToBoolean(value["draft"]) || Convert.ToBoolean(value["prerelease"])) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
      string tag = Convert.ToString(value["tag_name"]);
      if (!tag.StartsWith("v", StringComparison.Ordinal)) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
      string version = tag.Substring(1);
      if (!IsNewer(version, current)) return null;
      string name = "ModelTide-" + version + "-Setup-x64.exe";
      string prefix = "https://github.com/" + Repository + "/releases/download/" + tag + "/";
      var result = new ReleaseUpdate { Version = version, FileName = name };
      foreach (Dictionary<string, object> asset in (IEnumerable)value["assets"]) {
        string assetName = Convert.ToString(asset["name"]);
        if (assetName != name && assetName != "SHA256SUMS.txt") continue;
        string url = Convert.ToString(asset["browser_download_url"]);
        if (url != prefix + assetName || Convert.ToString(asset["state"]) != "uploaded") throw new InvalidDataException(Locale.T("updateInvalidRelease"));
        if (assetName == name) {
          if (result.DownloadUrl != null) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
          result.DownloadUrl = url; result.Size = Convert.ToInt64(asset["size"]);
        } else {
          if (result.ChecksumsUrl != null) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
          result.ChecksumsUrl = url;
        }
      }
      if (result.DownloadUrl == null || result.ChecksumsUrl == null || result.Size <= 0 || result.Size > MaximumInstallerSize) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
      return result;
    }
    private async Task<string> ReadText(string url, int limit, CancellationToken token) {
      try {
      using (var reply = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token)) {
        using (token.Register(() => reply.Dispose())) {
        CheckStatus(reply);
        using (var input = await reply.Content.ReadAsStreamAsync())
        using (var output = new MemoryStream()) {
          var buffer = new byte[8192]; int count;
          while ((count = await input.ReadAsync(buffer, 0, buffer.Length, token)) != 0) {
            if (output.Length + count > limit) throw new InvalidDataException(Locale.T("updateInvalidRelease"));
            output.Write(buffer, 0, count);
          }
          return Encoding.UTF8.GetString(output.ToArray()).TrimStart('\uFEFF');
        }
        }
      }
      } catch { token.ThrowIfCancellationRequested(); throw; }
    }
    private static void CheckStatus(HttpResponseMessage response) {
      if (response.StatusCode == HttpStatusCode.Forbidden || (int)response.StatusCode == 429) throw new IOException(Locale.T("updateRateLimit"));
      response.EnsureSuccessStatusCode();
    }
    public async Task<ReleaseUpdate> Check(CancellationToken token) {
      using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(token)) {
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        return ParseRelease(await ReadText(LatestUrl, 1024 * 1024, timeout.Token), CurrentVersion);
      }
    }
    public static string ParseChecksum(string text, string fileName) {
      string found = null;
      foreach (string line in text.Split('\n')) {
        var match = Regex.Match(line.Trim(), @"\A([a-fA-F0-9]{64})\s+\*?(.+)\z");
        if (!match.Success || match.Groups[2].Value != fileName) continue;
        if (found != null) throw new InvalidDataException(Locale.T("updateHashMismatch"));
        found = match.Groups[1].Value.ToLowerInvariant();
      }
      if (found == null) throw new InvalidDataException(Locale.T("updateHashMismatch"));
      return found;
    }
    public static string HashFile(string path) {
      using (var file = File.OpenRead(path)) using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(file)).Replace("-", "").ToLowerInvariant();
    }
    public async Task<VerifiedUpdate> Download(ReleaseUpdate release, string directory, IProgress<int> progress, CancellationToken token) {
      Directory.CreateDirectory(directory);
      string destination = Path.Combine(directory, release.FileName), partial = destination + ".download";
      using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(token)) {
        timeout.CancelAfter(TimeSpan.FromMinutes(20));
        string hash = ParseChecksum(await ReadText(release.ChecksumsUrl, 65536, timeout.Token), release.FileName);
        try {
          using (var reply = await http.GetAsync(release.DownloadUrl, HttpCompletionOption.ResponseHeadersRead, timeout.Token)) {
            using (timeout.Token.Register(() => reply.Dispose())) {
            CheckStatus(reply);
            if (reply.Content.Headers.ContentLength.HasValue && reply.Content.Headers.ContentLength != release.Size) throw new InvalidDataException(Locale.T("updateIncomplete"));
            using (var input = await reply.Content.ReadAsStreamAsync())
            using (var output = new FileStream(partial, FileMode.Create, FileAccess.Write, FileShare.None, 65536, true)) {
              var buffer = new byte[65536]; int count, last = -1; long received = 0;
              while ((count = await input.ReadAsync(buffer, 0, buffer.Length, timeout.Token)) != 0) {
                received += count;
                if (received > release.Size) throw new InvalidDataException(Locale.T("updateIncomplete"));
                await output.WriteAsync(buffer, 0, count, timeout.Token);
                int percent = (int)(received * 100 / release.Size);
                if (percent != last) { progress.Report(percent); last = percent; }
              }
              if (received != release.Size) throw new InvalidDataException(Locale.T("updateIncomplete"));
            }
            }
          }
          if (await Task.Run(() => HashFile(partial), timeout.Token) != hash) throw new InvalidDataException(Locale.T("updateHashMismatch"));
          if (File.Exists(destination)) File.Delete(destination);
          File.Move(partial, destination);
          return new VerifiedUpdate { Installer = destination, Sha256 = hash };
        } catch { timeout.Token.ThrowIfCancellationRequested(); throw; }
        finally { if (File.Exists(partial)) File.Delete(partial); }
      }
    }
    public void Dispose() { http.Dispose(); }
  }
}
