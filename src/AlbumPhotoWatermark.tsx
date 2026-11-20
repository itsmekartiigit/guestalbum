type AlbumPhotoWatermarkProps = {
  studioName: string
  studioLogo: string | null
  showOnAir: boolean
  showStudio: boolean
  variant: 'grid' | 'viewer'
  position?: 'default'
}

export default function AlbumPhotoWatermark({
  studioName,
  showStudio,
  variant,
}: AlbumPhotoWatermarkProps) {
  if (!showStudio || !studioName) return null

  return (
    <div className={`album-watermarks watermark-${variant}`} aria-hidden="true">
      <div className="watermark-studio">
        <span className="watermark-studio-name">{studioName}</span>
      </div>
    </div>
  )
}
