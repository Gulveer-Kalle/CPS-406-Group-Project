const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const appIconPath = path.join(__dirname, 'src/assets/images/Logo.png');
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Maximize the window when it opens
  win.maximize();

  // Load the login page using file:// protocol
  const loginPath = path.join(__dirname, 'src/pages/login.html');
  win.loadFile(loginPath);
}

app.whenReady().then(() => {
  createWindow();
});
