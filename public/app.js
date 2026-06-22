'use strict'

const NHL_TEAMS = [
  // Eastern — Atlantic
  { abbrev:'BOS', name:'Boston Bruins',         conf:'East', div:'Atlantic',     c1:'#FFB81C', c2:'#000000', espnId:1  },
  { abbrev:'BUF', name:'Buffalo Sabres',         conf:'East', div:'Atlantic',     c1:'#003087', c2:'#FCB514', espnId:2  },
  { abbrev:'DET', name:'Detroit Red Wings',      conf:'East', div:'Atlantic',     c1:'#CE1126', c2:'#FFFFFF', espnId:5  },
  { abbrev:'FLA', name:'Florida Panthers',       conf:'East', div:'Atlantic',     c1:'#041E42', c2:'#C8102E', espnId:13 },
  { abbrev:'MTL', name:'Montreal Canadiens',     conf:'East', div:'Atlantic',     c1:'#AF1E2D', c2:'#192168', espnId:8  },
  { abbrev:'OTT', name:'Ottawa Senators',        conf:'East', div:'Atlantic',     c1:'#C52032', c2:'#C69214', espnId:9  },
  { abbrev:'TB',  name:'Tampa Bay Lightning',    conf:'East', div:'Atlantic',     c1:'#002868', c2:'#FFFFFF', espnId:14 },
  { abbrev:'TOR', name:'Toronto Maple Leafs',    conf:'East', div:'Atlantic',     c1:'#003E7E', c2:'#FFFFFF', espnId:10 },
  // Eastern — Metropolitan
  { abbrev:'CAR', name:'Carolina Hurricanes',    conf:'East', div:'Metropolitan', c1:'#CC0000', c2:'#000000', espnId:12 },
  { abbrev:'CBJ', name:'Columbus Blue Jackets',  conf:'East', div:'Metropolitan', c1:'#002654', c2:'#CE1126', espnId:29 },
  { abbrev:'NJD', name:'New Jersey Devils',      conf:'East', div:'Metropolitan', c1:'#CE1126', c2:'#003087', espnId:52 },
  { abbrev:'NYI', name:'New York Islanders',     conf:'East', div:'Metropolitan', c1:'#003087', c2:'#FC4C02', espnId:19 },
  { abbrev:'NYR', name:'New York Rangers',       conf:'East', div:'Metropolitan', c1:'#0038A8', c2:'#CE1126', espnId:20 },
  { abbrev:'PHI', name:'Philadelphia Flyers',    conf:'East', div:'Metropolitan', c1:'#F74902', c2:'#000000', espnId:4  },
  { abbrev:'PIT', name:'Pittsburgh Penguins',    conf:'East', div:'Metropolitan', c1:'#FCB514', c2:'#000000', espnId:3  },
  { abbrev:'WSH', name:'Washington Capitals',    conf:'East', div:'Metropolitan', c1:'#041E42', c2:'#C8102E', espnId:15 },
  // Western — Central
  { abbrev:'UTA', name:'Utah Hockey Club',       conf:'West', div:'Central',      c1:'#010101', c2:'#73C2FB', espnId:37 },
  { abbrev:'CHI', name:'Chicago Blackhawks',     conf:'West', div:'Central',      c1:'#CF0A2C', c2:'#000000', espnId:16 },
  { abbrev:'COL', name:'Colorado Avalanche',     conf:'West', div:'Central',      c1:'#6F263D', c2:'#236192', espnId:17 },
  { abbrev:'DAL', name:'Dallas Stars',           conf:'West', div:'Central',      c1:'#006847', c2:'#8F8F8C', espnId:25 },
  { abbrev:'MIN', name:'Minnesota Wild',         conf:'West', div:'Central',      c1:'#154734', c2:'#A6192E', espnId:30 },
  { abbrev:'NSH', name:'Nashville Predators',    conf:'West', div:'Central',      c1:'#FFB81C', c2:'#041E42', espnId:18 },
  { abbrev:'STL', name:'St. Louis Blues',        conf:'West', div:'Central',      c1:'#002F87', c2:'#FCB514', espnId:21 },
  { abbrev:'WPG', name:'Winnipeg Jets',          conf:'West', div:'Central',      c1:'#004C97', c2:'#AC162C', espnId:33 },
  // Western — Pacific
  { abbrev:'ANA', name:'Anaheim Ducks',          conf:'West', div:'Pacific',      c1:'#F47A38', c2:'#B9975B', espnId:24 },
  { abbrev:'CGY', name:'Calgary Flames',         conf:'West', div:'Pacific',      c1:'#C8102E', c2:'#F1BE48', espnId:22 },
  { abbrev:'EDM', name:'Edmonton Oilers',        conf:'West', div:'Pacific',      c1:'#FF4C00', c2:'#003087', espnId:11 },
  { abbrev:'LA',  name:'Los Angeles Kings',      conf:'West', div:'Pacific',      c1:'#111111', c2:'#A2AAAD', espnId:26 },
  { abbrev:'SJS', name:'San Jose Sharks',        conf:'West', div:'Pacific',      c1:'#006D75', c2:'#EA7200', espnId:28 },
  { abbrev:'SEA', name:'Seattle Kraken',         conf:'West', div:'Pacific',      c1:'#001628', c2:'#99D9D9', espnId:55 },
  { abbrev:'VAN', name:'Vancouver Canucks',      conf:'West', div:'Pacific',      c1:'#00843D', c2:'#00205B', espnId:23 },
  { abbrev:'VGK', name:'Vegas Golden Knights',   conf:'West', div:'Pacific',      c1:'#B4975A', c2:'#333F42', espnId:54 },
]

const POSITION_ORDER = ['C','LW','RW','D','G']
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl'

/* ── State ── */
let allGames = [], archiveGames = [], generatedAt = null
const rosterPlayerCache = new Map()
const teamLogoCache     = new Map()

/* ── Prefs ── */
const PREF_KEY = 'nhl-schedule-prefs'
const PREF_DEFAULTS = {
  view: 'schedule', conference: 'all', division: 'all', statusFilter: [],
  showScores: false, showVenue: true, showBroadcast: true,
  hideWatched: false, showArchive: false,
  myTeam: null, favTeams: [], favPlayers: [],
  savedGames: [], watchedGames: [], tz: 'auto',
}
let prefs = { ...PREF_DEFAULTS }

function loadPrefs() {
  try { const s = localStorage.getItem(PREF_KEY); if (s) Object.assign(prefs, JSON.parse(s)) } catch {}
}
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)) } catch {}
}

function teamByAbbrev(abbrev) { return NHL_TEAMS.find(t => t.abbrev === abbrev?.toUpperCase()) || null }
function logoUrl(abbrev) { return `https://a.espncdn.com/i/teamlogos/nhl/500/${abbrev?.toLowerCase()}.png` }
function teamConf(abbrevOrName) {
  const t = NHL_TEAMS.find(t => t.abbrev === abbrevOrName?.toUpperCase() || t.name.toLowerCase() === abbrevOrName?.toLowerCase())
  return t?.conf || null
}
function teamDiv(abbrevOrName) {
  const t = NHL_TEAMS.find(t => t.abbrev === abbrevOrName?.toUpperCase() || t.name.toLowerCase() === abbrevOrName?.toLowerCase())
  return t?.div || null
}

/* ── Theming ── */
function applyTheme() {
  const t = teamByAbbrev(prefs.myTeam)
  const r = document.documentElement
  if (t) {
    r.style.setProperty('--t1', t.c1)
    r.style.setProperty('--t2', t.c2)
    r.style.setProperty('--accent', t.c1)
    r.style.setProperty('--accent2', shadeColor(t.c1, -20))
  } else {
    r.style.setProperty('--t1', '#003087'); r.style.setProperty('--t2', '#FCB514')
    r.style.setProperty('--accent', '#003087'); r.style.setProperty('--accent2', '#001a4a')
  }
  const hdr   = document.getElementById('my-team-header')
  const crest = document.getElementById('my-team-crest')
  const label = document.getElementById('my-team-label')
  if (t) { crest.src = logoUrl(t.abbrev); label.textContent = t.name; hdr.style.display = 'flex' }
  else { hdr.style.display = 'none' }
}
function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#',''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + pct))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct))
  const b = Math.min(255, Math.max(0, (num & 0xff) + pct))
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')
}

/* ── Time ── */
function getTz() { return prefs.tz === 'auto' ? undefined : prefs.tz }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour:'numeric', minute:'2-digit', timeZone: getTz() }) }
function fmtDate(iso) { return new Date(iso).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', timeZone: getTz() }) }
function dayKey(iso) { return new Date(iso).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', timeZone: getTz() }) }

/* ── Fetch ── */
async function fetchSchedule() {
  const [sched, arch] = await Promise.all([
    fetch('/data/schedule.json').then(r => r.json()).catch(() => ({ games: [] })),
    fetch('/data/archive.json').then(r => r.json()).catch(() => ({ games: [] })),
  ])
  allGames     = sched.games     || []
  archiveGames = arch.games      || []
  generatedAt  = sched.generatedAt

  for (const g of allGames) {
    for (const side of [g.home, g.away]) {
      if (side?.abbrev && !teamLogoCache.has(side.abbrev)) {
        teamLogoCache.set(side.abbrev, { logo: side.logo, id: side.id })
      }
    }
  }

  const el = document.getElementById('updated')
  if (el) el.textContent = generatedAt
    ? 'Updated ' + new Date(generatedAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })
    : 'No data'
}

/* ── Filter ── */
function filteredGames() {
  let games = prefs.showArchive ? [...archiveGames, ...allGames] : [...allGames]

  if (prefs.conference !== 'all') {
    games = games.filter(g => {
      const hc = teamConf(g.home?.abbrev) || teamConf(g.home?.name)
      const ac = teamConf(g.away?.abbrev) || teamConf(g.away?.name)
      return hc === prefs.conference || ac === prefs.conference
    })
  }
  if (prefs.division !== 'all') {
    games = games.filter(g => {
      const hd = teamDiv(g.home?.abbrev) || teamDiv(g.home?.name)
      const ad = teamDiv(g.away?.abbrev) || teamDiv(g.away?.name)
      return hd === prefs.division || ad === prefs.division
    })
  }
  if (prefs.statusFilter.length) {
    games = games.filter(g => prefs.statusFilter.includes(g.status))
  }
  const q = document.getElementById('search')?.value?.toLowerCase()
  if (q) {
    games = games.filter(g =>
      g.home?.name?.toLowerCase().includes(q) || g.away?.name?.toLowerCase().includes(q)
    )
  }
  if (prefs.savedOnly) games = games.filter(g => prefs.savedGames.includes(g.id))
  if (prefs.hideWatched) games = games.filter(g => !prefs.watchedGames.includes(g.id))
  return games
}

/* ── Render ── */
function render() {
  if (prefs.view === 'teams') { renderTeams(); return }
  const games = filteredGames()
  const list  = document.getElementById('list')

  if (!games.length) {
    const isOffseason = allGames.length === 0 && archiveGames.length === 0
    list.innerHTML = isOffseason
      ? `<div class="offseason-card">
          <div class="os-icon">🏒</div>
          <div class="os-title">NHL Offseason</div>
          <div class="os-date">Regular Season begins October 2026</div>
          <div class="os-sub">Check back closer to opening night</div>
        </div>`
      : '<div class="empty">No games match your filters.</div>'
    return
  }

  // Group by day
  const byDay = new Map()
  for (const g of games) {
    const k = dayKey(g.date)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k).push(g)
  }

  const isFavTeam = abbrev => prefs.favTeams.includes(abbrev)
  const isMyTeam  = abbrev => abbrev === prefs.myTeam

  let html = ''
  for (const [day, dayGames] of byDay) {
    html += `<div class="week-group">`
    html += `<div class="week-heading">${day}</div>`
    for (const g of dayGames) html += renderGameCard(g, isFavTeam, isMyTeam)
    html += `</div>`
  }
  list.innerHTML = html
  rebindCards()
}

function renderGameCard(g, isFavTeam, isMyTeam) {
  const isLive      = g.status === 'in-progress'
  const isCompleted = g.status === 'completed'
  const isSaved     = prefs.savedGames.includes(g.id)
  const isWatched   = prefs.watchedGames.includes(g.id)
  const myTeamGame  = isMyTeam(g.home?.abbrev) || isMyTeam(g.away?.abbrev)

  let cardClass = 'game-card'
  if (myTeamGame) cardClass += ' my-team-game'
  else if (isLive) cardClass += ' live'
  if (isWatched) cardClass += ' watched'

  let timeLabel = fmtTime(g.date)
  let timeLabelClass = 'game-time-label'
  let timeSub = ''
  if (isLive) { timeLabel = g.statusDetail || 'LIVE'; timeLabelClass += ' live-label' }
  else if (isCompleted) {
    timeLabel = 'Final'; timeLabelClass += ' final-label'
    if (g.overtime) timeSub = g.overtime
  }

  const showScore = prefs.showScores && (isLive || isCompleted)
  const homeScore = showScore && g.home?.score != null
    ? `<span class="team-score${g.home?.winner ? ' winner' : ''}">${g.home.score}</span>`
    : `<span class="team-score score-hidden">-</span>`
  const awayScore = showScore && g.away?.score != null
    ? `<span class="team-score${g.away?.winner ? ' winner' : ''}">${g.away.score}</span>`
    : `<span class="team-score score-hidden">-</span>`

  const hLogo   = g.home?.logo  || logoUrl(g.home?.abbrev)
  const aLogo   = g.away?.logo  || logoUrl(g.away?.abbrev)
  const hTeamId = teamLogoCache.get(g.home?.abbrev)?.id || g.home?.id || null
  const aTeamId = teamLogoCache.get(g.away?.abbrev)?.id || g.away?.id || null

  const hRosterBtn = hTeamId ? `<button class="roster-pill" data-team-id="${hTeamId}" data-team-abbrev="${g.home?.abbrev||''}" data-team-name="${g.home?.name||''}">Roster</button>` : ''
  const aRosterBtn = aTeamId ? `<button class="roster-pill" data-team-id="${aTeamId}" data-team-abbrev="${g.away?.abbrev||''}" data-team-name="${g.away?.name||''}">Roster</button>` : ''

  const hRecord = g.home?.record ? `<span class="team-record">(${g.home.record})</span>` : ''
  const aRecord = g.away?.record ? `<span class="team-record">(${g.away.record})</span>` : ''
  const hFav = isFavTeam(g.home?.abbrev) ? ' ★' : ''
  const aFav = isFavTeam(g.away?.abbrev) ? ' ★' : ''

  const otBadge = (isCompleted && g.overtime) ? `<span class="ot-badge">${g.overtime}</span>` : ''
  const metaParts = []
  if (prefs.showBroadcast && g.broadcast) metaParts.push(`<span class="broadcast-tag">${g.broadcast}</span>`)
  if (prefs.showVenue && g.venue) metaParts.push(`<span class="venue-tag">${g.venue}</span>`)

  return `
<div class="${cardClass}" data-game-id="${g.id}">
  <div class="game-time">
    <div class="${timeLabelClass}">${timeLabel}</div>
    ${timeSub ? `<div class="game-time-sub">${timeSub}</div>` : ''}
    ${otBadge}
  </div>
  <div class="game-teams">
    <div class="game-team-row">
      <img class="team-logo" src="${aLogo}" alt="" onerror="this.style.display='none'" />
      <span class="team-name">${g.away?.name||'Away'}${aFav}</span>
      ${aRecord}${awayScore}${aRosterBtn}
    </div>
    <div class="game-team-row">
      <img class="team-logo" src="${hLogo}" alt="" onerror="this.style.display='none'" />
      <span class="team-name">${g.home?.name||'Home'}${hFav}</span>
      ${hRecord}${homeScore}${hRosterBtn}
    </div>
    ${g.note ? `<div class="game-note">${g.note}</div>` : ''}
  </div>
  <div class="game-meta">
    <button class="star-btn${isSaved ? ' active' : ''}" data-id="${g.id}" title="Save game">★</button>
    ${isCompleted ? `<button class="watch-btn${isWatched?' watched':''}" data-id="${g.id}">${isWatched?'✓':'○'}</button>` : ''}
    ${metaParts.join('')}
  </div>
</div>`
}

function rebindCards() {
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset.id
      if (prefs.savedGames.includes(id)) prefs.savedGames = prefs.savedGames.filter(x => x !== id)
      else prefs.savedGames.push(id)
      savePrefs(); btn.classList.toggle('active', prefs.savedGames.includes(id))
    })
  })
  document.querySelectorAll('.watch-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      const id = btn.dataset.id
      if (prefs.watchedGames.includes(id)) prefs.watchedGames = prefs.watchedGames.filter(x => x !== id)
      else prefs.watchedGames.push(id)
      savePrefs(); render()
    })
  })
  document.querySelectorAll('.roster-pill').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openTeamRoster(btn.dataset.teamId, btn.dataset.teamAbbrev, btn.dataset.teamName)
    })
  })
}

/* ── Teams view ── */
function renderTeams() {
  const list = document.getElementById('list')
  const confFilter = prefs.conference
  const divFilter  = prefs.division

  const teams = NHL_TEAMS.filter(t =>
    (confFilter === 'all' || t.conf === confFilter) &&
    (divFilter  === 'all' || t.div  === divFilter)
  )

  const byGroup = {}
  for (const t of teams) {
    const key = `${t.conf}|${t.div}`
    if (!byGroup[key]) byGroup[key] = { conf: t.conf, div: t.div, teams: [] }
    byGroup[key].teams.push(t)
  }

  const confOrder = ['East','West']
  const divOrder  = { East: ['Atlantic','Metropolitan'], West: ['Central','Pacific'] }

  let html = ''
  for (const conf of confOrder) {
    html += `<div class="teams-section"><div class="teams-section-heading">${conf}ern Conference</div>`
    for (const div of divOrder[conf]) {
      const block = byGroup[`${conf}|${div}`]
      if (!block) continue
      html += `<div class="division-block"><div class="division-label">${div}</div><div class="teams-grid">`
      for (const t of block.teams) {
        const cached = teamLogoCache.get(t.abbrev)
        const teamId = cached?.id || t.espnId
        const logo   = cached?.logo || logoUrl(t.abbrev)
        html += `<div class="team-card" data-team-id="${teamId||''}" data-team-abbrev="${t.abbrev}" data-team-name="${t.name}">
          <img class="team-card-crest" src="${logo}" alt="${t.name}" onerror="this.style.display='none'" />
          <div class="team-card-name">${t.name}</div>
        </div>`
      }
      html += `</div></div>`
    }
    html += `</div>`
  }
  list.innerHTML = html

  document.querySelectorAll('.team-card').forEach(card => {
    card.addEventListener('click', () => {
      openTeamRoster(card.dataset.teamId, card.dataset.teamAbbrev, card.dataset.teamName)
    })
  })
}

/* ── Roster modal ── */
function showModal(html) {
  let backdrop = document.getElementById('modal-backdrop')
  if (!backdrop) {
    backdrop = document.createElement('div')
    backdrop.id = 'modal-backdrop'; backdrop.className = 'modal-backdrop'
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal() })
    document.body.appendChild(backdrop)
  }
  backdrop.innerHTML = html
  backdrop.classList.remove('hidden')
  backdrop.querySelector('.modal-close')?.addEventListener('click', closeModal)
  document.addEventListener('keydown', escClose)
}
function closeModal() { document.getElementById('modal-backdrop')?.classList.add('hidden'); document.removeEventListener('keydown', escClose) }
function escClose(e) { if (e.key === 'Escape') closeModal() }

async function openTeamRoster(teamId, abbrev, name) {
  if (!teamId) return
  showModal(`<div class="modal"><div class="modal-header">
    <img class="modal-logo" src="${logoUrl(abbrev)}" alt="" onerror="this.style.display='none'" />
    <span class="modal-title">${name}</span>
    <button class="modal-close">✕</button>
  </div><div class="modal-body"><div class="empty">Loading roster…</div></div></div>`)

  const year = new Date().getFullYear()
  let athletes = []
  for (const y of [year, year - 1]) {
    try {
      const res  = await fetch(`${ESPN_BASE}/teams/${teamId}/roster?season=${y}`)
      const data = await res.json()
      athletes = data.athletes?.flatMap(g => g.items || g) || data.athletes || []
      if (athletes.length) break
    } catch {}
  }

  for (const p of athletes) {
    if (p.id) rosterPlayerCache.set(String(p.id), { ...p, _teamId: teamId, _teamAbbrev: abbrev, _teamName: name })
  }

  const groups = {}
  for (const p of athletes) {
    const pos = p.position?.abbreviation || p.position?.displayName || 'Other'
    if (!groups[pos]) groups[pos] = []
    groups[pos].push(p)
  }

  const orderedPos = POSITION_ORDER.filter(p => groups[p])
  const remaining  = Object.keys(groups).filter(p => !POSITION_ORDER.includes(p))

  const upcoming = allGames
    .filter(g => g.status === 'scheduled' &&
      (String(g.home?.id) === String(teamId) || String(g.away?.id) === String(teamId) ||
       g.home?.abbrev === abbrev || g.away?.abbrev === abbrev))
    .slice(0, 3)

  let upcomingHtml = ''
  if (upcoming.length) {
    upcomingHtml = `<div class="prf-upcoming">
      <div class="prf-section-label">Upcoming games</div>
      ${upcoming.map(g => {
        const opp = g.home?.abbrev === abbrev ? g.away : g.home
        const ha  = g.home?.abbrev === abbrev ? 'vs' : '@'
        return `<div class="prf-upcoming-row">
          <span class="prf-upcoming-date">${fmtDate(g.date).split(',')[0]} ${fmtTime(g.date)}</span>
          <span class="prf-upcoming-match">${ha} ${opp?.name||''}</span>
          ${g.broadcast ? `<span class="prf-upcoming-tv">${g.broadcast}</span>` : ''}
        </div>`
      }).join('')}
    </div>`
  }

  let rosterHtml = ''
  if (!athletes.length) {
    rosterHtml = '<div class="empty">Roster not available.</div>'
  } else {
    for (const pos of [...orderedPos, ...remaining]) {
      rosterHtml += `<div class="position-group"><div class="position-label">${pos}</div>`
      for (const p of groups[pos]) {
        const isSaved = prefs.favPlayers.some(fp => fp.id === String(p.id))
        const photo   = p.headshot?.href || ''
        rosterHtml += `<div class="player-row" data-player-id="${p.id}">
          <img class="player-avatar" src="${photo}" alt="" onerror="this.style.display='none'" />
          <span class="player-jersey">#${p.jersey||'—'}</span>
          <span class="player-name">${p.displayName||p.fullName||'Unknown'}</span>
          <span class="player-nat">${p.citizenship||p.birthPlace?.country||''}</span>
          <button class="player-save-btn${isSaved?' saved':''}" data-player-id="${p.id}" title="${isSaved?'Unsave':'Save player'}">★</button>
        </div>`
      }
      rosterHtml += '</div>'
    }
  }

  const modal = document.querySelector('#modal-backdrop .modal')
  if (!modal) return
  modal.querySelector('.modal-body').innerHTML = upcomingHtml + rosterHtml

  modal.querySelectorAll('.player-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.classList.contains('player-save-btn')) return
      openPlayerProfile(row.dataset.playerId, abbrev, name)
    })
  })
  modal.querySelectorAll('.player-save-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleSavePlayer(btn.dataset.playerId, btn) })
  })
}

function toggleSavePlayer(playerId, btn) {
  const p = rosterPlayerCache.get(String(playerId))
  if (!p) return
  const exists = prefs.favPlayers.some(fp => fp.id === String(playerId))
  if (exists) { prefs.favPlayers = prefs.favPlayers.filter(fp => fp.id !== String(playerId)); btn?.classList.remove('saved') }
  else {
    prefs.favPlayers.push({ id: String(playerId), name: p.displayName||p.fullName, team: p._teamName, abbrev: p._teamAbbrev, teamId: p._teamId, photo: p.headshot?.href||'' })
    btn?.classList.add('saved')
  }
  savePrefs(); buildPlayersPanel()
}

async function openPlayerProfile(playerId, teamAbbrev, teamName) {
  const p = rosterPlayerCache.get(String(playerId))
  if (!p) return
  const photo   = p.headshot?.href || ''
  const pos     = p.position?.abbreviation || p.position?.displayName || ''
  const jersey  = p.jersey ? `#${p.jersey}` : ''
  const age     = p.age ? `Age ${p.age}` : ''
  const ht      = p.displayHeight || ''
  const wt      = p.displayWeight || ''
  const meta    = [ht, wt, age, p.birthPlace?.city ? `${p.birthPlace.city}, ${p.birthPlace?.country||''}` : ''].filter(Boolean).join(' · ')
  const isSaved = prefs.favPlayers.some(fp => fp.id === String(playerId))
  const abbrev  = teamAbbrev || p._teamAbbrev || ''

  const cardBase = (statsContent) => `
<div class="modal" style="max-width:440px">
  <div class="modal-header">
    <button class="btn-outline" onclick="openTeamRoster('${p._teamId}','${abbrev}','${teamName||p._teamName}')">← Roster</button>
    <span class="modal-title" style="font-size:15px">${teamName||p._teamName||''}</span>
    <button class="modal-close">✕</button>
  </div>
  <div class="player-card">
    <div class="pc-header">
      ${photo ? `<img class="pc-photo" src="${photo}" alt="" onerror="this.style.display='none'" />` : `<div class="pc-photo"></div>`}
      <div>
        <div class="pc-jersey">${jersey}</div>
        ${pos ? `<div class="pc-pos-badge">${pos}</div>` : ''}
      </div>
    </div>
    <div class="pc-body">
      <div class="pc-name">${p.displayName||p.fullName||'Unknown'}</div>
      ${meta ? `<div class="pc-meta">${meta}</div>` : ''}
      <div id="pc-stats-area">${statsContent}</div>
      <div class="pc-actions">
        <button class="btn-outline" id="pc-save-btn" data-player-id="${playerId}">
          ${isSaved ? '★ Saved' : '☆ Save player'}
        </button>
      </div>
    </div>
  </div>
</div>`

  showModal(cardBase('<div class="pc-meta" style="color:var(--muted)">No recent stats available.</div>'))
  document.getElementById('pc-save-btn')?.addEventListener('click', function() {
    toggleSavePlayer(playerId, null)
    this.textContent = prefs.favPlayers.some(fp => fp.id === String(playerId)) ? '★ Saved' : '☆ Save player'
  })
}

async function ensureRosterCached(teamId, abbrev, teamName) {
  const year = new Date().getFullYear()
  for (const y of [year, year - 1]) {
    try {
      const res  = await fetch(`${ESPN_BASE}/teams/${teamId}/roster?season=${y}`)
      const data = await res.json()
      const athletes = data.athletes?.flatMap(g => g.items || g) || data.athletes || []
      if (!athletes.length) continue
      for (const p of athletes) {
        if (p.id) rosterPlayerCache.set(String(p.id), { ...p, _teamId: teamId, _teamAbbrev: abbrev, _teamName: teamName })
      }
      return
    } catch {}
  }
}

/* ── Players panel ── */
function buildPlayersPanel() {
  const panel = document.getElementById('players-panel')
  if (!panel) return
  if (!prefs.favPlayers.length) {
    panel.innerHTML = '<div class="fav-players-empty">No saved players yet. Tap a player in any roster to save them.</div>'
    return
  }
  panel.innerHTML = prefs.favPlayers.map(fp => `
    <div class="fav-player-row" data-player-id="${fp.id}" data-team-id="${fp.teamId}" data-team-abbrev="${fp.abbrev}" data-team-name="${fp.team}">
      <img class="fav-player-avatar" src="${fp.photo}" alt="" onerror="this.style.display='none'" />
      <div class="fav-player-info">
        <div class="fav-player-name">${fp.name}</div>
        <div class="fav-player-team">${fp.team}</div>
      </div>
      <button class="fav-player-remove" data-player-id="${fp.id}" title="Remove">✕</button>
    </div>
  `).join('')
  panel.querySelectorAll('.fav-player-row').forEach(row => {
    row.addEventListener('click', async e => {
      if (e.target.classList.contains('fav-player-remove')) return
      const pid = row.dataset.playerId
      if (!rosterPlayerCache.has(pid)) await ensureRosterCached(row.dataset.teamId, row.dataset.teamAbbrev, row.dataset.teamName)
      openPlayerProfile(pid, row.dataset.teamAbbrev, row.dataset.teamName)
    })
  })
  panel.querySelectorAll('.fav-player-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      prefs.favPlayers = prefs.favPlayers.filter(fp => fp.id !== btn.dataset.playerId)
      savePrefs(); buildPlayersPanel()
    })
  })
}

/* ── Favorites panel ── */
function buildFavoritesPanel() {
  const panel = document.getElementById('favorites-panel')
  if (!panel) return
  const faved  = NHL_TEAMS.filter(t => prefs.favTeams.includes(t.abbrev))
  const show   = faved.length ? faved : NHL_TEAMS

  panel.innerHTML = show.map(t => {
    const isFav = prefs.favTeams.includes(t.abbrev)
    const isMyT = prefs.myTeam === t.abbrev
    const logo  = teamLogoCache.get(t.abbrev)?.logo || logoUrl(t.abbrev)
    return `<div class="fav-team-row">
      <img class="fav-team-logo" src="${logo}" alt="" onerror="this.style.display='none'" />
      <span class="fav-team-name">${t.name}</span>
      ${faved.length ? `<button class="my-team-btn${isMyT?' active':''}" data-abbrev="${t.abbrev}">${isMyT?'★ My Team':'☆ My Team'}</button>` : ''}
      <button class="fav-team-star" data-abbrev="${t.abbrev}" title="${isFav?'Unfavorite':'Favorite'}" style="${isFav?'':'color:var(--border)'}">★</button>
    </div>`
  }).join('')

  panel.querySelectorAll('.fav-team-star').forEach(btn => {
    btn.addEventListener('click', () => {
      const abbrev = btn.dataset.abbrev
      if (prefs.favTeams.includes(abbrev)) prefs.favTeams = prefs.favTeams.filter(a => a !== abbrev)
      else prefs.favTeams.push(abbrev)
      savePrefs(); buildFavoritesPanel(); render()
    })
  })
  panel.querySelectorAll('.my-team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prefs.myTeam = prefs.myTeam === btn.dataset.abbrev ? null : btn.dataset.abbrev
      savePrefs(); applyTheme(); buildFavoritesPanel(); render()
    })
  })
}

/* ── View toggle ── */
function moveSliderTrack() {
  const active = document.querySelector('.view-opt.active')
  const track  = document.querySelector('.view-slider-track')
  if (active && track) {
    track.style.transform = `translateX(${active.offsetLeft - 3}px)`
    track.style.width     = `${active.offsetWidth}px`
  }
}
function initViewToggle() {
  document.querySelectorAll('.view-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-opt').forEach(b => b.classList.remove('active'))
      btn.classList.add('active'); prefs.view = btn.dataset.view
      savePrefs(); moveSliderTrack(); render()
    })
    btn.classList.toggle('active', btn.dataset.view === prefs.view)
  })
  requestAnimationFrame(() => requestAnimationFrame(moveSliderTrack))
}

/* ── Controls ── */
function initTzSelect() {
  const sel = document.getElementById('tz-select')
  if (!sel) return
  Intl.supportedValuesOf('timeZone').forEach(tz => {
    const opt = document.createElement('option'); opt.value = tz; opt.textContent = tz
    document.getElementById('tz-all').appendChild(opt)
  })
  sel.value = prefs.tz || 'auto'
  sel.addEventListener('change', () => { prefs.tz = sel.value; savePrefs(); render() })
}

function initControls() {
  document.querySelectorAll('[data-conf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.conf === prefs.conference)
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-conf]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active'); prefs.conference = btn.dataset.conf; savePrefs(); render()
    })
  })
  document.querySelectorAll('[data-div]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.div === prefs.division)
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-div]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active'); prefs.division = btn.dataset.div; savePrefs(); render()
    })
  })
  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.classList.toggle('active', prefs.statusFilter.includes(btn.dataset.status))
    btn.addEventListener('click', () => {
      const s = btn.dataset.status
      if (prefs.statusFilter.includes(s)) prefs.statusFilter = prefs.statusFilter.filter(x => x !== s)
      else prefs.statusFilter.push(s)
      btn.classList.toggle('active', prefs.statusFilter.includes(s)); savePrefs(); render()
    })
  })

  const toggleMap = {
    'toggle-scores':       ['showScores',   () => render()],
    'toggle-venue':        ['showVenue',     () => render()],
    'toggle-broadcast':    ['showBroadcast', () => render()],
    'toggle-hide-watched': ['hideWatched',   () => render()],
    'toggle-archive':      ['showArchive',   () => render()],
  }
  for (const [id, [key, cb]] of Object.entries(toggleMap)) {
    const el = document.getElementById(id)
    if (!el) continue
    el.checked = !!prefs[key]
    el.addEventListener('change', () => { prefs[key] = el.checked; savePrefs(); cb() })
  }

  document.getElementById('search')?.addEventListener('input', render)
  document.getElementById('refresh-btn')?.addEventListener('click', async () => {
    document.getElementById('updated').textContent = 'Refreshing…'
    await fetch('/api/refresh', { method: 'POST' })
    await fetchSchedule(); render()
  })
  document.getElementById('filters-toggle')?.addEventListener('click', () => {
    document.getElementById('controls-secondary')?.classList.toggle('open')
  })

  const favToggle = document.getElementById('favorites-toggle')
  const favPanel  = document.getElementById('favorites-panel')
  favToggle?.addEventListener('click', () => {
    favPanel?.classList.toggle('hidden')
    if (!favPanel?.classList.contains('hidden')) buildFavoritesPanel()
  })

  const playersToggle = document.getElementById('players-toggle')
  const playersPanel  = document.getElementById('players-panel')
  playersToggle?.addEventListener('click', () => {
    playersPanel?.classList.toggle('hidden')
    if (!playersPanel?.classList.contains('hidden')) buildPlayersPanel()
  })

  document.getElementById('saved-toggle')?.addEventListener('click', () => {
    prefs.savedOnly = !prefs.savedOnly; savePrefs(); render()
  })
}

/* ── Boot ── */
async function init() {
  loadPrefs(); applyTheme(); initControls(); initViewToggle(); initTzSelect()
  await fetchSchedule(); render()
  if (allGames.length === 0 && !generatedAt) {
    const el = document.getElementById('updated')
    if (el) el.textContent = 'Warming up…'
    let retries = 0
    const poll = setInterval(async () => {
      await fetchSchedule()
      if (allGames.length > 0 || ++retries >= 8) { clearInterval(poll); render() }
    }, 5000)
  }
}
init()
