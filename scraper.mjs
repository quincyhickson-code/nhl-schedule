import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE     = join(__dirname, 'data', 'schedule.json')
const ARCHIVE_FILE = join(__dirname, 'data', 'archive.json')
const CHANGES_FILE = join(__dirname, 'data', 'changes.json')
const CHANGES_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000

const DAYS_BACK    = 14
const DAYS_FORWARD = 21

function ymd(date) { return date.toISOString().slice(0, 10).replace(/-/g, '') }

function dateRange() {
  const from = new Date(); from.setDate(from.getDate() - DAYS_BACK)
  const to   = new Date(); to.setDate(to.getDate() + DAYS_FORWARD)
  return { from: ymd(from), to: ymd(to) }
}

function statusOf(comp) {
  const t = comp.status?.type || {}
  if (t.state === 'post' || t.completed) return 'completed'
  if (t.state === 'in') return 'in-progress'
  if (t.name === 'STATUS_POSTPONED' || t.name === 'STATUS_CANCELED') return 'postponed'
  return 'scheduled'
}

function overtimeOf(comp) {
  const detail = comp.status?.type?.shortDetail || ''
  if (/\bSO\b/i.test(detail)) return 'SO'
  if (/\bOT\b/i.test(detail)) return 'OT'
  return null
}

function teamInfo(c) {
  return {
    name:   c.team?.displayName || c.team?.name || 'Unknown',
    abbrev: c.team?.abbreviation || '',
    logo:   c.team?.logo || null,
    id:     c.team?.id || null,
    score:  c.score ?? null,
    record: c.records?.find(r => r.type === 'total')?.summary || null,
    winner: c.winner === true,
  }
}

async function loadJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf-8')) } catch { return fallback }
}

function updateChanges(prevGames, newGames, existingChanges) {
  const prevById    = new Map(prevGames.map(g => [g.id, g]))
  const newById     = new Map(newGames.map(g => [g.id, g]))
  const changesById = new Map(existingChanges.map(c => [c.gameId, c]))
  const now         = new Date().toISOString()

  for (const g of newGames) {
    const prev = prevById.get(g.id)
    if (!prev || prev.status === 'completed') continue
    const dateChanged   = prev.date !== g.date
    const statusChanged = prev.status !== g.status &&
      (g.status === 'postponed' || prev.status === 'postponed')
    if (!dateChanged && !statusChanged) continue

    const existing       = changesById.get(g.id)
    const baselineDate   = existing ? existing.oldDate   : prev.date
    const baselineStatus = existing ? existing.oldStatus : prev.status
    if (baselineDate === g.date && baselineStatus === g.status) { changesById.delete(g.id); continue }

    changesById.set(g.id, {
      gameId: g.id,
      home: g.home?.name || '', away: g.away?.name || '',
      oldDate: baselineDate, newDate: g.date,
      oldStatus: baselineStatus, newStatus: g.status,
      firstDetectedAt: existing ? existing.firstDetectedAt : now, detectedAt: now,
    })
  }
  for (const [id] of changesById) {
    const cur = newById.get(id)
    if (!cur || cur.status === 'completed') changesById.delete(id)
  }
  const cutoff = Date.now() - CHANGES_MAX_AGE_MS
  for (const [id, c] of changesById) {
    if (new Date(c.firstDetectedAt).getTime() < cutoff) changesById.delete(id)
  }
  return [...changesById.values()].sort((a, b) => new Date(a.newDate) - new Date(b.newDate))
}

async function fetchNHL(from, to) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${from}-${to}&limit=500`
  const res = await fetch(url, { headers: { 'User-Agent': 'nhl-schedule-app/1.0 (personal use)' } })
  if (!res.ok) throw new Error(`NHL: HTTP ${res.status}`)
  const data = await res.json()

  return (data.events || []).map(ev => {
    const comp = ev.competitions?.[0] || {}
    const home = comp.competitors?.find(c => c.homeAway === 'home')
    const away = comp.competitors?.find(c => c.homeAway === 'away')
    const broadcasts = (comp.broadcasts || []).flatMap(b => b.names || []).filter(Boolean)
    const series = comp.series?.summary || ev.seriesSummary?.description || null
    const status = statusOf(comp)

    return {
      id:           ev.id,
      date:         ev.date,
      status,
      statusDetail: comp.status?.type?.shortDetail || comp.status?.type?.description || '',
      overtime:     status === 'completed' ? overtimeOf(comp) : null,
      note:         comp.altGameNote || comp.notes?.[0]?.headline || series || '',
      venue:        comp.venue
                      ? [comp.venue.fullName, comp.venue.address?.city].filter(Boolean).join(', ')
                      : '',
      broadcast:    broadcasts.length ? broadcasts.join(', ') : null,
      home:         home ? teamInfo(home) : null,
      away:         away ? teamInfo(away) : null,
    }
  })
}

async function main() {
  const { from, to } = dateRange()
  let games = []
  const errors = []

  try {
    games = await fetchNHL(from, to)
  } catch (e) {
    errors.push(e.message)
  }

  games.sort((a, b) => new Date(a.date) - new Date(b.date))

  const previous = await loadJson(OUT_FILE, null)
  if (games.length === 0 && previous?.games?.length > 0) {
    console.error(`NHL fetch failed (${errors.join('; ')}) — keeping previous data.`)
    return
  }

  const previousChanges = await loadJson(CHANGES_FILE, { changes: [] })
  const changes = updateChanges(previous?.games || [], games, previousChanges.changes || [])

  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - DAYS_BACK)
  const currentIds = new Set(games.map(g => g.id))
  const agedOut = (previous?.games || []).filter(g => !currentIds.has(g.id) && new Date(g.date) < cutoff)
  if (agedOut.length) {
    const archive = await loadJson(ARCHIVE_FILE, { games: [] })
    const archiveById = new Map((archive.games || []).map(g => [g.id, g]))
    for (const g of agedOut) archiveById.set(g.id, g)
    const archiveGames = [...archiveById.values()].sort((a, b) => new Date(b.date) - new Date(a.date))
    await writeFile(ARCHIVE_FILE, JSON.stringify({ games: archiveGames }, null, 2))
    console.log(`Archived ${agedOut.length} game(s)`)
  }

  await mkdir(dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), range: { from, to }, errors, games }, null, 2))
  await writeFile(CHANGES_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), changes }, null, 2))
  console.log(`Wrote ${games.length} NHL games${errors.length ? ` (errors: ${errors.join('; ')})` : ''}`)
}

main().catch(err => { console.error('Scrape failed:', err); process.exit(1) })
