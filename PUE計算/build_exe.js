const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

console.log('=== PUE Calculator Standalone EXE Packager with Custom Icon ===');

const rootDir = path.resolve(__dirname);
const fileEntries = [];

function addFile(relPath) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) return;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
        const children = fs.readdirSync(fullPath);
        children.forEach(c => addFile(path.join(relPath, c)));
    } else {
        const normalized = relPath.replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath);
        fileEntries.push({ path: normalized, content: content });
    }
}

// Add files
addFile('index.html');
addFile('app_icon.png');
addFile('app_icon.ico');
addFile('js');
addFile('device_catalog');
addFile('weather');

console.log(`Total files to embed: ${fileEntries.length}`);

const buffers = [];
const headerBuf = Buffer.alloc(4);
headerBuf.writeUInt32LE(fileEntries.length, 0);
buffers.push(headerBuf);

for (const entry of fileEntries) {
    const pathBuf = Buffer.from(entry.path, 'utf8');
    const pathLenBuf = Buffer.alloc(2);
    pathLenBuf.writeUInt16LE(pathBuf.length, 0);
    
    const dataLenBuf = Buffer.alloc(4);
    dataLenBuf.writeUInt32LE(entry.content.length, 0);

    buffers.push(pathLenBuf);
    buffers.push(pathBuf);
    buffers.push(dataLenBuf);
    buffers.push(entry.content);
}

const rawBundle = Buffer.concat(buffers);
console.log(`Raw bundle size: ${(rawBundle.length / 1024).toFixed(1)} KB`);

const gzippedBundle = zlib.gzipSync(rawBundle, { level: 9 });
console.log(`Compressed bundle size: ${(gzippedBundle.length / 1024).toFixed(1)} KB`);

const bundlePath = path.join(rootDir, 'assets.bin');
fs.writeFileSync(bundlePath, gzippedBundle);

const csharpSource = `
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace PueCalculator
{
    static class Program
    {
        private static Dictionary<string, byte[]> _files = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);
        private static HttpListener _listener;
        private static int _port;
        private static NotifyIcon _trayIcon;
        private static Process _browserProc;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            LoadEmbeddedAssets();
            _port = GetAvailablePort();
            StartHttpServer();
            SetupTray();
            LaunchApp();

            Application.Run();
        }

        private static void LoadEmbeddedAssets()
        {
            var assembly = Assembly.GetExecutingAssembly();
            using (var stream = assembly.GetManifestResourceStream("assets.bin"))
            {
                if (stream == null)
                {
                    MessageBox.Show("資源加載失敗 (Resource not found)", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    Environment.Exit(1);
                }

                using (var gz = new GZipStream(stream, CompressionMode.Decompress))
                using (var ms = new MemoryStream())
                {
                    gz.CopyTo(ms);
                    byte[] raw = ms.ToArray();

                    using (var reader = new BinaryReader(new MemoryStream(raw)))
                    {
                        int fileCount = reader.ReadInt32();
                        for (int i = 0; i < fileCount; i++)
                        {
                            short pathLen = reader.ReadInt16();
                            byte[] pathBytes = reader.ReadBytes(pathLen);
                            string filePath = Encoding.UTF8.GetString(pathBytes).TrimStart('/');
                            
                            int dataLen = reader.ReadInt32();
                            byte[] fileData = reader.ReadBytes(dataLen);
                            _files[filePath] = fileData;
                        }
                    }
                }
            }
        }

        private static int GetAvailablePort()
        {
            var l = new TcpListener(IPAddress.Loopback, 0);
            l.Start();
            int port = ((IPEndPoint)l.LocalEndpoint).Port;
            l.Stop();
            return port;
        }

        private static void StartHttpServer()
        {
            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add("http://127.0.0.1:" + _port + "/");
                _listener.Start();

                ThreadPool.QueueUserWorkItem((o) =>
                {
                    while (_listener != null && _listener.IsListening)
                    {
                        try
                        {
                            var ctx = _listener.GetContext();
                            ThreadPool.QueueUserWorkItem((c) => ProcessRequest((HttpListenerContext)c), ctx);
                        }
                        catch { }
                    }
                });
            }
            catch (Exception ex)
            {
                MessageBox.Show("伺服器啟動失敗: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Environment.Exit(1);
            }
        }

        private static void ProcessRequest(HttpListenerContext ctx)
        {
            try
            {
                string rawUrl = ctx.Request.Url.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(rawUrl)) rawUrl = "index.html";
                rawUrl = Uri.UnescapeDataString(rawUrl);

                byte[] data;
                if (_files.TryGetValue(rawUrl, out data))
                {
                    ctx.Response.StatusCode = 200;
                    ctx.Response.ContentType = GetMimeType(rawUrl);
                    ctx.Response.ContentLength64 = data.Length;
                    ctx.Response.Headers.Add("Cache-Control", "no-cache");
                    ctx.Response.OutputStream.Write(data, 0, data.Length);
                }
                else
                {
                    ctx.Response.StatusCode = 404;
                    byte[] notFound = Encoding.UTF8.GetBytes("404 Not Found: " + rawUrl);
                    ctx.Response.OutputStream.Write(notFound, 0, notFound.Length);
                }
            }
            catch { }
            finally
            {
                try { ctx.Response.OutputStream.Close(); } catch { }
            }
        }

        private static string GetMimeType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": case ".htm": return "text/html; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg": case ".jpeg": return "image/jpeg";
                case ".ico": return "image/x-icon";
                case ".epw": return "text/plain; charset=utf-8";
                case ".csv": return "text/csv; charset=utf-8";
                default: return "application/octet-stream";
            }
        }

        private static void LaunchApp()
        {
            string url = "http://127.0.0.1:" + _port + "/";
            string edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
            if (!File.Exists(edgePath))
            {
                edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe");
            }

            try
            {
                if (File.Exists(edgePath))
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = edgePath,
                        Arguments = "--app=" + url + " --window-size=1440,900",
                        UseShellExecute = false
                    };
                    _browserProc = Process.Start(psi);
                    if (_browserProc != null)
                    {
                        _browserProc.EnableRaisingEvents = true;
                        _browserProc.Exited += (s, e) =>
                        {
                            ExitApp();
                        };
                    }
                }
                else
                {
                    Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
            }
            catch
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
        }

        private static void SetupTray()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("🌐 開啟 PUE 計算系統", null, (s, e) => LaunchApp());
            menu.Items.Add("-");
            menu.Items.Add("❌ 結束退出 (Exit)", null, (s, e) => ExitApp());

            Icon customIcon = null;
            byte[] iconBytes;
            if (_files.TryGetValue("app_icon.ico", out iconBytes))
            {
                try
                {
                    using (var ms = new MemoryStream(iconBytes))
                    {
                        customIcon = new Icon(ms);
                    }
                }
                catch { }
            }

            _trayIcon = new NotifyIcon
            {
                Icon = customIcon ?? SystemIcons.Application,
                ContextMenuStrip = menu,
                Text = "PUE 計算系統 (運行中)",
                Visible = true
            };
        }

        private static void ExitApp()
        {
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
            }
            if (_listener != null)
            {
                try { _listener.Stop(); } catch { }
            }
            Application.Exit();
            Environment.Exit(0);
        }
    }
}
`;

const csPath = path.join(rootDir, 'Program.cs');
fs.writeFileSync(csPath, csharpSource);

const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const outExe = path.join(rootDir, 'PUE計算系統.exe');
const iconPath = path.join(rootDir, 'app_icon.ico');

console.log('Compiling C# standalone application with icon...');
const cmd = `"${cscPath}" /target:winexe /out:"${outExe}" /win32icon:"${iconPath}" /optimize+ /resource:"${bundlePath}",assets.bin /reference:System.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "${csPath}"`;

try {
    execSync(cmd, { stdio: 'inherit' });
    console.log('\n✅ SUCCESS! Generated standalone executable with custom icon:');
    console.log(`   📂 ${outExe}`);
    const exeStat = fs.statSync(outExe);
    console.log(`   📦 Size: ${(exeStat.size / (1024 * 1024)).toFixed(2)} MB`);
} catch (err) {
    console.error('Compilation failed:', err);
} finally {
    if (fs.existsSync(bundlePath)) fs.unlinkSync(bundlePath);
    if (fs.existsSync(csPath)) fs.unlinkSync(csPath);
}
