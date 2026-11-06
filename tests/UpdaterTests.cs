using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using ModelTide;

class UpdateFixtureHandler : HttpMessageHandler {
  public byte[] Payload;
  public string Digest;
  public string ReleaseJson;
  public HttpStatusCode Status = HttpStatusCode.OK;
  public bool FailDownload;
  public bool Stall;
  protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
    token.ThrowIfCancellationRequested();
    string path = request.RequestUri.AbsolutePath;
    if (FailDownload && path.EndsWith(".exe")) throw new HttpRequestException("fixture disconnected");
    var response = new HttpResponseMessage(Status);
    response.Content = path.EndsWith("/latest") ? (HttpContent)new StringContent(ReleaseJson) : path.EndsWith(".txt") ? new StringContent(Digest + "  ModelTide-9.0.0-Setup-x64.exe\n") : new ByteArrayContent(Payload);
    if (path.EndsWith(".exe")) {
      if (Stall) response.Content = new StreamContent(new StalledStream());
      response.Content.Headers.ContentLength = 262144;
    }
    return Task.FromResult(response);
  }
  sealed class StalledStream : MemoryStream {
    readonly TaskCompletionSource<int> pending = new TaskCompletionSource<int>();
    public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token) { return pending.Task; }
    protected override void Dispose(bool disposing) { pending.TrySetException(new ObjectDisposedException("fixture stalled connection")); base.Dispose(disposing); }
  }
}
class UpdaterTests {
  static int assertions;
  static void Assert(bool value, string message) { if (!value) throw new Exception(message); assertions++; }
  static void Reject(Action action, string message) { try { action(); } catch { assertions++; return; } throw new Exception(message); }
  static async Task RejectAsync(Func<Task> action, string message) { try { await action(); } catch { assertions++; return; } throw new Exception(message); }
  static string Digest(byte[] bytes) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant(); }
  static Dictionary<string, object> Release() {
    string prefix = "https://github.com/WXH666-bit/ModelTide/releases/download/v9.0.0/";
    return new Dictionary<string, object> {
      {"tag_name", "v9.0.0"}, {"draft", false}, {"prerelease", false},
      {"assets", new[] {
        new Dictionary<string, object> {{"name", "ModelTide-9.0.0-Setup-x64.exe"}, {"browser_download_url", prefix + "ModelTide-9.0.0-Setup-x64.exe"}, {"state", "uploaded"}, {"size", 262144}},
        new Dictionary<string, object> {{"name", "SHA256SUMS.txt"}, {"browser_download_url", prefix + "SHA256SUMS.txt"}, {"state", "uploaded"}, {"size", 100}}
      }}
    };
  }
  static async Task Run(string directory) {
    Locale.Language = "en";
    Assert(UpdateClient.IsNewer("1.10.0", "1.9.9"), "numeric version comparison");
    Assert(!UpdateClient.IsNewer("1.2.0", "1.2.0"), "same version");
    Assert(!UpdateClient.IsNewer("1.2.0", "1.3.0-dev.1"), "never downgrade development build");
    Assert(UpdateClient.IsNewer("1.3.0", "1.3.0-dev.1"), "stable replaces matching prerelease");
    foreach (string invalid in new[] {"1.2", "01.2.3", "1.2.3\n", "1.2.3/../bad", "1.2.3-beta.1"}) Reject(() => UpdateClient.IsNewer(invalid, "1.0.0"), "malformed stable version");
    var json = new JavaScriptSerializer();
    var source = Release();
    string releaseJson = json.Serialize(source);
    var release = UpdateClient.ParseRelease(releaseJson, "0.1.0");
    Assert(release.Version == "9.0.0" && release.Size == 262144, "exact x64 asset selection");
    Assert(UpdateClient.ParseRelease(releaseJson, "9.1.0") == null, "old release ignored");
    source["draft"] = true; Reject(() => UpdateClient.ParseRelease(json.Serialize(source), "0.1.0"), "draft rejected"); source["draft"] = false;
    source["prerelease"] = true; Reject(() => UpdateClient.ParseRelease(json.Serialize(source), "0.1.0"), "prerelease rejected"); source["prerelease"] = false;
    var assets = (Dictionary<string, object>[])source["assets"];
    assets[0]["browser_download_url"] = "https://example.com/installer.exe";
    Reject(() => UpdateClient.ParseRelease(json.Serialize(source), "0.1.0"), "untrusted asset URL rejected");
    source = Release(); assets = (Dictionary<string, object>[])source["assets"]; assets[0]["size"] = 0;
    Reject(() => UpdateClient.ParseRelease(json.Serialize(source), "0.1.0"), "invalid download size");
    source["assets"] = new[] {assets[0]}; Reject(() => UpdateClient.ParseRelease(json.Serialize(source), "0.1.0"), "missing checksum asset");
    var payload = new byte[262144]; for (int i = 0; i < payload.Length; i++) payload[i] = (byte)i;
    string digest = Digest(payload), name = release.FileName;
    Assert(UpdateClient.ParseChecksum(digest.ToUpperInvariant() + " *" + name + "\r\n", name) == digest, "checksum syntax");
    Reject(() => UpdateClient.ParseChecksum(digest + " wrong.exe", name), "missing checksum");
    Reject(() => UpdateClient.ParseChecksum(digest + " " + name + "\n" + digest + " " + name, name), "duplicate checksum");
    var handler = new UpdateFixtureHandler { Payload = payload, Digest = digest, ReleaseJson = releaseJson };
    using (var client = new UpdateClient(new HttpClient(handler))) {
      Assert((await client.Check(CancellationToken.None)).Version == "9.0.0", "check endpoint");
      int percent = -1; var progress = new InlineProgress(p => percent = p);
      var downloaded = await client.Download(release, directory, progress, CancellationToken.None);
      Assert(UpdateClient.HashFile(downloaded.Installer) == digest && downloaded.Sha256 == digest && percent == 100, "streamed download verified");
      handler.Digest = new string('0', 64);
      await RejectAsync(async () => { await client.Download(release, directory, progress, CancellationToken.None); }, "corrupt download rejected");
      Assert(!File.Exists(downloaded.Installer + ".download") && UpdateClient.HashFile(downloaded.Installer) == digest, "partial removed; previous verified file intact");
      handler.Digest = digest; handler.Payload = new byte[20];
      await RejectAsync(async () => { await client.Download(release, directory, progress, CancellationToken.None); }, "truncated download rejected");
      handler.Payload = payload; handler.FailDownload = true;
      await RejectAsync(async () => { await client.Download(release, directory, progress, CancellationToken.None); }, "disconnected download rejected");
      handler.FailDownload = false;
      handler.Stall = true;
      using (var stop = new CancellationTokenSource(100)) {
        var stalled = client.Download(release, directory, progress, stop.Token);
        Assert(await Task.WhenAny(stalled, Task.Delay(3000)) == stalled, "cancellation aborts a stalled network stream");
        await RejectAsync(async () => { await stalled; }, "stalled download cancelled");
        Assert(!File.Exists(downloaded.Installer + ".download"), "cancel removes partial file");
      }
      handler.Stall = false;
      var cancelled = new CancellationTokenSource(); cancelled.Cancel();
      await RejectAsync(async () => { await client.Download(release, directory, progress, cancelled.Token); }, "cancellation stops download");
      handler.Status = HttpStatusCode.Forbidden;
      await RejectAsync(async () => { await client.Check(CancellationToken.None); }, "rate limit handled");
      handler.Status = HttpStatusCode.NotFound;
      await RejectAsync(async () => { await client.Check(CancellationToken.None); }, "missing release handled");
      handler.Status = HttpStatusCode.OK;
      Assert((await client.Check(CancellationToken.None)).Version == "9.0.0", "check can retry after failures");
    }
    string target = Path.Combine(directory, "app with spaces");
    Assert(UpdateInstaller.InstallerArguments(target) == "/S /UPDATE /D=" + Path.GetFullPath(target), "NSIS unquoted last directory argument");
    Reject(() => UpdateInstaller.InstallerArguments("relative"), "relative directory rejected");
    Reject(() => UpdateInstaller.InstallerArguments(target + "\""), "quoted directory rejected");
    string identity = "modeltide-1111111111111111";
    using (var updating = new EventWaitHandle(false, EventResetMode.ManualReset, UpdateInstaller.EventName(identity))) {
      Assert(!UpdateInstaller.IsUpdating(identity), "idle event"); updating.Set();
      Assert(UpdateInstaller.IsUpdating(identity), "update coordination event"); updating.Reset();
    }
    Console.WriteLine("PASS: " + assertions + " updater checks (versions, release selection, downloads, hashes, cancellation, retry, installer arguments and coordination).");
  }
  static int Main(string[] args) { try { Run(args[0]).GetAwaiter().GetResult(); return 0; } catch (Exception e) { Console.Error.WriteLine(e); return 1; } }
  sealed class InlineProgress : IProgress<int> { readonly Action<int> action; public InlineProgress(Action<int> value) { action = value; } public void Report(int value) { action(value); } }
}
