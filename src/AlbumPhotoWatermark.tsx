import { Camera, Radio } from 'lucide-react'

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
  studioLogo,
  showOnAir,
  showStudio,
  variant,
}: AlbumPhotoWatermarkProps) {
  if (!showOnAir && !showStudio) return null

  return (
    <div className={`album-watermarks watermark-${variant}`} aria-hidden="true">
      {showOnAir && (
        <div className="watermark-on-air">
          <Radio className="watermark-on-air-icon" />
          <span className="watermark-on-air-copy">
            <b>ON AIR</b>
            <small>WEDDING LIVE</small>
          </span>
        </div>
      )}
      {showStudio && (studioName || studioLogo) && (
        <div className="watermark-studio">
          {studioLogo && <img className="watermark-studio-logo" src={studioLogo} alt="" />}
          <Camera className="watermark-camera" />
          {studioName && <span className="watermark-studio-name">{studioName}</span>}
          <span className="watermark-studio-subtitle">— &nbsp; STUDIO &nbsp; —</span>
        </div>
      )}
    </div>
  )
}
