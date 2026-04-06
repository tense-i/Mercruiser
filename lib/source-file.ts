export const SUPPORTED_SOURCE_FILE_TYPES = ['.txt', '.md'] as const;

export function stripSourceFileExtension(filename: string) {
  return filename.replace(/\.(txt|md)$/i, '');
}

export function isSupportedSourceFile(file: File) {
  return /\.(txt|md)$/i.test(file.name);
}

export async function readSourceFile(file: File) {
  if (!isSupportedSourceFile(file)) {
    throw new Error('仅支持上传 .txt 或 .md 原文文件');
  }

  const content = (await file.text()).trim();
  if (!content) {
    throw new Error('上传文件内容为空');
  }

  return {
    fileName: file.name,
    title: stripSourceFileExtension(file.name).trim() || '未命名原文',
    content,
  };
}
