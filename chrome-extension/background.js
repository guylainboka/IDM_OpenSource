// guymadown Chrome extension — background service worker
// Intercepts browser downloads, adds context menus, and sends URLs to the
// guymadown download engine via HTTP (http://localhost:3003/api/add).

const ENGINE_URL = 'http://localhost:3003'
const DEFAULT_SETTINGS = {
  interceptDownloads: true,
  showContextMenu: true,
  detectMedia: true,
  showNotifications: true,
  excludedDomains: '',
  forceKey: 'ctrl',
  blockKey: 'alt',
}

// Load settings from chrome.storage
async function getSettings() {
  const stored = await chrome.storage.sync.get('settings')
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) }
}

// Send a URL to the guymadown engine
async function sendToEngine(payload) {
  try {
    const res = await fetch(`${ENGINE_URL}/api/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[guymadown] engine unreachable:', err.message)
    return { ok: false, error: err.message }
  }
}

// Check if engine is running
async function engineStatus() {
  try {
    const res = await fetch(`${ENGINE_URL}/api/status`, { method: 'GET' })
    if (!res.ok) return { ok: false }
    const data = await res.json()
    return { ok: true, active: data.active }
  } catch {
    return { ok: false }
  }
}

// Context menu setup
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings()
  createContextMenus(settings.showContextMenu)
  console.log('[guymadown] extension installed')
})

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings()
  createContextMenus(settings.showContextMenu)
})

function createContextMenus(show) {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    if (!show) return
    chrome.contextMenus.create({
      id: 'guymadown-link',
      title: 'Télécharger avec guymadown',
      contexts: ['link'],
    })
    chrome.contextMenus.create({
      id: 'guymadown-all-links',
      title: 'Télécharger tous les liens sélectionnés',
      contexts: ['selection'],
    })
    chrome.contextMenus.create({
      id: 'guymadown-image',
      title: 'Télécharger cette image avec guymadown',
      contexts: ['image'],
    })
    chrome.contextMenus.create({
      id: 'guymadown-video',
      title: 'Télécharger cette vidéo avec guymadown',
      contexts: ['video'],
    })
    chrome.contextMenus.create({
      id: 'guymadown-audio',
      title: 'Télécharger cet audio avec guymadown',
      contexts: ['audio'],
    })
  })
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const settings = await getSettings()
  let url = null
  switch (info.menuItemId) {
    case 'guymadown-link':
      url = info.linkUrl
      break
    case 'guymadown-image':
      url = info.srcUrl
      break
    case 'guymadown-video':
      url = info.srcUrl || info.linkUrl
      break
    case 'guymadown-audio':
      url = info.srcUrl || info.linkUrl
      break
    case 'guymadown-all-links':
      // Ask the content script for links in the selection
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'get-selection-links' }, async (links) => {
          if (chrome.runtime.lastError || !links) return
          for (const u of links) {
            await sendToEngine({ url: u })
          }
          if (settings.showNotifications && links?.length) {
            showNotification('guymadown', `${links.length} téléchargement(s) ajouté(s)`)
          }
        })
      }
      return
  }
  if (url) {
    const result = await sendToEngine({ url })
    if (settings.showNotifications) {
      if (result.ok) {
        showNotification('guymadown', 'Téléchargement ajouté')
      } else {
        showNotification('guymadown', 'Moteur injoignable — démarrez guymadown')
      }
    }
  }
})

// Intercept browser downloads
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  const settings = await getSettings()
  if (!settings.interceptDownloads) return
  const url = downloadItem.url
  if (!url || !/^https?:\/\//i.test(url)) return

  // Check excluded domains
  const excluded = (settings.excludedDomains || '')
    .split(/[\n,]+/)
    .map((d) => d.trim())
    .filter(Boolean)
  try {
    const host = new URL(url).hostname
    if (excluded.some((d) => host.includes(d))) return
  } catch {
    return
  }

  // Check if the user is holding the block key (handled via content script
  // keyboard state; for simplicity we send and cancel the browser download)
  const filename = downloadItem.filename || undefined
  const result = await sendToEngine({ url, filename })

  if (result.ok) {
    // Cancel the browser's own download since guymadown took over
    try {
      await chrome.downloads.cancel(downloadItem.id)
      await chrome.downloads.erase({ id: downloadItem.id })
    } catch {}
    if (settings.showNotifications) {
      showNotification('guymadown', `Intercepté: ${filename || url}`)
    }
  }
  // If engine is unreachable, let the browser download normally
})

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'send-to-engine') {
    sendToEngine(msg.payload).then(sendResponse)
    return true
  }
  if (msg.type === 'engine-status') {
    engineStatus().then(sendResponse)
    return true
  }
  if (msg.type === 'settings-updated') {
    getSettings().then((s) => createContextMenus(s.showContextMenu))
    return false
  }
})

function showNotification(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title,
      message,
    })
  } catch {}
}
