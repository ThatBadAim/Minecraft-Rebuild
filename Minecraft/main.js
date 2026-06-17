const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let server;
let port;

function startServer() {
  server = http.createServer((req, res) => {
    // Parse URL path, ignoring query parameters (e.g. index.html?foo=bar)
    const urlPath = req.url.split('?')[0];
    const safeUrlPath = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(__dirname, safeUrlPath);

    // Prevent directory traversal attacks
    if (!filePath.startsWith(__dirname)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404 - File Not Found');
      } else {
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';

        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.json': 'application/json'
        };

        if (mimeTypes[ext]) {
          contentType = mimeTypes[ext];
        }

        res.setHeader('Content-Type', contentType);
        res.end(content);
      }
    });
  });

  // Start server on localhost with a randomly assigned open port (port = 0)
  server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
    console.log(`Internal server running at http://127.0.0.1:${port}`);
    createWindow();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Minecraft Voxel Web Clone",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false // Keep performance high even if out of focus
    }
  });

  // Optimize window settings for performance
  win.setMenuBarVisibility(false); // Hide menu bar for full immersion

  // Open Developer Tools for performance and WebGL diagnostics
  win.webContents.openDevTools();

  // Redirect renderer process console to terminal
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] ${message} (at ${sourceId}:${line})`);
  });

  win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

// Enable WebGL hardware acceleration flags in Electron to optimize Three.js rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

app.whenReady().then(() => {
  startServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
