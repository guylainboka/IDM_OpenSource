// guymadown Chrome extension — popup script
const ENGINE_URL = 'http://localhost:3003'

const dot = document.getElementById('dot')
const statusLabel = document.getElementById('status-label')
const statusDetail = document.getElementById('status-detail')
const downloadsEl = document.getElementById('downloads')
const urlInput = document.getElementById('url-input')
const addBtn = document.getElementById('add-btn')
const refreshBtn = document.getElementById('refresh-btn')
const optionsBtn = document.getElementById('options-btn')

async function checkStatus() {
  try {
    const res = await fetch(`${ENGINE_URL}/api/status`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    dot.className = 'dot online'
    statusLabel.textContent = 'Moteur connecté'
    statusDetail.textContent = `${data.active} téléchargement(s) actif(s)`
  } catch {
    dot.className = 'dot offline'
    statusLabel.textContent = 'Moteur hors ligne'
    statusDetail.textContent = 'Démarrez guymadown sur votre PC'
  }
}

async function loadDownloads() {
  try {
    const res = await fetch(`${ENGINE_URL}/api/downloads`)
    if (!res.ok) return
    const list = await res.json()
    if (!list || list.length === 0) {
      downloadsEl.innerHTML = '<div class="empty">Aucun téléchargement</div>'
      return
    }
    downloadsEl.innerHTML = list.slice(0, 20).map((d) => {
      const status = d.status || 'pending'
      const badge = `b-${status}`
      const label = {
        completed: 'Terminé',
        downloading: 'En cours',
        failed: 'Échec',
        paused: 'Pause',
        pending: 'En attente',
        queued: 'File',
        cancelled: 'Annulé',
      }[status] || status
      return `<div class="download-item">
        <span class="dl-name" title="${d.url}">${d.filename}</span>
        <span class="dl-badge ${badge}">${label}</span>
      </div>`
    }).join('')
  } catch {
    downloadsEl.innerHTML = '<div class="empty">Moteur injoignable</div>'
  }
}

async function addDownload() {
  const url = urlInput.value.trim()
  if (!url || !/^https?:\/\//i.test(url)) return
  addBtn.textContent = 'Ajout…'
  addBtn.disabled = true
  try {
    const res = await fetch(`${ENGINE_URL}/api/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (res.ok) {
      urlInput.value = ''
      setTimeout(loadDownloads, 500)
    } else {
      alert('Moteur injoignable — démarrez guymadown')
    }
  } catch {
    alert('Moteur injoignable — démarrez guymadown')
  }
  addBtn.textContent = 'Ajouter et démarrer'
  addBtn.disabled = false
}

addBtn.addEventListener('click', addDownload)
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addDownload()
})
refreshBtn.addEventListener('click', () => {
  checkStatus()
  loadDownloads()
})
optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

checkStatus()
loadDownloads()
setInterval(() => {
  checkStatus()
  loadDownloads()
}, 3000)
