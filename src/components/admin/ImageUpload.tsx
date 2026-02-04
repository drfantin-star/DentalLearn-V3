'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  sequenceId?: string;
  questionId?: string;
  required?: boolean;
  label?: string;
}

export default function ImageUpload({
  value,
  onChange,
  sequenceId,
  questionId,
  required = false,
  label = 'Image'
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (sequenceId) formData.append('sequenceId', sequenceId);
      if (questionId) formData.append('questionId', questionId);

      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'upload');
      }

      onChange(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [sequenceId, questionId, onChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleRemove = () => {
    onChange('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {label} {required ? '(obligatoire)' : '(optionnel)'}
        </label>
        {!value && (
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-[#2D1B96] hover:underline"
          >
            {showUrlInput ? 'Annuler' : 'Ou coller une URL'}
          </button>
        )}
      </div>

      {/* Input URL externe */}
      {showUrlInput && !value && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://exemple.com/image.jpg"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#2D1B96] focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            className="px-4 py-2 bg-[#2D1B96] text-white rounded-lg text-sm hover:bg-[#231575] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Valider
          </button>
        </div>
      )}

      {/* Zone de drop / Preview */}
      {value ? (
        <div className="relative rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
          <img
            src={value}
            alt="Aperçu"
            className="w-full h-48 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12">Erreur image</text></svg>';
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 truncate">
            {value}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-[#2D1B96] animate-spin" />
              <span className="text-sm text-gray-600">Upload en cours...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={`p-3 rounded-full ${isDragging ? 'bg-[#2D1B96]/10' : 'bg-gray-100'}`}>
                {isDragging ? (
                  <ImageIcon className="w-8 h-8 text-[#2D1B96]" />
                ) : (
                  <Upload className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? 'Déposez l\'image ici' : 'Glissez une image ou cliquez'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG, WebP ou GIF - Max 5MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
