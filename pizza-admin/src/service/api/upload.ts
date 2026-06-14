import request from '../request'

export interface UploadResult {
  url: string
  filename: string
  size: number
  originalName: string
}

export interface FileItem {
  name: string
  url: string
  size: number
  lastModified: string
}

export interface FileListResult {
  items: FileItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const uploadApi = {
  upload(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request
      .post<{ code: number; data: UploadResult; message: string }>('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      .then(r => r.data)
  },

  listFiles(page = 1, limit = 20) {
    return request
      .get<{ code: number; data: FileListResult }>('/files', { params: { page, limit } })
      .then(r => r.data)
  },

  deleteFile(filename: string) {
    return request
      .delete<{ code: number; message: string }>(`/files/${encodeURIComponent(filename)}`)
      .then(r => r.data)
  },
}
