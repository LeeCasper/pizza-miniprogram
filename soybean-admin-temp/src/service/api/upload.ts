import { localStg } from '@/utils/storage';
import { request } from '../request';

export interface FileItem {
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

export interface FileListResult {
  items: FileItem[];
  total: number;
}

/**
 * Upload a file via multipart/form-data.
 * Uses raw fetch because the flat-request is JSON-only.
 */
export async function fetchUploadImage(file: File) {
  const token = localStg.get('token');
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/v1/admin/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await response.json();
    if (json.code === 0) {
      return { data: json.data, error: null };
    }
    return { data: null, error: new Error(json.message || '上传失败') };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export function fetchFileList(page = 1, limit = 20) {
  return request<FileListResult>({
    url: '/files',
    params: { page, limit },
  });
}

export function fetchDeleteFile(filename: string) {
  return request<void>({
    url: `/files/${encodeURIComponent(filename)}`,
    method: 'delete',
  });
}
