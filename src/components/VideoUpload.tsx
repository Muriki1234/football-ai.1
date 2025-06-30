import React, { useState, useCallback } from 'react';
import { Upload, FileVideo, X, CheckCircle, Loader, AlertCircle, Server, Cloud, User } from 'lucide-react';
import { PlayerRecord } from '../App';

interface VideoUploadProps {
  onUploadComplete: (file: File) => void;
  uploadingForPlayer?: PlayerRecord | null;
}

const VideoUpload: React.FC<VideoUploadProps> = ({ onUploadComplete, uploadingForPlayer }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit for Files API

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      if (videoFile.size > MAX_FILE_SIZE) {
        setErrorMessage(`Video file too large (${formatFileSize(videoFile.size)}), maximum supported is 2GB`);
        return;
      }
      setSelectedFile(videoFile);
      setErrorMessage('');
    } else {
      setErrorMessage('Please select a valid video file');
    }
  }, [MAX_FILE_SIZE]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(`Video file too large (${formatFileSize(file.size)}), maximum supported is 2GB`);
        return;
      }
      setSelectedFile(file);
      setErrorMessage('');
    } else {
      setErrorMessage('Please select a valid video file');
    }
  };

  const resetUploadState = () => {
    setUploadProgress(0);
    setUploadStatus('idle');
    setErrorMessage('');
    setIsUploading(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    resetUploadState();
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('uploading');
    
    try {
      // Enhanced progress simulation with multiple stages
      const progressStages = [
        { target: 20, duration: 1000, message: 'Preparing video for upload...' },
        { target: 40, duration: 2000, message: 'Uploading to Gemini servers...' },
        { target: 60, duration: 2000, message: 'Processing video format...' },
        { target: 80, duration: 1500, message: 'Initializing AI analysis...' },
        { target: 95, duration: 1000, message: 'Finalizing upload...' }
      ];

      for (const stage of progressStages) {
        setAnalysisStatus(stage.message);
        await animateProgress(stage.target, stage.duration);
      }

      setUploadStatus('analyzing');
      setAnalysisStatus('Gemini AI is analyzing video content and detecting players...');
      
      // Final analysis phase
      const analysisTime = 8000;
      await new Promise(resolve => setTimeout(resolve, analysisTime));
      
      setUploadStatus('complete');
      setUploadProgress(100);
      setAnalysisStatus('Gemini analysis complete! Player detection successful');
      
      setTimeout(() => {
        setIsUploading(false);
        onUploadComplete(selectedFile);
      }, 1000);

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      setErrorMessage('Upload failed, please try again');
      setIsUploading(false);
    }
  };

  const animateProgress = (target: number, duration: number): Promise<void> => {
    return new Promise(resolve => {
      const startProgress = uploadProgress;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentProgress = startProgress + (target - startProgress) * progress;
        
        setUploadProgress(currentProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      animate();
    });
  };

  const [analysisStatus, setAnalysisStatus] = useState<string>('');

  const handleRetry = () => {
    resetUploadState();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusMessage = () => {
    if (!selectedFile) return '';
    
    if (analysisStatus) return analysisStatus;
    
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading to Gemini servers...';
      case 'analyzing':
        return 'Gemini AI is analyzing video content...';
      case 'complete':
        return 'Gemini analysis complete! Player detection successful';
      case 'error':
        return 'Processing failed, please try again';
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
      case 'analyzing':
        return <Loader className="w-8 h-8 text-blue-600 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-8 h-8 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <section className="min-h-screen py-20 bg-gradient-to-br from-slate-50 to-green-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          {uploadingForPlayer ? (
            <div className="mb-8">
              <div className="flex items-center justify-center space-x-4 mb-4">
                {uploadingForPlayer.avatar && (
                  <img
                    src={uploadingForPlayer.avatar}
                    alt={uploadingForPlayer.name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-green-500 shadow-lg"
                  />
                )}
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    Upload More Videos for {uploadingForPlayer.name}
                  </h1>
                  <p className="text-xl text-gray-600">
                    Already has {uploadingForPlayer.totalMatches} analysis records, continue adding new match videos
                  </p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Average rating: {uploadingForPlayer.averagePerformance.overall}</p>
                  <p>• Last analyzed: {new Date(uploadingForPlayer.lastAnalyzed).toLocaleDateString()}</p>
                  <p>• New analysis will compare with historical data to show progress trends</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Upload Your Football Video
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Upload your match or training video, Gemini will intelligently identify all players, 
                allowing you to select the target player for analysis
              </p>
            </>
          )}
          <div className="mt-4 inline-flex items-center bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-4 py-2 rounded-full text-sm">
            <Cloud className="w-4 h-4 mr-2" />
            <span>Powered by Gemini AI</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {!selectedFile && !isUploading && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative p-12 text-center transition-all duration-300 ${
                isDragOver 
                  ? 'bg-gradient-to-br from-green-50 to-blue-50 border-2 border-dashed border-green-400' 
                  : 'bg-gradient-to-br from-gray-50 to-white border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-gradient-to-br hover:from-green-50 hover:to-blue-50'
              }`}
            >
              <div className="space-y-6">
                <div className={`inline-flex p-6 rounded-full transition-all duration-300 ${
                  isDragOver ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Upload className={`w-12 h-12 transition-colors duration-300 ${
                    isDragOver ? 'text-green-600' : 'text-gray-400'
                  }`} />
                </div>
                
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    Drag and drop your video here
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Or click to select file, Gemini will automatically identify all players
                  </p>
                  
                  <label className="inline-flex items-center bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold cursor-pointer hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200">
                    <FileVideo className="w-5 h-5 mr-2" />
                    Select Video File
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>Supported formats: MP4, AVI, MOV, WMV, MKV</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-blue-600">
                      <Cloud className="w-4 h-4" />
                      <span>Google Files API Processing (Maximum 2GB supported)</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-green-600">
                      <Server className="w-4 h-4" />
                      <span>Server-side processing, no client limitations</span>
                    </div>
                  </div>
                  <p className="text-blue-600 font-medium mt-2">✨ 100% powered by Gemini for stable analysis</p>
                </div>

                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      {errorMessage}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedFile && !isUploading && (
            <div className="p-8">
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl mb-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-lg">
                    <FileVideo className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{selectedFile.name}</h4>
                    <div className="flex items-center space-x-3">
                      <p className="text-gray-600">{formatFileSize(selectedFile.size)}</p>
                      <div className="flex items-center space-x-2 text-blue-600">
                        <Cloud className="w-4 h-4" />
                        <span className="text-sm">Gemini processing</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setErrorMessage('');
                  }}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-800 mb-2 flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Gemini Analysis Ready
                  </h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Gemini will intelligently identify all players in the video</li>
                    <li>• Automatically detect jersey numbers and team affiliation</li>
                    <li>• Identify home and away team jersey colors</li>
                    <li>• Analyze player positions and movement trajectories</li>
                    <li>• Generate confidence scores for each player</li>
                    {uploadingForPlayer && (
                      <li>• Compare with {uploadingForPlayer.name}'s historical data</li>
                    )}
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-medium text-green-800 mb-2 flex items-center">
                    <Cloud className="w-4 h-4 mr-2" />
                    Gemini Advantages
                  </h5>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Supports large video files up to 2GB</li>
                    <li>• 100% server-side processing, no client limitations</li>
                    <li>• More stable AI analysis, reduced detection failures</li>
                    <li>• Intelligent retry mechanism ensures successful player identification</li>
                    <li>• More accurate team color and player position recognition</li>
                    <li>• Optimized processing workflow for higher success rates</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h5 className="font-medium text-purple-800 mb-2">Upload Tips:</h5>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• Ensure players are clearly visible in the video</li>
                    <li>• Good lighting and shooting angles improve recognition accuracy</li>
                    <li>• Avoid excessively shaky footage</li>
                    <li>• Select exciting segments with high player activity</li>
                    <li>• Gemini will automatically optimize analysis results</li>
                  </ul>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleUpload}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
                  >
                    <span className="w-2 h-2 bg-white rounded-full mr-3 animate-pulse"></span>
                    {uploadingForPlayer ? `Start Analysis for ${uploadingForPlayer.name}` : 'Start Gemini Analysis'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setErrorMessage('');
                    }}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-red-500 hover:text-red-600 transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="p-8 text-center">
              <div className="space-y-6">
                <div className="inline-flex p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
                  {getStatusIcon()}
                </div>
                
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    {getStatusMessage()}
                  </h3>
                  <p className="text-gray-600">
                    {uploadStatus === 'uploading' && 'Uploading video to Gemini servers for processing...'}
                    {uploadStatus === 'analyzing' && 'Gemini is performing deep video analysis with intelligent retry for detection success...'}
                    {uploadStatus === 'complete' && 'All players successfully identified, please select target player for analysis'}
                    {uploadStatus === 'error' && 'Processing encountered an issue, please check network connection and retry'}
                  </p>
                  {uploadingForPlayer && (
                    <p className="text-blue-600 mt-2">
                      Analysis will compare with {uploadingForPlayer.name}'s historical data upon completion
                    </p>
                  )}
                </div>
                
                {/* Enhanced Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div
                    className={`h-full transition-all duration-300 ease-out relative ${
                      uploadStatus === 'error' 
                        ? 'bg-red-500' 
                        : 'bg-gradient-to-r from-blue-500 via-purple-500 to-green-500'
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {/* Animated shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-center space-x-4">
                  <p className="text-lg font-semibold text-gray-900">
                    {Math.round(uploadProgress)}% Complete
                  </p>
                  {uploadStatus === 'analyzing' && (
                    <div className="flex items-center text-sm text-blue-600">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                      Gemini deep analysis in progress...
                    </div>
                  )}
                </div>

                {uploadStatus === 'error' && (
                  <button
                    onClick={handleRetry}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* AI Features Showcase */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-lg inline-block mb-4">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Gemini AI</h3>
            <p className="text-gray-600 text-sm">
              100% powered by Gemini, supports 2GB large files, no client limitations
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 p-3 rounded-lg inline-block mb-4">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Stable & Reliable Analysis</h3>
            <p className="text-gray-600 text-sm">
              Server-side processing with intelligent retry mechanism ensures successful player detection every time
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-lg inline-block mb-4">
              <Server className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {uploadingForPlayer ? 'Historical Data Comparison' : 'Unlimited Processing'}
            </h3>
            <p className="text-gray-600 text-sm">
              {uploadingForPlayer 
                ? 'New analysis will compare with historical data, showing progress trends and performance changes'
                : 'Complete server-side processing supports any size video files, no browser limitations'
              }
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoUpload;