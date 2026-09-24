import { useState } from 'react';
import {
  Download,
  Eye,
  ExternalLink,
  File as FileIcon,
  FileImage,
  FileText,
  FileVideo,
  Link2,
  StickyNote,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { downloadUrl, parseMaterial, type MaterialKind } from '@/lib/materials';

function iconFor(kind: MaterialKind) {
  if (kind === 'image') return FileImage;
  if (kind === 'video') return FileVideo;
  if (kind === 'pdf' || kind === 'office') return FileText;
  if (kind === 'drive' || kind === 'link') return Link2;
  if (kind === 'note') return StickyNote;
  return FileIcon;
}

function kindLabel(kind: MaterialKind) {
  switch (kind) {
    case 'image':
      return 'Image';
    case 'pdf':
      return 'PDF';
    case 'video':
      return 'Video';
    case 'office':
      return 'Document';
    case 'drive':
      return 'Drive link';
    case 'link':
      return 'Link';
    case 'note':
      return 'Note';
    default:
      return 'File';
  }
}

/** A clean, consistent material/file row with in-app preview for images, PDFs, docs, and Drive. */
export default function FileAttachment({
  url,
  onRemove,
  compact,
}: {
  url: string;
  onRemove?: () => void;
  compact?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const material = parseMaterial(url);
  const Icon = iconFor(material.kind);

  const openPreview = () => {
    if (material.kind === 'note' || material.canPreview) {
      setPreviewOpen(true);
      return;
    }
    if (material.url) window.open(material.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 bg-[#faf8f5] border border-[#e4dfd6] ${
          compact ? 'px-3 py-2.5' : 'px-3.5 py-3'
        }`}
      >
        <button
          type="button"
          onClick={openPreview}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
        >
          {material.kind === 'image' && material.previewUrl ? (
            <span className="flex-shrink-0 w-11 h-11 bg-white border border-[#e4dfd6] overflow-hidden">
              <img
                src={material.previewUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </span>
          ) : (
            <span className="flex-shrink-0 w-11 h-11 bg-white border border-[#e4dfd6] flex items-center justify-center">
              <Icon className="h-4 w-4 text-[#6b655c]" />
            </span>
          )}
          <span className="min-w-0">
            <span
              className="block text-sm font-medium text-[#14110e] truncate group-hover:underline"
              title={material.title}
            >
              {material.title}
            </span>
            <span className="block text-[11px] text-[#8a847a] mt-0.5">
              {kindLabel(material.kind)}
              {material.hostLabel ? ` · ${material.hostLabel}` : ''}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {(material.canPreview || material.kind === 'note') && (
            <button
              type="button"
              onClick={openPreview}
              title="Preview"
              aria-label="Preview"
              className="p-1.5 text-[#6b655c] hover:text-[#14110e] hover:bg-[#f0ebe3] transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
          {material.url && (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open"
              aria-label="Open in new tab"
              className="p-1.5 text-[#6b655c] hover:text-[#14110e] hover:bg-[#f0ebe3] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {material.canDownload && material.url && (
            <a
              href={downloadUrl(material.url)}
              download
              title="Download"
              aria-label="Download file"
              className="p-1.5 text-[#6b655c] hover:text-[#14110e] hover:bg-[#f0ebe3] transition-colors"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove"
              aria-label="Remove"
              className="p-1.5 text-[#8a847a] hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border-[#e4dfd6] rounded-none p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-[#eee9e0] shrink-0">
            <DialogTitle className="font-serif text-lg text-[#14110e] pr-8 truncate">
              {material.title}
            </DialogTitle>
            <p className="text-xs text-[#8a847a]">
              {kindLabel(material.kind)}
              {material.hostLabel ? ` · ${material.hostLabel}` : ''}
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto bg-[#f6f4f0] p-4">
            {material.kind === 'note' && (
              <p className="whitespace-pre-wrap text-sm text-[#3d3933] leading-relaxed bg-white border border-[#e4dfd6] p-5">
                {material.title}
              </p>
            )}

            {material.kind === 'image' && material.previewUrl && (
              <img
                src={material.previewUrl}
                alt={material.title}
                className="max-w-full max-h-[70vh] mx-auto object-contain bg-white border border-[#e4dfd6]"
              />
            )}

            {material.kind === 'video' && material.previewUrl && (
              <video
                src={material.previewUrl}
                controls
                className="w-full max-h-[70vh] bg-black"
              />
            )}

            {(material.kind === 'pdf' || material.kind === 'office' || material.kind === 'drive') &&
              material.previewUrl && (
                <iframe
                  title={material.title}
                  src={material.previewUrl}
                  className="w-full h-[70vh] bg-white border border-[#e4dfd6]"
                  allow="autoplay"
                />
              )}

            {material.kind === 'link' && material.url && (
              <div className="bg-white border border-[#e4dfd6] p-8 text-center">
                <Link2 className="h-8 w-8 text-[#d5cfc4] mx-auto mb-3" />
                <p className="text-sm text-[#3d3933] mb-4">This link opens in a new tab.</p>
                <a
                  href={material.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#14110e] text-white px-4 py-2.5 text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open link
                </a>
              </div>
            )}

            {!material.canPreview && material.kind !== 'note' && material.kind !== 'link' && (
              <div className="bg-white border border-[#e4dfd6] p-8 text-center text-sm text-[#6b655c]">
                Preview is not available for this file.
                {material.url && (
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-3 underline text-[#c45c26]"
                  >
                    Open instead
                  </a>
                )}
              </div>
            )}
          </div>

          {material.url && (
            <div className="px-5 py-3 border-t border-[#eee9e0] flex flex-wrap gap-3 shrink-0 bg-white">
              <a
                href={material.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#3d3933] underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open original
              </a>
              {material.canDownload && (
                <a
                  href={downloadUrl(material.url)}
                  download
                  className="inline-flex items-center gap-1.5 text-sm text-[#3d3933] underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
