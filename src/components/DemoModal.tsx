import React from 'react';
import { X } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
}

const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose, videoUrl }) => {
  if (!isOpen) return null;

  // Extract video ID from YouTube URL
  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeVideoId(videoUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Demo Video</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Video Content */}
        <div className="p-6">
          {embedUrl ? (
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                title="Demo Video"
                className="w-full h-full rounded-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-500 mb-2">Invalid YouTube URL</div>
                <div className="text-sm text-gray-400">Please provide a valid YouTube video link</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">What you'll see in this demo:</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• AI-powered player detection and tracking</li>
              <li>• Real-time performance analysis</li>
              <li>• Detailed movement patterns and statistics</li>
              <li>• Team formation and tactical insights</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoModal;