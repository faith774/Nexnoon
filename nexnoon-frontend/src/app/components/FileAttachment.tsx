import { Download, Eye, File as FileIcon, FileImage, FileText, FileVideo, X } from 'lucide-react';

function fileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return decodeURIComponent(pathname.split('/').pop() || url);
  } catch {
    return url;
  }
}

function fileExt(name: string): string {
  const match = name.match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function iconFor(ext: string) {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
  if (['mp4', 'mov', 'webm'].includes(ext)) return FileVideo;
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'zip'].includes(ext)) return FileText;
  return FileIcon;
}

/** Forces a Cloudinary-hosted file to download instead of opening inline, via its fl_attachment delivery flag. */
function downloadUrl(url: string): string {
  return url.includes('res.cloudinary.com/') ? url.replace('/upload/', '/upload/fl_attachment/') : url;
}

/** A clean, consistent "file you can view or download" row - used for materials and assignment attachments alike. */
export default function FileAttachment({ url, onRemove }: { url: string; onRemove?: () => void }) {
  const name = fileNameFromUrl(url);
  const Icon = iconFor(fileExt(name));

  return (
    <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
          <Icon className="h-4 w-4 text-gray-500" />
        </span>
        <span className="text-sm font-medium text-gray-800 truncate" title={name}>{name}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="View"
          aria-label="View file"
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Eye className="h-4 w-4" />
        </a>
        <a
          href={downloadUrl(url)}
          download
          title="Download"
          aria-label="Download file"
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Download className="h-4 w-4" />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove"
            aria-label="Remove file"
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
