// guymadown Chrome extension — options page script
const DEFAULTS = {
  interceptDownloads: true,
  showContextMenu: true,
  detectMedia: true,
  showNotifications: true,
  excludedDomains: '',
  forceKey: 'ctrl',
  blockKey: 'alt',
}

const ids = ['interceptDownloads', 'showContextMenu', 'detectMedia', 'showNotifications', 'excludedDomains', 'forceKey', 'blockKey']

async function load() {
  const stored = await chrome.storage.sync.get('settings')
  const settings = { ...DEFAULTS, ...(stored.settings || {}) }
  for (const id of ids) {
    const el = document.getElementById(id)
    if (!el) continue
    if (el.type === 'checkbox') el.checked = !!settings[id]
    else el.value = settings[id] || ''
  }
}

async function save() {
  const settings = {}
  for (const id of ids) {
    const el = document.getElementById(id)
    if (!el) continue
    settings[id] = el.type === 'checkbox' ? el.checked : el.value
  }
  await chrome.storage.sync.set({ settings })
  document.getElementById('saved').style.display = 'inline'
  setTimeout(() => {
    document.getElementById('saved').style.display = 'none'
  }, 2000)
  // notify background to refresh context menus
  chrome.runtime.sendMessage({ type: 'settings-updated' })
}

document.getElementById('save').addEventListener('click', save)
load()
