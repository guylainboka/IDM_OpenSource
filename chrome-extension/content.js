// guymadown Chrome extension — content script
// Detects media (video/audio) on pages and shows a floating download panel.
// Also monitors the clipboard for compatible URLs (when enabled).

(() => {
  if (window.__guymadownInjected) return
  window.__guymadownInjected = true

  const ENGINE_URL = 'http://localhost:3003'

  async function sendToEngine(payload) {
    try {
      const res = await fetch(`${ENGINE_URL}/api/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ---- Media detection -------------------------------------------------
  const mediaExtensions = [
    'mp4', 'webm', 'mkv', 'avi', 'mov', 'flv',
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a',
    'm3u8', 'mpd', 'ts', 'm4s',
  ]

  function classifyMedia(url) {
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase()
    if (['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio'
    if (['m3u8', 'mpd', 'ts', 'm4s'].includes(ext)) return 'stream'
    if (mediaExtensions.includes(ext)) return 'media'
    return null
  }

  // Scan the page for media resources
  function findMediaOnPage() {
    const found = new Map()
    const add = (url, type, label) => {
      if (!url || !/^https?:\/\//i.test(url)) return
      if (found.has(url)) return
      found.set(url, { url, type, label })
    }
    document.querySelectorAll('video').forEach((v) => {
      if (v.src) add(v.currentSrc || v.src, 'video', 'vidéo HTML5')
      v.querySelectorAll('source').forEach((s) => {
        if (s.src) add(s.src, 'video', 'source vidéo')
      })
    })
    document.querySelectorAll('audio').forEach((a) => {
      if (a.src) add(a.currentSrc || a.src, 'audio', 'audio HTML5')
      a.querySelectorAll('source').forEach((s) => {
        if (s.src) add(s.src, 'audio', 'source audio')
      })
    })
    document.querySelectorAll('a[href]').forEach((a) => {
      const t = classifyMedia(a.href)
      if (t) add(a.href, t, a.textContent?.trim() || 'lien média')
    })
    document.querySelectorAll('img[src]').forEach((img) => {
      if (img.src && /^https?:\/\//i.test(img.src)) {
        add(img.src, 'image', img.alt || 'image')
      }
    })
    return Array.from(found.values())
  }

  // Observe network requests for media (via performance entries)
  function findMediaFromNetwork() {
    const entries = performance.getEntriesByType('resource')
    const found = []
    for (const e of entries) {
      const t = classifyMedia(e.name)
      if (t) found.push({ url: e.name, type: t, label: `${t} réseau` })
    }
    return found
  }

  // ---- Floating panel --------------------------------------------------
  let panel = null
  let panelVisible = false

  function createPanel() {
    if (panel) return
    panel = document.createElement('div')
    panel.id = 'guymadown-panel'
    panel.innerHTML = `
      <div class="gd-header">
        <span class="gd-title">guymadown — Médias détectés</span>
        <span class="gd-close">×</span>
      </div>
      <div class="gd-body"></div>
      <div class="gd-footer">
        <button class="gd-add-all">Tout télécharger</button>
        <span class="gd-count"></span>
      </div>`
    document.body.appendChild(panel)
    panel.querySelector('.gd-close').addEventListener('click', () => {
      panel.style.display = 'none'
      panelVisible = false
    })
    panel.querySelector('.gd-add-all').addEventListener('click', async () => {
      const items = panel.querySelectorAll('.gd-item input:checked')
      for (const item of items) {
        await sendToEngine({ url: item.dataset.url })
      }
      panel.style.display = 'none'
      panelVisible = false
    })
  }

  function showPanel(media) {
    createPanel()
    const body = panel.querySelector('.gd-body')
    body.innerHTML = ''
    const seen = new Set()
    for (const m of media) {
      if (seen.has(m.url)) continue
      seen.add(m.url)
      const item = document.createElement('div')
      item.className = 'gd-item'
      const filename = m.url.split('/').pop().split('?')[0].slice(0, 40)
      item.innerHTML = `
        <input type="checkbox" data-url="${m.url}" checked>
        <span class="gd-type gd-${m.type}">${m.type}</span>
        <span class="gd-name" title="${m.url}">${filename}</span>`
      body.appendChild(item)
    }
    panel.querySelector('.gd-count').textContent = `${seen.size} ressource(s)`
    panel.style.display = 'flex'
    panelVisible = true
  }

  // Detect media on the page and show panel if found
  function scanAndShow() {
    const fromPage = findMediaOnPage()
    const fromNetwork = findMediaFromNetwork()
    const all = [...fromPage, ...fromNetwork]
    // dedupe by url
    const map = new Map()
    for (const m of all) map.set(m.url, m)
    const media = Array.from(map.values())
    if (media.length > 0) {
      showPanel(media)
    }
  }

  // Run after page load
  if (document.readyState === 'complete') {
    setTimeout(scanAndShow, 1000)
  } else {
    window.addEventListener('load', () => setTimeout(scanAndShow, 1000))
  }

  // Re-scan when new media is loaded (SPA / dynamic content)
  let lastScan = 0
  const observer = new MutationObserver(() => {
    const now = Date.now()
    if (now - lastScan > 3000) {
      lastScan = now
      scanAndShow()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'get-selection-links') {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        sendResponse([])
        return false
      }
      const links = []
      const container = document.createElement('div')
      container.appendChild(selection.getRangeAt(0).cloneContents())
      container.querySelectorAll('a[href]').forEach((a) => {
        if (/^https?:\/\//i.test(a.href)) links.push(a.href)
      })
      sendResponse(links)
      return false
    }
    if (msg.type === 'scan-media') {
      scanAndShow()
      sendResponse({ ok: true })
      return false
    }
  })
})()
