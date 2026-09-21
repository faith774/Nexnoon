import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../config/env';

let configured = false;

/** Lazily configures the Cloudinary SDK on first use. Returns false when not configured (demo mode). */
function ensureConfigured(): boolean {
  if (!ENV.CLOUDINARY_CLOUD_NAME || !ENV.CLOUDINARY_API_KEY || !ENV.CLOUDINARY_API_SECRET) {
    return false;
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
      api_key: ENV.CLOUDINARY_API_KEY,
      api_secret: ENV.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return true;
}

/**
 * `resource_type: 'auto'` lets Cloudinary classify PDFs/docs as delivered under
 * `image/upload/...` (so it can generate page thumbnails) - but Cloudinary
 * accounts created since mid-2024 default to blocking exactly that delivery
 * path for non-image formats (PDF, ZIP, etc.) as an XSS/malware mitigation,
 * which surfaces to the browser as a 401 "deny or ACL failure" on an otherwise
 * valid URL. Explicitly using 'raw' for anything that isn't a real
 * image/video sidesteps that restriction entirely - it's just an opaque file,
 * no format conversion assumed, so there's nothing for that policy to block.
 */
function resourceTypeFor(mimetype: string): 'image' | 'video' | 'raw' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
}

/**
 * Uploads a class-content file (material or assignment attachment) to Cloudinary.
 * Returns null when Cloudinary isn't configured (demo mode) so callers can fail
 * closed with a 503 instead of silently losing the upload.
 */
export async function uploadClassFile(
  buffer: Buffer,
  folder: string,
  originalName: string,
  mimetype: string
): Promise<{ url: string } | null> {
  if (!ensureConfigured()) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceTypeFor(mimetype),
        folder,
        // Keeps the delivered URL's filename recognizable (e.g. "lecture-notes_ab12cd.pdf")
        // instead of a fully random public_id - `unique_filename` still appends a short
        // suffix so two uploads with the same original name never collide.
        use_filename: true,
        unique_filename: true,
        filename_override: originalName,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url });
      }
    );
    stream.end(buffer);
  });
}
