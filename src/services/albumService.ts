import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

export type ValidateGuestAlbumLinkRequest = { token: string }
export type ValidateGuestAlbumLinkResponse = {
  albumId: string
  albumName: string
  expirationDate: string | null
}

export type CreateAlbumGuestSessionResponse = { sessionId: string }

export type GuestAlbumFolder = {
  folderId: string
  folderName: string
}

export type GuestAlbumMedia = {
  mediaId: string
  folderId: string
  mediaType: 'photo' | 'video'
  filename: string
  serialNumber: number | null
  previewUrl: string | null
  thumbnailUrl: string | null
  status: string
}

export type GuestAlbumResponse = {
  album: {
    albumName: string
    expirationDate: string | null
    settings: {
      downloadEnabled: boolean
      photoSelectionLimit: number
      watermarkEnabled?: boolean
      onAirWatermarkEnabled?: boolean
    }
    coverMediaId: string | null
    coverImageUrl: string | null
  }
  branding?: {
    studioName: string
    studioLogo: string | null
  } | null
  folders: GuestAlbumFolder[]
  media: GuestAlbumMedia[]
  nextCursor: string | null
}

export type GuestSessionRequest = {
  token: string
  guestSessionId: string
}

export type GuestAlbumRequest = {
  token: string
  guestSessionId: string
  cursor?: string
}

export const validateGuestAlbumLink = httpsCallable<
  ValidateGuestAlbumLinkRequest,
  ValidateGuestAlbumLinkResponse
>(functions, 'validateGuestAlbumLink')

export const createAlbumGuestSession = httpsCallable<
  ValidateGuestAlbumLinkRequest & { guestSessionId?: string },
  CreateAlbumGuestSessionResponse
>(functions, 'createAlbumGuestSession')

// getGuestAlbum currently uses the signed album token and optional page cursor.
export const getGuestAlbum = httpsCallable<
  GuestAlbumRequest,
  GuestAlbumResponse
>(functions, 'getGuestAlbum')

export const addGuestPhotoSelection = httpsCallable<
  GuestSessionRequest & { mediaId: string },
  { success: boolean }
>(functions, 'addGuestPhotoSelection')

export const removeGuestPhotoSelection = httpsCallable<
  GuestSessionRequest & { mediaId: string },
  { success: boolean }
>(functions, 'removeGuestPhotoSelection')

export const getGuestSelections = httpsCallable<
  GuestSessionRequest,
  { roundId: string; mediaIds: string[]; confirmed: boolean }
>(functions, 'getGuestSelections')

export const confirmGuestSelection = httpsCallable<
  GuestSessionRequest,
  { success: boolean; roundId: string }
>(functions, 'confirmGuestSelection')

export const getGuestDownloadPermission = httpsCallable<
  GuestSessionRequest,
  { downloadEnabled: boolean }
>(functions, 'getGuestDownloadPermission')

export const createGuestSelectedArchive = httpsCallable<
  GuestSessionRequest,
  { url: string; count: number }
>(functions, 'createGuestSelectedArchive')

export const createGuestAlbumArchive = httpsCallable<
  GuestSessionRequest & { folderId?: string },
  { url: string; count: number }
>(functions, 'createGuestAlbumArchive')
