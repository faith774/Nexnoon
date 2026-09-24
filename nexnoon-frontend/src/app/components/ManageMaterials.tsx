import { useRef, useState } from 'react';
import { Loader2, Upload, Link2, FileText } from 'lucide-react';
import { apiClient, getErrorMessage, uploadFile } from '@/lib/api';
import FileAttachment from './FileAttachment';
import { formatMaterialEntry, isValidMaterialUrl } from '@/lib/materials';

type AddMode = 'upload' | 'link';

/** Instructor materials: Cloudinary upload, Drive/external links, and previews. */
export default function ManageMaterials({
  classId,
  materials,
  onChanged,
}: {
  classId: string;
  materials: string[];
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<AddMode>('upload');
  const [uploading, setUploading] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const persist = async (next: string[]) => {
    await apiClient.patch(`/classes/${classId}`, { materials: next });
    onChanged();
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadFile(`/classes/${classId}/uploads`, file);
      // Prefer original filename as a readable title when Cloudinary URLs are opaque
      const entry = formatMaterialEntry(url, file.name);
      await persist([...materials, entry]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await handleFile(file);
  };

  const handleAddLink = async () => {
    if (!isValidMaterialUrl(linkUrl)) {
      setError('Enter a valid https:// link (Google Drive, Docs, Dropbox, etc.).');
      return;
    }
    setSavingLink(true);
    setError(null);
    try {
      const entry = formatMaterialEntry(linkUrl.trim(), linkTitle);
      await persist([...materials, entry]);
      setLinkUrl('');
      setLinkTitle('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingLink(false);
    }
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    setError(null);
    try {
      await persist(materials.filter((_, i) => i !== index));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div>
      <div className="flex gap-1 mb-4 border border-[#e4dfd6] bg-[#faf8f5] p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm transition-colors ${
            mode === 'upload' ? 'bg-[#14110e] text-white' : 'text-[#3d3933] hover:bg-white'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm transition-colors ${
            mode === 'link' ? 'bg-[#14110e] text-white' : 'text-[#3d3933] hover:bg-white'
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          Add Drive link
        </button>
      </div>

      {mode === 'upload' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`border border-dashed bg-[#faf8f5] p-8 text-center mb-6 transition-colors ${
            dragOver ? 'border-[#c45c26] bg-[#fff8f0]' : 'border-[#d5cfc4] hover:border-[#c45c26]/50'
          } ${uploading ? 'opacity-70' : ''}`}
        >
          <FileText className="h-8 w-8 text-[#d5cfc4] mx-auto mb-3" />
          <p className="text-sm text-[#3d3933] mb-1">
            {dragOver ? 'Drop to upload' : 'Upload slides, PDFs, images, docs, or video'}
          </p>
          <p className="text-xs text-[#8a847a] mb-4">
            Stored on Cloudinary · PDF, images, Word, PowerPoint, Excel, MP4 · up to 80MB
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 bg-[#14110e] text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Choose file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.txt,.zip,image/*,application/pdf,video/*"
            onChange={handleFileSelected}
          />
        </div>
      ) : (
        <div className="border border-[#e4dfd6] bg-[#faf8f5] p-5 mb-6 space-y-3">
          <p className="text-sm text-[#3d3933]">
            Paste a Google Drive, Docs, Sheets, Slides, Dropbox, or any public https link.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#6b655c]">Title (optional)</span>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Week 1 slides"
              className="border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#14110e]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#6b655c]">Link *</span>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
              className="border border-[#e4dfd6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#14110e]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddLink();
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleAddLink()}
            disabled={savingLink || !linkUrl.trim()}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 bg-[#c45c26] text-white hover:bg-[#a84c1e] disabled:opacity-50"
          >
            {savingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {savingLink ? 'Adding…' : 'Add link'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {materials.length === 0 ? (
        <p className="text-sm text-[#6b655c] text-center py-6 border border-dashed border-[#ddd6ca]">
          No materials yet. Upload a file or add a Drive link.
        </p>
      ) : (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#6b655c] mb-3">
            {materials.length} item{materials.length === 1 ? '' : 's'}
          </p>
          <div className="space-y-2">
            {materials.map((item, index) => (
              <FileAttachment
                key={`${index}-${item.slice(0, 40)}`}
                url={item}
                onRemove={removingIndex === index ? undefined : () => handleRemove(index)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
