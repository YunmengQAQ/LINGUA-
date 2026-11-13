'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  screen,
  desktopCapturer,
  nativeImage,
  nativeTheme,
  shell,
  dialog,
  clipboard,
  Notification
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { startServer } = require('./server');

const APP_ID = 'com.lingua.translator';
const DEFAULT_HOTKEY = 'Control+Shift+F2';
const DEFAULT_AUTO_HOTKEY = 'Control+Alt+A';
const SERVER_PORT = 47831;
let currentHotkey = DEFAULT_HOTKEY;
let currentAutoHotkey = DEFAULT_AUTO_HOTKEY;
let hotkeySuspended = false;

let mainWindow = null;
let tray = null;
let trayTipShown = false;
let isQuitting = false;
let serverHandle = null;
let serverUrl = '';
let snipInProgress = false;
let activeOverlay = null;
let snipImage = null;
let snipDisplay = null;
let snipOverlayBounds = null;
let overlayResolved = false;
let mainWindowPromise = null;

let resultWindow = null;
let resultState = null;
let resultToken = null;
let resultAnchor = null;
let resultDisplay = null;
let resultWidth = 420;
let resultHeight = 144;
let resultLoaded = false;
let resultWindowSize = null;
let resultInline = false;
let snipMode = 'single';
let autoSession = null;
let inlineSession = null;
let snipResultOpacity = 0.8;
let autoResultOpacity = 0.8;

if (process.env.LINGUA_DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', String(process.env.LINGUA_DEBUG_PORT));
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.setName('LINGUA');
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
nativeTheme.themeSource = 'light';

function assetPath(name) {
  return path.join(__dirname, 'assets', name);
}

function logLine(message) {
  try {
    const file = path.join(app.getPath('userData'), 'lingua-main.log');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch (error) {
    /* logging must never break the app */
  }
}

function settingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function disclaimerFlagPath() {
  return path.join(app.getPath('userData'), 'disclaimer-hidden');
}

function readSettingsFile() {
  try {
    const raw = fs.readFileSync(settingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function clampOpacityPercent(value, fallback = 80) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(20, Math.round(number)));
}

function refreshResultOpacity() {
  const stored = readSettingsFile();
  if (!stored) return;
  snipResultOpacity = clampOpacityPercent(stored.snipOpacity) / 100;
  autoResultOpacity = clampOpacityPercent(stored.autoOpacity) / 100;
}

function writeSettingsFile(payload) {
  const incoming = payload && typeof payload === 'object' ? payload : {};
  const openai = incoming.openai && typeof incoming.openai === 'object' ? incoming.openai : {};
  const snipOpacity = clampOpacityPercent(incoming.snipOpacity);
  const autoOpacity = clampOpacityPercent(incoming.autoOpacity);
  const clean = {
    version: 2,
    source: typeof incoming.source === 'string' ? incoming.source : 'auto',
    target: typeof incoming.target === 'string' ? incoming.target : 'zh',
    live: incoming.live !== false,
    hotkey: typeof incoming.hotkey === 'string' && incoming.hotkey
      ? incoming.hotkey
      : DEFAULT_HOTKEY,
    autoHotkey: typeof incoming.autoHotkey === 'string' && incoming.autoHotkey
      ? incoming.autoHotkey
      : DEFAULT_AUTO_HOTKEY,
    snipOpacity,
    autoOpacity,
    disclaimerHidden: incoming.disclaimerHidden === true,
    provider: incoming.provider === 'openai' ? 'openai' : 'mymemory',
    mymemoryEmail: typeof incoming.mymemoryEmail === 'string' ? incoming.mymemoryEmail : '',
    openai: {
      endpoint: typeof openai.endpoint === 'string' ? openai.endpoint : '',
      model: typeof openai.model === 'string' ? openai.model : '',
      apiKey: typeof openai.apiKey === 'string' ? openai.apiKey : '',
      remember: openai.remember !== false,
      stream: openai.stream !== false
    }
  };
  try {
    const file = settingsFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(clean, null, 2), 'utf8');
    snipResultOpacity = snipOpacity / 100;
    autoResultOpacity = autoOpacity / 100;
    if (resultWindow && !resultWindow.isDestroyed()) {
      try {
        resultWindow.setOpacity(resultState?.auto ? autoResultOpacity : snipResultOpacity);
      } catch (error) { /* ignored */ }
    }
    return true;
  } catch (error) {
    logLine(`settings write failed: ${error.message || error}`);
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function acceleratorLabel(accelerator) {
  return String(accelerator || '')
    .split('+')
    .map((part) => ({ Control: 'Ctrl', Command: 'Cmd', Super: 'Win', Option: 'Alt' }[part] || part))
    .join('+');
}

function triggerSnip() {
  void startSnip('single');
}

function triggerAutoSnip() {
  void startSnip('auto');
}

function registerScreenCurrent(accelerator) {
  try {
    return globalShortcut.register(accelerator, triggerSnip);
  } catch (error) {
    return false;
  }
}

function registerAutoCurrent(accelerator) {
  try {
    return globalShortcut.register(accelerator, triggerAutoSnip);
  } catch (error) {
    return false;
  }
}

function syncHotkeySuspendedState() {
  hotkeySuspended = !(globalShortcut.isRegistered(currentHotkey)
    && globalShortcut.isRegistered(currentAutoHotkey));
}

function ensureOtherHotkey(kind) {
  if (kind === 'auto') {
    if (!globalShortcut.isRegistered(currentHotkey)) registerScreenCurrent(currentHotkey);
  } else if (!globalShortcut.isRegistered(currentAutoHotkey)) {
    registerAutoCurrent(currentAutoHotkey);
  }
  syncHotkeySuspendedState();
}

function updateTrayPresentation() {
  if (!tray) return;
  const items = [
    { label: '打开 LINGUA', click: () => void showMainWindow() },
    {
      label: '开始划屏翻译',
      accelerator: currentHotkey,
      click: () => void startSnip('single')
    },
    {
      label: '开始自动翻译',
      accelerator: currentAutoHotkey,
      click: () => void startSnip('auto')
    }
  ];
  if (autoSession) {
    items.push({ label: '停止自动翻译', click: () => stopAutoSession() });
  }
  items.push(
    { type: 'separator' },
    {
      label: '退出 LINGUA',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  );
  tray.setToolTip(`LINGUA 实时翻译 · ${acceleratorLabel(currentHotkey)} 划屏 / ${acceleratorLabel(currentAutoHotkey)} 自动`);
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function applyHotkeyBinding(kind, accelerator) {
  const isAuto = kind === 'auto';
  const next = String(accelerator || '').trim();
  const currentValue = isAuto ? currentAutoHotkey : currentHotkey;
  const otherValue = isAuto ? currentHotkey : currentAutoHotkey;
  if (!next) {
    return {
      ok: false,
      hotkey: currentHotkey,
      autoHotkey: currentAutoHotkey,
      error: '快捷键不能为空。'
    };
  }
  if (next === otherValue) {
    return {
      ok: false,
      hotkey: currentHotkey,
      autoHotkey: currentAutoHotkey,
      error: '这个组合键已被另一个翻译快捷键使用，请换一个。'
    };
  }
  const currentlyRegistered = globalShortcut.isRegistered(currentValue);
  if (next === currentValue && currentlyRegistered) {
    ensureOtherHotkey(kind);
    return { ok: true, hotkey: currentHotkey, autoHotkey: currentAutoHotkey };
  }
  if (currentlyRegistered) globalShortcut.unregister(currentValue);
  const ok = isAuto ? registerAutoCurrent(next) : registerScreenCurrent(next);
  if (!ok) {
    if (currentValue && !globalShortcut.isRegistered(currentValue)) {
      if (isAuto) registerAutoCurrent(currentValue);
      else registerScreenCurrent(currentValue);
    }
    ensureOtherHotkey(kind);
    return {
      ok: false,
      hotkey: currentHotkey,
      autoHotkey: currentAutoHotkey,
      error: '这个组合键已被其他程序占用，请换一个。'
    };
  }
  const previous = currentValue;
  if (isAuto) currentAutoHotkey = next;
  else currentHotkey = next;
  ensureOtherHotkey(kind);
  updateTrayPresentation();
  logLine(`${isAuto ? 'auto hotkey' : 'hotkey'} changed ${previous} -> ${next}`);
  return {
    ok: true,
    hotkey: currentHotkey,
    autoHotkey: currentAutoHotkey,
    previous
  };
}

function suspendGlobalHotkey() {
  if (globalShortcut.isRegistered(currentHotkey)) globalShortcut.unregister(currentHotkey);
  if (globalShortcut.isRegistered(currentAutoHotkey)) globalShortcut.unregister(currentAutoHotkey);
  hotkeySuspended = true;
  return {
    ok: true,
    hotkey: currentHotkey,
    autoHotkey: currentAutoHotkey,
    suspended: hotkeySuspended
  };
}

function resumeGlobalHotkey() {
  let screenOk = globalShortcut.isRegistered(currentHotkey);
  if (!screenOk) screenOk = registerScreenCurrent(currentHotkey);
  let autoOk = globalShortcut.isRegistered(currentAutoHotkey);
  if (!autoOk) autoOk = registerAutoCurrent(currentAutoHotkey);
  hotkeySuspended = !(screenOk && autoOk);
  return {
    ok: screenOk && autoOk,
    hotkey: currentHotkey,
    autoHotkey: currentAutoHotkey,
    error: screenOk && autoOk ? '' : '恢复快捷键失败。'
  };
}

function stopAutoSession(options = {}) {
  const session = autoSession;
  if (!session) return;
  autoSession = null;
  if (options.notify !== false) {
    sendToRenderer('desktop:auto-stop', { token: session.token });
  }
  if (options.closeWindow !== false && resultWindow && !resultWindow.isDestroyed()) {
    const win = resultWindow;
    resultWindow = null;
    resultWindowSize = null;
    resultInline = false;
    resultLoaded = false;
    resultState = null;
    try { win.close(); } catch (error) { /* ignored */ }
  }
  updateTrayPresentation();
}

async function captureAutoFrame(session) {
  const display = screen.getAllDisplays().find((item) => item.id === session.display.id)
    || session.display;
  const bounds = display.bounds;
  const scale = display.scaleFactor || 1;
  const thumbSize = {
    width: Math.max(1, Math.round(bounds.width * scale)),
    height: Math.max(1, Math.round(bounds.height * scale))
  };
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: thumbSize,
    fetchWindowIcons: false
  });
  let source = sources.find((item) => item.display_id && String(item.display_id) === String(display.id));
  if (!source) {
    const allDisplays = screen.getAllDisplays();
    const index = allDisplays.findIndex((item) => item.id === display.id);
    source = sources[index] || sources[0];
  }
  if (!source || !source.thumbnail || source.thumbnail.isEmpty()) {
    throw new Error('无法获取屏幕画面。');
  }
  const image = source.thumbnail;
  const imageSize = image.getSize();
  const scaleX = imageSize.width / Math.max(1, bounds.width);
  const scaleY = imageSize.height / Math.max(1, bounds.height);
  const overlay = session.overlayBounds;
  const selection = session.selection;
  const left = overlay.x - bounds.x + Number(selection.x || 0);
  const top = overlay.y - bounds.y + Number(selection.y || 0);
  const x = Math.max(0, Math.min(imageSize.width - 2, Math.round(left * scaleX)));
  const y = Math.max(0, Math.min(imageSize.height - 2, Math.round(top * scaleY)));
  const width = Math.max(2, Math.min(imageSize.width - x, Math.round(Number(selection.width || 2) * scaleX)));
  const height = Math.max(2, Math.min(imageSize.height - y, Math.round(Number(selection.height || 2) * scaleY)));
  const cropped = image.crop({ x, y, width, height });
  if (!cropped || cropped.isEmpty()) throw new Error('框选区域截图为空。');
  return cropped.toDataURL();
}

async function showMainWindow() {
  logLine(`showMainWindow: existing=${!!mainWindow} promise=${!!mainWindowPromise} server=${!!serverUrl}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  if (mainWindowPromise) {
    await mainWindowPromise.catch(() => {});
    return;
  }
  if (!serverUrl) return;
  mainWindowPromise = createMainWindow();
  try {
    await mainWindowPromise;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      logLine('showMainWindow: recreated and shown');
    }
  } catch (error) {
    logLine(`showMainWindow: recreation failed ${error.message || error}`);
  } finally {
    mainWindowPromise = null;
  }
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send(channel, payload);
    });
  } else {
    mainWindow.webContents.send(channel, payload);
  }
}

function notifyError(message) {
  try {
    if (Notification.isSupported()) {
      new Notification({
        title: 'LINGUA',
        body: String(message || '操作失败'),
        icon: assetPath('icon.png'),
        silent: true
      }).show();
      return;
    }
  } catch (error) {
    /* fall back to the main window */
  }
  void showMainWindow();
  sendToRenderer('desktop:error', { message });
}

function resultBounds(width, height) {
  const area = resultDisplay?.workArea || resultDisplay?.bounds || screen.getPrimaryDisplay().workArea;
  const margin = 10;
  const minX = area.x + margin;
  const maxX = area.x + area.width - width - margin;
  const x = clampValue(resultAnchor?.x ?? minX, minX, Math.max(minX, maxX));
  const belowY = (resultAnchor?.y ?? area.y) + (resultAnchor?.height ?? 0) + margin;
  const belowSpace = area.y + area.height - margin - belowY;
  const aboveSpace = (resultAnchor?.y ?? area.y) - margin - (area.y + margin);

  if (belowSpace >= 118) {
    const finalHeight = Math.min(height, belowSpace);
    return { x: Math.round(x), y: Math.round(belowY), width: Math.round(width), height: Math.round(finalHeight) };
  }
  if (aboveSpace >= 118) {
    const finalHeight = Math.min(height, aboveSpace);
    return { x: Math.round(x), y: Math.round((resultAnchor?.y ?? area.y) - finalHeight - margin), width: Math.round(width), height: Math.round(finalHeight) };
  }
  const finalHeight = Math.min(height, area.height - margin * 2);
  return { x: Math.round(x), y: Math.round(area.y + margin), width: Math.round(width), height: Math.round(finalHeight) };
}

function closeResultWindow() {
  const win = resultWindow;
  resultWindow = null;
  resultWindowSize = null;
  resultInline = false;
  resultLoaded = false;
  resultState = null;
  resultToken = null;
  resultAnchor = null;
  resultDisplay = null;
  if (win && !win.isDestroyed()) {
    try { win.close(); } catch (error) { /* ignored */ }
  }
}

function pushResultState(state) {
  resultState = state;
  if (resultWindow && !resultWindow.isDestroyed() && resultLoaded) {
    resultWindow.webContents.send('result:state', state);
  }
}

function createResultWindow(anchor, display, token, options = {}) {
  closeResultWindow();
  resultToken = token;
  resultAnchor = anchor;
  resultDisplay = display;
  const isAuto = !!options.auto;
  const isInline = !!options.inline;
  const area = display.workArea || display.bounds;
  const maxInlineWidth = Math.max(340, area.width - 24);
  resultInline = isInline;
  resultWidth = isInline
    ? Math.round(clampValue(anchor.width, 340, Math.min(1000, maxInlineWidth)))
    : Math.round(clampValue(anchor.width + 24, 340, 460));
  resultHeight = isInline ? 190 : 228;

  const bounds = resultBounds(resultWidth, resultHeight);
  logLine(`result window at ${bounds.x},${bounds.y} ${bounds.width}x${bounds.height} anchor=${anchor.x},${anchor.y},${anchor.width},${anchor.height}`);
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    show: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    focusable: true,
    title: 'LINGUA · 译文',
    webPreferences: {
      preload: path.join(__dirname, 'result-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });
  resultWindow = win;
  resultWindowSize = win.getBounds();
  resultLoaded = false;
  // Opacity is configurable from the settings panel.
  win.setOpacity(isAuto ? autoResultOpacity : snipResultOpacity);
  win.setAlwaysOnTop(true, 'screen-saver');
  if (isAuto) {
    // Keep the movable auto-translation card out of its own screen captures.
    try { win.setContentProtection(true); } catch (error) { /* ignored */ }
  }
  win.setMenuBarVisibility(false);
  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (error) { /* ignored */ }
  win.on('closed', () => {
    if (resultWindow === win) {
      resultWindow = null;
      resultWindowSize = null;
      resultInline = false;
      resultLoaded = false;
      resultState = null;
      if (autoSession && autoSession.token === token) {
        autoSession = null;
        sendToRenderer('desktop:auto-stop', { token });
        updateTrayPresentation();
      }
    }
  });
  win.webContents.once('did-finish-load', () => {
    if (resultWindow !== win) return;
    resultLoaded = true;
    if (resultState) win.webContents.send('result:state', resultState);
    if (isAuto) {
      win.showInactive();
    } else {
      // The one-shot result card is focused so Esc can close it after the
      // translation is shown. Auto mode keeps the previous foreground app.
      win.show();
      win.focus();
      try { win.webContents.focus(); } catch (error) { /* ignored */ }
    }
  });
  win.loadFile(path.join(__dirname, 'result.html'));
  pushResultState({
    status: 'loading',
    detail: isAuto ? '准备自动翻译…' : '正在识别屏幕文字…',
    sourceLabel: '自动检测',
    targetLabel: '翻译中',
    inline: isInline,
    auto: isAuto,
    autoStatus: isAuto ? '自动翻译已启动' : ''
  });
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  if (tray && !trayTipShown) {
    trayTipShown = true;
    try {
      tray.displayBalloon({
        title: 'LINGUA 仍在运行',
        content: `按 ${acceleratorLabel(currentHotkey)} 随时框选翻译。右键托盘图标可退出。`,
        iconType: 'info'
      });
    } catch (error) { /* ignored */ }
  }
}

function createTray() {
  if (tray) return;
  const iconPath = assetPath('tray.png');
  if (!fs.existsSync(iconPath)) {
    console.warn('[LINGUA] tray icon missing:', iconPath);
    return;
  }
  try {
    const image = nativeImage.createFromPath(iconPath);
    tray = new Tray(image);
    updateTrayPresentation();
    tray.on('click', () => void showMainWindow());
    tray.on('double-click', () => void showMainWindow());
  } catch (error) {
    console.error('[LINGUA] Failed to create tray:', error);
    tray = null;
  }
}

async function openSnipOverlay(display, image, bounds) {
  overlayResolved = false;
  snipImage = image;
  snipDisplay = display;

  const overlay = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: false,
    backgroundColor: '#f7f3fb',
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    title: 'LINGUA · 框选屏幕',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  activeOverlay = overlay;
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setMenuBarVisibility(false);
  try { overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (error) { /* ignored */ }

  snipOverlayBounds = bounds;
  overlay.on('closed', () => {
    if (activeOverlay === overlay) {
      if (inlineSession) {
        const token = inlineSession.token;
        inlineSession = null;
        sendToRenderer('desktop:inline-cancel', { token });
      }
      activeOverlay = null;
      if (!overlayResolved && !isQuitting) {
        overlayResolved = true;
        snipInProgress = false;
      }
    }
  });

  await overlay.loadFile(path.join(__dirname, 'overlay.html'));
  const size = image.getSize();
  overlay.webContents.send('overlay:init', {
    dataUrl: image.toDataURL(),
    viewport: { width: bounds.width, height: bounds.height },
    image: size,
    hotkey: snipMode === 'auto' ? currentAutoHotkey : currentHotkey,
    auto: snipMode === 'auto'
  });
  overlay.show();
  overlay.focus();
}

async function startSnip(mode = 'single') {
  if (snipInProgress || activeOverlay) return;
  stopAutoSession({ notify: true, closeWindow: true });
  closeResultWindow();
  snipMode = mode === 'auto' ? 'auto' : 'single';
  if (!mainWindow || mainWindow.isDestroyed()) {
    await showMainWindow();
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.webContents || mainWindow.webContents.isDestroyed()) return;

  snipInProgress = true;
  const wasVisible = mainWindow.isVisible();
  if (wasVisible) {
    mainWindow.hide();
    await delay(180);
  }

  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const scale = display.scaleFactor || 1;
    const thumbSize = {
      width: Math.max(1, Math.round(display.bounds.width * scale)),
      height: Math.max(1, Math.round(display.bounds.height * scale))
    };
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: thumbSize,
      fetchWindowIcons: false
    });
    if (!sources.length) throw new Error('没有找到可捕获的屏幕。');
    let source = sources.find((item) => item.display_id && String(item.display_id) === String(display.id));
    if (!source) {
      const allDisplays = screen.getAllDisplays();
      const displayIndex = allDisplays.findIndex((item) => item.id === display.id);
      source = sources[displayIndex] || sources[0];
    }
    if (!source) throw new Error('无法获取屏幕画面。');
    let image = source.thumbnail;
    if (!image || image.isEmpty()) throw new Error('屏幕截图为空。');

    // Use the work area (desktop above the taskbar) and crop the screenshot to
    // the exact same region. This keeps the overlay preview and crop dimensions
    // in a 1:1 aspect ratio even on high-DPI displays.
    const overlayBounds = display.workArea || display.bounds;
    const imageSize = image.getSize();
    const scaleX = imageSize.width / Math.max(1, display.bounds.width);
    const scaleY = imageSize.height / Math.max(1, display.bounds.height);
    const cropX = Math.max(0, Math.round((overlayBounds.x - display.bounds.x) * scaleX));
    const cropY = Math.max(0, Math.round((overlayBounds.y - display.bounds.y) * scaleY));
    const cropW = Math.max(1, Math.min(imageSize.width - cropX, Math.round(overlayBounds.width * scaleX)));
    const cropH = Math.max(1, Math.min(imageSize.height - cropY, Math.round(overlayBounds.height * scaleY)));
    if (cropW > 2 && cropH > 2) {
      image = image.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
    }
    await openSnipOverlay(display, image, overlayBounds);
  } catch (error) {
    snipInProgress = false;
    snipImage = null;
    snipDisplay = null;
    console.error('[LINGUA] Screen capture failed:', error);
    notifyError(`无法截取屏幕：${error.message || error}`);
  }
}

async function completeSnip(selection) {
  if (!activeOverlay || !snipImage) return;
  const overlay = activeOverlay;
  const inlineMode = snipMode !== 'auto';
  overlayResolved = true;
  if (inlineMode) {
    // Keep the frozen-screen overlay open and draw translations in place.
    activeOverlay = overlay;
  } else {
    activeOverlay = null;
    overlay.close();
  }
  snipInProgress = false;

  try {
    const imageSize = snipImage.getSize();
    const viewportWidth = Math.max(1, Number(selection.viewportWidth) || imageSize.width);
    const viewportHeight = Math.max(1, Number(selection.viewportHeight) || imageSize.height);
    const scaleX = imageSize.width / viewportWidth;
    const scaleY = imageSize.height / viewportHeight;
    const x = Math.max(0, Math.min(imageSize.width - 1, Math.round(selection.x * scaleX)));
    const y = Math.max(0, Math.min(imageSize.height - 1, Math.round(selection.y * scaleY)));
    const width = Math.max(1, Math.min(imageSize.width - x, Math.round(selection.width * scaleX)));
    const height = Math.max(1, Math.min(imageSize.height - y, Math.round(selection.height * scaleY)));
    if (width < 2 || height < 2) throw new Error('框选区域太小。');
    const cropped = snipImage.crop({ x, y, width, height });
    if (!cropped || cropped.isEmpty()) throw new Error('框选区域截图为空。');
    const dataUrl = cropped.toDataURL();
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const overlayBounds = snipOverlayBounds || snipDisplay.workArea || snipDisplay.bounds;
    const anchor = {
      x: overlayBounds.x + Number(selection.x || 0),
      y: overlayBounds.y + Number(selection.y || 0),
      width: Number(selection.width || 0),
      height: Number(selection.height || 0)
    };
    snipImage = null;
    const overlayBoundsForSelection = overlayBounds;
    snipOverlayBounds = null;
    if (snipMode === 'auto') {
      autoSession = {
        token,
        display: snipDisplay,
        overlayBounds: overlayBoundsForSelection,
        selection: {
          x: Number(selection.x || 0),
          y: Number(selection.y || 0),
          width: Number(selection.width || 0),
          height: Number(selection.height || 0)
        }
      };
      createResultWindow(anchor, snipDisplay, token, { auto: true });
      snipDisplay = null;
      sendToRenderer('desktop:auto-start', { token });
      updateTrayPresentation();
    } else {
      const inlineSelection = {
        x: Number(selection.x || 0),
        y: Number(selection.y || 0),
        width: Number(selection.width || 0),
        height: Number(selection.height || 0)
      };
      inlineSession = { token, selection: inlineSelection };
      overlay.webContents.send('overlay:inline-begin', {
        token,
        selection: inlineSelection,
        opacity: snipResultOpacity
      });
      sendToRenderer('desktop:capture', {
        dataUrl,
        token,
        width,
        height,
        inline: true,
        selection: inlineSelection
      });
      snipDisplay = null;
    }
    snipMode = 'single';
  } catch (error) {
    console.error('[LINGUA] Crop failed:', error);
    if (inlineMode && overlay && !overlay.isDestroyed()) {
      overlay.webContents.send('overlay:inline-status', {
        error: true,
        text: `识别失败：${error.message || error}`
      });
    } else {
      notifyError(`框选截图失败：${error.message || error}`);
    }
  }
}

function cancelSnip() {
  if (!activeOverlay) return;
  const overlay = activeOverlay;
  const wasInline = !!inlineSession;
  const token = inlineSession?.token;
  inlineSession = null;
  activeOverlay = null;
  overlayResolved = true;
  overlay.close();
  snipInProgress = false;
  snipImage = null;
  snipDisplay = null;
  snipOverlayBounds = null;
  if (wasInline) {
    sendToRenderer('desktop:inline-cancel', { token });
  } else {
    sendToRenderer('desktop:cancelled', { mode: snipMode });
  }
  snipMode = 'single';
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f7f3fb',
    title: 'LINGUA 实时翻译',
    icon: assetPath('icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (event) => {
    logLine(`mainWindow close: isQuitting=${isQuitting} tray=${!!tray}`);
    if (isQuitting) return;
    if (tray) {
      event.preventDefault();
      hideToTray();
    }
  });

  mainWindow.on('closed', () => {
    logLine('mainWindow closed');
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (event, code, description) => {
    console.error('[LINGUA] Page load failed:', code, description);
  });

  logLine(`createMainWindow: loading ${serverUrl}`);
  await mainWindow.loadURL(serverUrl);
  logLine('createMainWindow: loaded');
}

async function boot() {
  try {
    const packagedWebRoot = path.join(__dirname, 'web');
    const webRoot = fs.existsSync(path.join(packagedWebRoot, 'index.html'))
      ? packagedWebRoot
      : path.resolve(__dirname, '..');
    let lastServerError = null;
    for (let offset = 0; offset < 3 && !serverHandle; offset += 1) {
      try {
        serverHandle = await startServer({ root: webRoot, port: SERVER_PORT + offset });
      } catch (error) {
        lastServerError = error;
        if (error?.code !== 'EADDRINUSE') throw error;
      }
    }
    if (!serverHandle) {
      throw lastServerError || new Error('无法启动本地服务。');
    }
    serverUrl = serverHandle.url;
    refreshResultOpacity();
    await createMainWindow();
    createTray();
    let shortcutOk = false;
    for (const candidate of [DEFAULT_HOTKEY, 'Control+Shift+F8', 'Control+Alt+F9', 'Control+Alt+Q']) {
      if (registerScreenCurrent(candidate)) {
        currentHotkey = candidate;
        shortcutOk = true;
        break;
      }
    }
    let autoShortcutOk = false;
    for (const candidate of [
      DEFAULT_AUTO_HOTKEY,
      'Control+Alt+F9',
      'Control+Shift+F9',
      'Control+Alt+F8',
      'Control+Shift+F8',
      'Control+Alt+Q'
    ]) {
      if (candidate === currentHotkey) continue;
      if (registerAutoCurrent(candidate)) {
        currentAutoHotkey = candidate;
        autoShortcutOk = true;
        break;
      }
    }
    syncHotkeySuspendedState();
    updateTrayPresentation();
    if (!shortcutOk) {
      console.warn('[LINGUA] Failed to register global shortcut', DEFAULT_HOTKEY);
      notifyError('划屏快捷键注册失败，请在设置中换一个组合键。');
    }
    if (!autoShortcutOk) {
      console.warn('[LINGUA] Failed to register auto-translation shortcut', DEFAULT_AUTO_HOTKEY);
      notifyError('自动翻译快捷键注册失败，请在设置中换一个组合键。');
    }
  } catch (error) {
    console.error('[LINGUA] Startup failed:', error);
    dialog.showErrorBox('LINGUA 启动失败', String(error?.message || error));
    app.quit();
  }
}

ipcMain.handle('desktop:start-capture', async (_event, mode) => {
  await startSnip(mode === 'auto' ? 'auto' : 'single');
  return { ok: true };
});

ipcMain.handle('desktop:status', () => ({
  version: app.getVersion(),
  platform: process.platform,
  hotkey: currentHotkey,
  hotkeyRegistered: globalShortcut.isRegistered(currentHotkey),
  hotkeySuspended,
  trayReady: !!tray,
  mainVisible: !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
  autoActive: !!autoSession,
  autoHotkey: currentAutoHotkey,
  autoHotkeyRegistered: globalShortcut.isRegistered(currentAutoHotkey),
  snipOpacity: Math.round(snipResultOpacity * 100),
  autoOpacity: Math.round(autoResultOpacity * 100)
}));

ipcMain.handle('desktop:auto-capture', async (event, token) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { ok: false, error: '无效的调用来源。' };
  }
  if (!autoSession || !token || token !== autoSession.token) {
    return { ok: false, error: '自动翻译会话已结束。' };
  }
  try {
    const dataUrl = await captureAutoFrame(autoSession);
    return { ok: true, dataUrl };
  } catch (error) {
    return { ok: false, error: error.message || '截取屏幕失败。' };
  }
});

ipcMain.handle('desktop:stop-auto', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return { ok: false };
  stopAutoSession({ notify: true, closeWindow: true });
  return { ok: true };
});

ipcMain.handle('desktop:set-hotkey', (event, accelerator) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return {
      ok: false,
      hotkey: currentHotkey,
      autoHotkey: currentAutoHotkey,
      error: '无效的调用来源。'
    };
  }
  return applyHotkeyBinding('snip', accelerator);
});

ipcMain.handle('desktop:set-auto-hotkey', (event, accelerator) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return {
      ok: false,
      hotkey: currentHotkey,
      autoHotkey: currentAutoHotkey,
      error: '无效的调用来源。'
    };
  }
  return applyHotkeyBinding('auto', accelerator);
});

ipcMain.handle('desktop:get-settings', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return null;
  return readSettingsFile();
});

ipcMain.handle('desktop:save-settings', (event, payload) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { ok: false, error: '无效的调用来源。' };
  }
  return { ok: writeSettingsFile(payload) };
});

ipcMain.handle('desktop:get-disclaimer-hidden', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  try {
    return fs.existsSync(disclaimerFlagPath());
  } catch (error) {
    return false;
  }
});

ipcMain.handle('desktop:set-disclaimer-hidden', (event, hidden) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  try {
    if (hidden === true) {
      fs.mkdirSync(path.dirname(disclaimerFlagPath()), { recursive: true });
      fs.writeFileSync(disclaimerFlagPath(), '1', 'utf8');
    } else {
      fs.rmSync(disclaimerFlagPath(), { force: true });
    }
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('desktop:suspend-hotkey', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { ok: false, hotkey: currentHotkey };
  }
  return suspendGlobalHotkey();
});

ipcMain.handle('desktop:resume-hotkey', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { ok: false, hotkey: currentHotkey };
  }
  return resumeGlobalHotkey();
});

ipcMain.on('overlay:select', (event, selection) => {
  if (!activeOverlay || event.sender !== activeOverlay.webContents) return;
  void completeSnip(selection || {});
});

ipcMain.on('overlay:cancel', (event) => {
  if (!activeOverlay || event.sender !== activeOverlay.webContents) return;
  cancelSnip();
});

ipcMain.on('desktop:inline-status', (event, payload) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  if (!activeOverlay || !inlineSession) return;
  if (payload?.token && payload.token !== inlineSession.token) return;
  activeOverlay.webContents.send('overlay:inline-status', {
    text: typeof payload?.text === 'string' ? payload.text : '',
    error: !!payload?.error
  });
});

ipcMain.on('desktop:inline-result', (event, payload) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  if (!activeOverlay || !inlineSession) return;
  if (!payload || payload.token !== inlineSession.token) return;
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  activeOverlay.webContents.send('overlay:inline-blocks', { blocks });
});

ipcMain.on('desktop:result', (event, payload) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
  if (!resultWindow || !payload || payload.token !== resultToken) return;
  const status = ['loading', 'streaming', 'success', 'error'].includes(payload.status)
    ? payload.status
    : 'loading';
  pushResultState({
    status,
    text: typeof payload.text === 'string' ? payload.text : '',
    detail: typeof payload.detail === 'string' ? payload.detail : '',
    message: typeof payload.message === 'string' ? payload.message : '',
    sourceLabel: typeof payload.sourceLabel === 'string' ? payload.sourceLabel : '自动检测',
    targetLabel: typeof payload.targetLabel === 'string' ? payload.targetLabel : '',
    detected: typeof payload.detected === 'string' ? payload.detected : '',
    original: typeof payload.original === 'string' ? payload.original : '',
    showOriginal: !!payload.showOriginal,
    inline: resultInline,
    auto: !!payload.auto,
    autoStatus: typeof payload.autoStatus === 'string' ? payload.autoStatus : ''
  });
  if (!payload.auto && payload.status === 'success' && resultWindow && !resultWindow.isDestroyed()) {
    // Keep Esc reliable once the final translation arrives.
    try {
      resultWindow.focus();
      resultWindow.webContents.focus();
    } catch (error) { /* ignored */ }
  }
});

ipcMain.on('result:close', (event) => {
  if (!resultWindow || resultWindow.isDestroyed() || event.sender !== resultWindow.webContents) return;
  resultWindow.close();
});

ipcMain.handle('result:copy', (event, text) => {
  if (!resultWindow || resultWindow.isDestroyed() || event.sender !== resultWindow.webContents) return false;
  clipboard.writeText(String(text || ''));
  return true;
});

ipcMain.on('result:set-position', (event, x, y) => {
  if (!resultWindow || resultWindow.isDestroyed() || event.sender !== resultWindow.webContents) return;
  const nextX = Math.round(Number(x));
  const nextY = Math.round(Number(y));
  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
  // Keep the card size fixed while moving. On some Windows setups a plain
  // setPosition can let the frameless window grow while being dragged.
  const size = resultWindowSize || resultWindow.getBounds();
  resultWindow.setBounds({
    x: nextX,
    y: nextY,
    width: size.width,
    height: size.height
  }, false);
});

app.on('second-instance', () => {
  logLine('second-instance received');
  void showMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (resultWindow && !resultWindow.isDestroyed()) {
    try { resultWindow.close(); } catch (error) { /* ignored */ }
  }
  if (activeOverlay) {
    try { activeOverlay.close(); } catch (error) { /* ignored */ }
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (serverHandle?.server) {
    try { serverHandle.server.close(); } catch (error) { /* ignored */ }
  }
});

app.on('window-all-closed', () => {
  if (!tray && process.platform !== 'darwin') app.quit();
});

if (gotSingleInstanceLock) {
  app.whenReady().then(boot);
}
