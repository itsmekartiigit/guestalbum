import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Download,
  Heart,
  Image as ImageIcon,
  Images,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Radio,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import {
  addGuestPhotoSelection,
  createAlbumGuestSession,
  createGuestAlbumArchive,
  createGuestSelectedArchive,
  getGuestDownloadPermission,
  getGuestAlbum,
  getGuestSelections,
  removeGuestPhotoSelection,
  type GuestAlbumMedia,
  type GuestAlbumResponse,
} from './services/albumService'
import AlbumPhotoWatermark from './AlbumPhotoWatermark'
import './App.css'

function getAlbumToken() {
  const match = window.location.pathname.match(/^\/album\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : ''
}

function App() {
  const token = useMemo(() => getAlbumToken(), [])
  const [album, setAlbum] = useState<GuestAlbumResponse['album'] | null>(null)
  const [branding, setBranding] = useState<NonNullable<GuestAlbumResponse['branding']> | null>(null)
  const [folders, setFolders] = useState<GuestAlbumResponse['folders']>([])
  const [media, setMedia] = useState<GuestAlbumMedia[]>([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [selected, setSelected] = useState<string[]>([])
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyMedia, setBusyMedia] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'gallery' | 'selection'>('gallery')
  const [confirmed, setConfirmed] = useState(false)
  const [downloadEnabled, setDownloadEnabled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [compactLayout, setCompactLayout] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const suppressNextClick = useRef(false)

  const selectionLimit = album?.settings.photoSelectionLimit ?? 0
  const selectedPhotos = useMemo(
    () => media.filter((item) => selected.includes(item.mediaId) && item.mediaType === 'photo'),
    [media, selected],
  )

  const visibleMedia = useMemo(() => {
    const source = activeTab === 'selection'
      ? media.filter((item) => selected.includes(item.mediaId) && item.mediaType === 'photo')
      : media.filter((item) => item.mediaType === 'photo' || item.mediaType === 'video')
    const query = search.trim().toLocaleLowerCase()
    return source.filter((item) => {
      const inFolder = activeTab === 'selection' || activeFolder === 'all' || item.folderId === activeFolder
      return inFolder && (!query || item.filename.toLocaleLowerCase().includes(query))
    })
  }, [media, activeFolder, activeTab, selected, search])

  const currentPhoto = viewerIndex === null ? null : visibleMedia[viewerIndex]

  useEffect(() => {
    let cancelled = false

    async function loadAlbum() {
      if (!token) {
        setError('This album link is invalid.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const storageKey = `onair_album_session_${token}`
        let guestSessionId = localStorage.getItem(storageKey) ?? ''
        if (guestSessionId) {
          try {
            const existing = await createAlbumGuestSession({ token, guestSessionId })
            guestSessionId = existing.data.sessionId
          } catch {
            guestSessionId = ''
          }
        }
        if (!guestSessionId) {
          const created = await createAlbumGuestSession({ token })
          guestSessionId = created.data.sessionId
          localStorage.setItem(storageKey, guestSessionId)
        }
        if (cancelled) return
        setSessionId(guestSessionId)

        const albumResult = await getGuestAlbum({ token, guestSessionId })
        if (cancelled) return

        const data = albumResult.data
        setAlbum(data.album)
        setBranding(data.branding ?? null)
        setDownloadEnabled(data.album.settings.downloadEnabled)
        setFolders(data.folders)

        let allMedia = [...data.media]
        let cursor = data.nextCursor
        while (cursor) {
          const nextPage = await getGuestAlbum({ token, guestSessionId, cursor })
          if (cancelled) return
          allMedia = [...allMedia, ...nextPage.data.media]
          cursor = nextPage.data.nextCursor
        }
        if (cancelled) return
        setMedia(allMedia)

        try {
          const existing = await getGuestSelections({ token, guestSessionId })
          if (!cancelled) setSelected(existing.data.mediaIds)
        } catch {
          if (!cancelled) setSelected([])
        }
      } catch (err) {
        console.error('Album loading failed:', err)
        if (!cancelled) setError('Unable to open this album. The link may have expired or been revoked.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadAlbum()
    return () => { cancelled = true }
  }, [token])

  useEffect(() => {
    if (!token || !sessionId) return
    let cancelled = false
    const refreshPermission = async () => {
      try {
        const result = await getGuestDownloadPermission({ token, guestSessionId: sessionId })
        if (!cancelled) setDownloadEnabled(result.data.downloadEnabled)
      } catch {
        if (!cancelled) setDownloadEnabled(false)
      }
    }
    void refreshPermission()
    const timer = window.setInterval(() => void refreshPermission(), 15000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [token, sessionId])

  const togglePhoto = useCallback(async (photo: GuestAlbumMedia) => {
    if (!sessionId || busyMedia) return
    const alreadySelected = selected.includes(photo.mediaId)

    if (!alreadySelected && selectionLimit > 0 && selectedPhotos.length >= selectionLimit) {
      setError(`You can select up to ${selectionLimit} photos.`)
      return
    }

    setBusyMedia(photo.mediaId)
    setError('')
    setConfirmed(false)
    try {
      if (alreadySelected) {
        await removeGuestPhotoSelection({ token, guestSessionId: sessionId, mediaId: photo.mediaId })
        setSelected((current) => current.filter((id) => id !== photo.mediaId))
      } else {
        await addGuestPhotoSelection({ token, guestSessionId: sessionId, mediaId: photo.mediaId })
        setSelected((current) => current.includes(photo.mediaId) ? current : [...current, photo.mediaId])
      }
    } catch (err) {
      console.error('Photo selection failed:', err)
      setError('Could not update your selection. Please try again.')
    } finally {
      setBusyMedia(null)
    }
  }, [token, sessionId, selected, selectedPhotos.length, selectionLimit, busyMedia])

  function cancelLongPress() {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
    pressStart.current = null
  }

  function startLongPress(event: ReactPointerEvent<HTMLElement>, photo: GuestAlbumMedia) {
    cancelLongPress()
    if (photo.mediaType !== 'photo' || selected.includes(photo.mediaId) || busyMedia) return
    pressStart.current = { x: event.clientX, y: event.clientY }
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      pressStart.current = null
      suppressNextClick.current = true
      void togglePhoto(photo)
    }, 450)
  }

  function moveLongPress(event: ReactPointerEvent<HTMLElement>) {
    if (!pressStart.current) return
    const distance = Math.hypot(event.clientX - pressStart.current.x, event.clientY - pressStart.current.y)
    if (distance > 12) cancelLongPress()
  }

  function clickMedia(photo: GuestAlbumMedia, index: number) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false
      return
    }
    if (photo.mediaType === 'photo' && selected.includes(photo.mediaId)) {
      void togglePhoto(photo)
      return
    }
    setViewerIndex(index)
  }

  function changeViewer(direction: number) {
    setViewerIndex((index) => {
      if (index === null || visibleMedia.length === 0) return null
      return (index + direction + visibleMedia.length) % visibleMedia.length
    })
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 45) changeViewer(delta < 0 ? 1 : -1)
    touchStartX.current = null
  }

  function openTab(tab: 'gallery' | 'selection') {
    cancelLongPress()
    setActiveTab(tab)
    setActiveFolder('all')
    setSearchOpen(false)
    setSearch('')
    setViewerIndex(null)
    setError('')
  }

  async function clearSelection() {
    if (!sessionId || selectedPhotos.length === 0 || busyMedia) return
    if (!window.confirm('Clear all selected photos?')) return
    setBusyMedia('__clear__')
    setError('')
    setConfirmed(false)
    try {
      await Promise.all(selectedPhotos.map((photo) =>
        removeGuestPhotoSelection({ token, guestSessionId: sessionId, mediaId: photo.mediaId }),
      ))
      setSelected((current) => current.filter((id) => !selectedPhotos.some((photo) => photo.mediaId === id)))
    } catch (err) {
      console.error('Clearing photo selections failed:', err)
      try {
        const latest = await getGuestSelections({ token, guestSessionId: sessionId })
        setSelected(latest.data.mediaIds)
      } catch {
        setError('Some selections could not be cleared. Please refresh and try again.')
      }
    } finally {
      setBusyMedia(null)
    }
  }

  async function confirmSelection() {
    if (!sessionId || selectedPhotos.length === 0 || busyMedia) return
    setBusyMedia('__confirm__')
    setError('')
    try {
      const latest = await getGuestSelections({ token, guestSessionId: sessionId })
      setSelected(latest.data.mediaIds)
      setConfirmed(true)
    } catch (err) {
      console.error('Confirming photo selection failed:', err)
      setError('Could not confirm your selection. Please try again.')
    } finally {
      setBusyMedia(null)
    }
  }

  async function downloadSelectedPhotos() {
    if (!sessionId || !downloadEnabled || selectedPhotos.length === 0 || busyMedia) return
    setBusyMedia('__download__')
    setError('')
    try {
      const permission = await getGuestDownloadPermission({ token, guestSessionId: sessionId })
      setDownloadEnabled(permission.data.downloadEnabled)
      if (!permission.data.downloadEnabled) {
        setError('Downloads are disabled for this album.')
        return
      }
      const result = await createGuestSelectedArchive({ token, guestSessionId: sessionId })
      window.location.assign(result.data.url)
    } catch (err) {
      console.error('Selected photo download failed:', err)
      setError('Could not download selected photos. Please try again.')
    } finally {
      setBusyMedia(null)
    }
  }

  async function downloadAllPhotos() {
    if (!sessionId || !downloadEnabled || busyMedia) return
    setBusyMedia('__download_all__')
    setError('')
    try {
      const permission = await getGuestDownloadPermission({ token, guestSessionId: sessionId })
      setDownloadEnabled(permission.data.downloadEnabled)
      if (!permission.data.downloadEnabled) {
        setError('Downloads are disabled for this album.')
        return
      }
      const result = await createGuestAlbumArchive({ token, guestSessionId: sessionId })
      window.location.assign(result.data.url)
    } catch (err) {
      console.error('Album photo download failed:', err)
      setError('Could not download album photos. Please try again.')
    } finally {
      setBusyMedia(null)
    }
  }

  async function downloadCurrentPhoto() {
    if (!currentPhoto || currentPhoto.mediaType !== 'photo' || !currentPhoto.previewUrl || !sessionId || !downloadEnabled || busyMedia) return
    setBusyMedia('__download_photo__')
    setError('')
    try {
      const permission = await getGuestDownloadPermission({ token, guestSessionId: sessionId })
      setDownloadEnabled(permission.data.downloadEnabled)
      if (!permission.data.downloadEnabled) {
        setError('Downloads are disabled for this album.')
        return
      }
      const link = document.createElement('a')
      link.href = currentPhoto.previewUrl
      link.download = currentPhoto.filename
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Photo download failed:', err)
      setError('Could not download this photo. Please try again.')
    } finally {
      setBusyMedia(null)
    }
  }

  function goBack() {
    if (window.history.length > 1) window.history.back()
    else window.location.assign('/')
  }

  if (loading) {
    return (
      <main className="app status-page">
        <LoaderCircle className="spinner" size={34} />
        <h2>Opening your album</h2>
        <p>Loading your wedding memories...</p>
      </main>
    )
  }

  if (error && !album) {
    return (
      <main className="app status-page">
        <div className="status-icon"><LockKeyhole size={26} /></div>
        <h2>Album unavailable</h2>
        <p>{error}</p>
        <span className="status-brand"><Radio size={16} /> ON AIR</span>
      </main>
    )
  }

  if (!album) return null

  const remaining = selectionLimit > 0 ? Math.max(0, selectionLimit - selectedPhotos.length) : null
  const filterFolders = folders

  return (
    <main className="app gallery-app">
      <header className="topbar">
        <button className="header-icon back-control" type="button" onClick={goBack} aria-label="Go back"><ArrowLeft /></button>
        <div className="brand-block">
          <div className="brand"><Radio aria-hidden="true" /> ON AIR</div>
          <span>Wedding Album Selection</span>
        </div>
        <div className="header-tools">
          {activeTab === 'gallery' && <>
            {downloadEnabled && <button className="header-icon download-all-control" type="button" onClick={() => void downloadAllPhotos()} disabled={Boolean(busyMedia)} aria-label="Download all photos" title="Download all photos">
              {busyMedia === '__download_all__' ? <LoaderCircle className="spinner" /> : <Download />}
            </button>}
            <button className={`header-icon ${searchOpen ? 'tool-active' : ''}`} type="button" onClick={() => { setSearchOpen((open) => !open); setSearch('') }} aria-label="Search photos"><Search /></button>
            <button className={`header-icon ${compactLayout ? 'tool-active' : ''}`} type="button" onClick={() => setCompactLayout((compact) => !compact)} aria-label="Toggle gallery spacing"><Grid2X2 /></button>
          </>}
        </div>
      </header>

      {searchOpen && activeTab === 'gallery' && (
        <label className="search-bar">
          <Search size={18} aria-hidden="true" />
          <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search photos by filename" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={17} /></button>}
        </label>
      )}

      <nav className="top-tabs" aria-label="Album navigation">
        <button type="button" className={activeTab === 'gallery' ? 'active' : ''} onClick={() => openTab('gallery')}>
          <Images size={20} /><span>Gallery</span>
        </button>
        <button type="button" className={activeTab === 'selection' ? 'active' : ''} onClick={() => openTab('selection')}>
          <Layers size={20} /><span>View Selection ({selectedPhotos.length})</span>
        </button>
      </nav>

      {activeTab === 'gallery' ? (
        <>
          <section className="gallery-heading">
            <span className="eyebrow">YOUR WEDDING COLLECTION</span>
            <h1>Explore <em>Gallery</em></h1>
            <p>{album.albumName} · Press and hold the photo to select</p>
          </section>

          <div className="folder-scroll" aria-label="Filter photos by folder">
            <button className={`folder-chip ${activeFolder === 'all' ? 'active' : ''}`} onClick={() => setActiveFolder('all')} type="button">
              <Images size={18} /> All Photos
            </button>
            {filterFolders.map((folder) => (
              <button key={folder.folderId} className={`folder-chip ${activeFolder === folder.folderId ? 'active' : ''}`} onClick={() => setActiveFolder(folder.folderId)} type="button">
                <Heart size={17} /> {folder.folderName}
              </button>
            ))}
            <button className="folder-chip" type="button" onClick={() => openTab('selection')}>
              <Check size={18} /> Selected ({selectedPhotos.length})
            </button>
          </div>

          <SelectionSummary count={selectedPhotos.length} remaining={remaining} />
        </>
      ) : (
        <>
          <section className="gallery-heading selection-heading">
            <span className="eyebrow">YOUR FAVOURITES</span>
            <h1>Your <em>Selected Photos</em></h1>
            <p>Review and manage your selected photos.</p>
          </section>
          <SelectionSummary count={selectedPhotos.length} remaining={remaining} />
        </>
      )}

      {error && <p className="inline-error" role="alert">{error}</p>}

      <section className={`photo-grid ${compactLayout && activeTab === 'gallery' ? 'compact-layout' : ''}`} aria-label={activeTab === 'selection' ? 'Selected photos' : 'Wedding album photos'}>
        {visibleMedia.map((photo, index) => {
          const isSelected = selected.includes(photo.mediaId)
          const imageUrl = photo.thumbnailUrl || photo.previewUrl
          const numberLabel = photo.serialNumber !== null ? `#${String(photo.serialNumber).padStart(3, '0')}` : null
          return (
            <article
              key={photo.mediaId}
              className={`photo-card ${isSelected ? 'chosen' : ''} ${photo.mediaType === 'video' ? 'video-card' : ''}`}
              onPointerDown={(event) => startLongPress(event, photo)}
              onPointerMove={moveLongPress}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button type="button" className="photo-open" onClick={() => clickMedia(photo, index)} aria-label={isSelected ? `Remove ${photo.filename} from selection` : `View ${photo.filename}`}>
                {imageUrl ? <img src={imageUrl} alt={photo.filename} loading="lazy" decoding="async" draggable={false} onDragStart={(event) => event.preventDefault()} /> : <div className="photo-placeholder"><ImageIcon size={25} /></div>}
                {photo.mediaType === 'photo' && <AlbumPhotoWatermark
                  studioName={branding?.studioName ?? ''}
                  studioLogo={branding?.studioLogo ?? null}
                  showOnAir={album.settings.onAirWatermarkEnabled !== false}
                  showStudio={album.settings.watermarkEnabled === true}
                  variant="grid"
                />}
                {isSelected && <span className="selection-tint" aria-hidden="true" />}
                {photo.mediaType === 'video' && <span className="video-indicator"><Video size={16} /></span>}
                {numberLabel && <span className="photo-number">{numberLabel}</span>}
              </button>
              {isSelected && (
                <span className="photo-check" aria-label="Selected">
                  {busyMedia === photo.mediaId ? <LoaderCircle className="spinner" size={16} /> : <Check size={18} strokeWidth={3} />}
                </span>
              )}
              {busyMedia === photo.mediaId && !isSelected && <span className="photo-busy"><LoaderCircle className="spinner" size={18} /></span>}
            </article>
          )
        })}
        {visibleMedia.length === 0 && (
          <div className="empty-state">
            <Images size={36} />
            <h2>{activeTab === 'selection' ? 'No selected photos yet' : search ? 'No matching photos' : 'No photos in this folder'}</h2>
            <p>{activeTab === 'selection' ? 'Your selected photos will appear here.' : 'Try another folder or search term.'}</p>
            {activeTab === 'selection' && <button className="text-action" onClick={() => openTab('gallery')} type="button">Browse gallery</button>}
          </div>
        )}
      </section>

      {activeTab === 'selection' && (
        <section className="selection-actions" aria-label="Selection actions">
          {confirmed && <p className="confirmed-message" role="status"><Check size={18} /> Your selection is confirmed and saved.</p>}
          <button type="button" className="clear-button" onClick={() => void clearSelection()} disabled={selectedPhotos.length === 0 || Boolean(busyMedia)}>
            <Trash2 size={18} /> Clear Selection
          </button>
          {downloadEnabled && <button type="button" className="confirm-button" onClick={() => void downloadSelectedPhotos()} disabled={selectedPhotos.length === 0 || Boolean(busyMedia)}>
            {busyMedia === '__download__' ? <LoaderCircle className="spinner" size={18} /> : <Download size={18} />}
            Download Selected ({selectedPhotos.length})
          </button>}
          <button type="button" className="confirm-button" onClick={() => void confirmSelection()} disabled={selectedPhotos.length === 0 || Boolean(busyMedia)}>
            {busyMedia === '__confirm__' ? <LoaderCircle className="spinner" size={18} /> : <Check size={19} />}
            Confirm Selection ({selectedPhotos.length})
          </button>
        </section>
      )}

      <footer className="gallery-footer"><Camera size={14} /> ON AIR · Wedding memories, beautifully preserved.</footer>

      <nav className="bottom-tabs" aria-label="Album navigation">
        <button type="button" className={activeTab === 'gallery' ? 'active' : ''} onClick={() => openTab('gallery')}>
          <Images size={20} /><span>Gallery</span>
        </button>
        <button type="button" className={activeTab === 'selection' ? 'active' : ''} onClick={() => openTab('selection')}>
          <Layers size={20} /><span>View Selection ({selectedPhotos.length})</span>
        </button>
      </nav>

      {currentPhoto && (
        <div
          className="photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setViewerIndex(null)
            if (event.key === 'ArrowLeft') changeViewer(-1)
            if (event.key === 'ArrowRight') changeViewer(1)
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(event) => event.preventDefault()}
          tabIndex={-1}
        >
          <div className="viewer-top">
            <span>{currentPhoto.filename}</span>
            <div className="viewer-top-actions">
              {downloadEnabled && currentPhoto.mediaType === 'photo' && <button type="button" onClick={() => void downloadCurrentPhoto()} aria-label="Download photo" title="Download photo" disabled={busyMedia === '__download_photo__'}>
                {busyMedia === '__download_photo__' ? <LoaderCircle className="spinner" /> : <Download />}
              </button>}
              <button type="button" onClick={() => setViewerIndex(null)} aria-label="Close photo viewer"><X /></button>
            </div>
          </div>
          <button className="viewer-arrow viewer-prev" type="button" onClick={() => changeViewer(-1)} aria-label="Previous photo"><ChevronLeft /></button>
          {currentPhoto.previewUrl && (currentPhoto.mediaType === 'video'
            ? <video className="viewer-image" src={currentPhoto.previewUrl} controls controlsList="nodownload" disablePictureInPicture autoPlay onContextMenu={(event) => event.preventDefault()} />
            : <div className="viewer-image-frame">
              <img className="viewer-image" src={currentPhoto.previewUrl} alt={currentPhoto.filename} draggable={false} />
              <AlbumPhotoWatermark
                studioName={branding?.studioName ?? ''}
                studioLogo={branding?.studioLogo ?? null}
                showOnAir={album.settings.onAirWatermarkEnabled !== false}
                showStudio={album.settings.watermarkEnabled === true}
                variant="viewer"
              />
            </div>)}
          <button className="viewer-arrow viewer-next" type="button" onClick={() => changeViewer(1)} aria-label="Next photo"><ChevronRight /></button>
          <div className="viewer-bottom">
            <span>{viewerIndex! + 1} / {visibleMedia.length}</span>
            {currentPhoto.mediaType === 'photo' && (
              <button type="button" className={selected.includes(currentPhoto.mediaId) ? 'viewer-selected' : ''} onClick={() => void togglePhoto(currentPhoto)} disabled={Boolean(busyMedia)}>
                {selected.includes(currentPhoto.mediaId) ? <Check size={17} /> : <Heart size={17} />}
                {selected.includes(currentPhoto.mediaId) ? 'Selected' : 'Select Photo'}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function SelectionSummary({ count, remaining }: { count: number; remaining: number | null }) {
  return (
    <section className={`selection-summary ${count > 0 ? 'has-selection' : ''}`} aria-live="polite">
      <div className="summary-count"><Layers size={23} /><strong>{count}</strong><span>Photos Selected</span></div>
      <span className="summary-remaining">{remaining === null ? 'No selection limit' : `${remaining} Remaining`}</span>
    </section>
  )
}

export default App
