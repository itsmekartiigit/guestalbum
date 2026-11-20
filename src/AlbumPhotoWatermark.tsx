import { Radio } from 'lucide-react'

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
  showOnAir,
  showStudio,
  variant,
}: AlbumPhotoWatermarkProps) {
  if (!showOnAir && (!showStudio || !studioName)) return null

  return (
    <div className={`album-watermarks watermark-${variant}`} aria-hidden="true">
      {showOnAir && <div className="watermark-on-air"><Radio className="watermark-on-air-icon" /><span className="watermark-on-air-copy"><b>ON AIR</b><small>WEDDING LIVE</small></span></div>}
      {showStudio && studioName && <div className="watermark-studio"><span className="watermark-studio-name">{studioName}</span></div>}
    </div>
  )
}

