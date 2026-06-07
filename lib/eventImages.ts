import { decode } from 'base64-arraybuffer'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './supabase'

export type SelectedEventImage = {
  uri: string
  base64?: string | null
  fileName?: string | null
  mimeType?: string | null
}

const getExtension = (fileName?: string | null, mimeType?: string | null) => {
  const fromName = fileName?.split('.').pop()?.toLowerCase()

  if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) {
    return fromName
  }

  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'

  return 'jpg'
}

export const uploadEventImage = async (
  image: SelectedEventImage,
  userId: string
) => {
  const mimeType = image.mimeType || 'image/jpeg'
  const extension = getExtension(image.fileName, mimeType)

  const base64 =
    image.base64 ||
    (await FileSystem.readAsStringAsync(image.uri, {
      encoding: FileSystem.EncodingType.Base64,
    }))

  const filePath = `${userId}/${Date.now()}.${extension}`

  const { error } = await supabase.storage
    .from('event-images')
    .upload(filePath, decode(base64), {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from('event-images').getPublicUrl(filePath)

  return data.publicUrl
}