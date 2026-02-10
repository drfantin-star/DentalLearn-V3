'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle, FileAudio, FileText, Film, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MediaUploadProps {
  bucket: string;
  path: string;
  accept: string;
  currentUrl: string;
  onUpload: (url: string) => void;
  label?: string;
}

function getMediaType(accept: string): 'audio' | 'video' | 'pdf' | 'image' | 'mixed' {
  if (accept.startsWith('audio')) return 'audio';
  if (accept.startsWith('video')) return 'video';
  if (accept.startsWith('image') || accept.startsWith('.png') || accept.startsWith('.jpg') || accept.startsWith('.jpeg')) return 'image';
  if (accept.includes('.pdf') && (accept.includes('.png') || accept.includes('.jpg') || accept.includes('.jpeg'))) return 'mixed';
  if (accept.includes('.pdf')) return 'pdf';
  return 'pdf';
}

function getMediaTypeFromUrl(url: string): 'image' | 'pdf' | 'unknown' {
  if (url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i)) return 'image';
  if (url.match(/\.pdf(\?|$)/i)) return 'pdf';
  return 'unknown';
}

function getAcceptLabel(accept: string): string {
  const type = getMediaType(accept);
  if (type === 'audio') return 'MP3, WAV, M4A';
  if (type === 'video') return 'MP4, WebM';
  if (type === 'image') return 'PNG, JPG, JPEG';
  if (type === 'mixed') return 'PDF, PNG, JPG';
  return 'PDF';
}

function getIcon(accept: string) {
  const type = getMediaType(accept);
  if (type === 'audio') return FileAudio;
  if (type === 'video') return Film;
  if (type === 'image') return ImageIcon;
  if (type === 'mixed') return FileText;
  return FileText;
}

export default function MediaUpload({
  bucket,
  path,
  accept,
  currentUrl,
  onUpload,
  label
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaType = getMediaType(accept);
  const Icon = getIcon(accept);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Validate file size (50MB max)
      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error('Fichier trop volumineux. Taille maximale: 50MB');
      }

      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const supabase = createClient();

      // Generate unique file path
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const safeName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .substring(0, 50);
      const cleanPath = path.replace(/\/+$/, '');
      const fileName = `${cleanPath}/${safeName}-${Date.now()}.${fileExt}`;

      // Upload directly to Supabase Storage (bypasses Vercel 4.5MB limit)
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      clearInterval(progressInterval);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setUploadProgress(100);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      onUpload(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, onUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleRemove = async () => {
    if (currentUrl) {
      try {
        const supabase = createClient();
        // Extract file path from the public URL
        const urlParts = currentUrl.split(`/storage/v1/object/public/${bucket}/`);
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from(bucket).remove([filePath]);
        }
      } catch (err) {
        console.error('Erreur suppression:', err);
      }
    }
    onUpload('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Derive file name from URL for display
  const fileName = currentUrl ? decodeURIComponent(currentUrl.split('/').pop() || '') : '';

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Preview zone when file exists */}
      {currentUrl ? (
        <div className="rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
          {/* Audio preview */}
          {mediaType === 'audio' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileAudio className="w-5 h-5 text-[#2D1B96]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <audio controls className="w-full" preload="metadata">
                <source src={currentUrl} />
                Votre navigateur ne supporte pas la lecture audio.
              </audio>
            </div>
          )}

          {/* Video preview */}
          {mediaType === 'video' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Film className="w-5 h-5 text-[#2D1B96]" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <video controls className="w-full rounded-lg" preload="metadata">
                <source src={currentUrl} />
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            </div>
          )}

          {/* PDF preview */}
          {(mediaType === 'pdf' || (mediaType === 'mixed' && getMediaTypeFromUrl(currentUrl) === 'pdf')) && (
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <FileText className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2D1B96] hover:underline"
                  >
                    Voir le PDF
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Image preview */}
          {(mediaType === 'image' || (mediaType === 'mixed' && getMediaTypeFromUrl(currentUrl) === 'image')) && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <img src={currentUrl} alt="Aperçu" className="max-w-full max-h-32 rounded-lg" />
            </div>
          )}

          {/* Mixed type - unknown file extension fallback */}
          {mediaType === 'mixed' && getMediaTypeFromUrl(currentUrl) === 'unknown' && (
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{fileName}</p>
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#2D1B96] hover:underline"
                  >
                    Voir le fichier
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Drop zone when no file */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-[#2D1B96] bg-[#2D1B96]/5'
              : 'border-gray-300 hover:border-[#2D1B96] hover:bg-gray-50'
            }
            ${isUploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#2D1B96] animate-spin" />
              <span className="text-sm text-gray-600">Upload en cours...</span>
              {/* Progress bar */}
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#2D1B96] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{uploadProgress}%</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-full ${isDragging ? 'bg-[#2D1B96]/10' : 'bg-gray-100'}`}>
                {isDragging ? (
                  <Icon className="w-6 h-6 text-[#2D1B96]" />
                ) : (
                  <Upload className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? 'Deposez le fichier ici' : 'Glissez un fichier ou cliquez'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {getAcceptLabel(accept)} - Max 50MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
