import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { apiClient, getErrorMessage, uploadFile } from '@/lib/api';
import FileAttachment from './FileAttachment';

/** Instructor-only material manager: upload a file (stored via Cloudinary) or remove an existing one. */
export default function ManageMaterials({ classId, materials, onChanged }: {
  classId: string;
  materials: string[];
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadFile(`/classes/${classId}/uploads`, file);
      await apiClient.patch(`/classes/${classId}`, { materials: [...materials, url] });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (index: number) => {
    setRemovingIndex(index);
    setError(null);
    try {
      await apiClient.patch(`/classes/${classId}`, { materials: materials.filter((_, i) => i !== index) });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div className="mb-6 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-bold text-gray-900">Course materials</h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Upload material'}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {materials.length === 0 ? (
        <p className="text-sm text-gray-500">No materials uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {materials.map((item, index) => (
            <FileAttachment
              key={index}
              url={item}
              onRemove={removingIndex === index ? undefined : () => handleRemove(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
