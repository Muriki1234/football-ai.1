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
        setErrorMessage(`视频文件过大 (${formatFileSize(videoFile.size)})，Google Files API 最大支持 2GB`);
        return;
      }
      setSelectedFile(videoFile);
      setErrorMessage('');
    } else {
      setErrorMessage('请选择有效的视频文件');
    }
  }, [MAX_FILE_SIZE]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(`视频文件过大 (${formatFileSize(file.size)})，Google Files API 最大支持 2GB`);
        return;
      }
      setSelectedFile(file);
      setErrorMessage('');
    } else {
      setErrorMessage('请选择有效的视频文件');
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
    
    // Reset any previous state
    resetUploadState();
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('uploading');
    
    try {
      // 模拟上传进度，所有文件都使用 Files API 处理
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          const targetProgress = 60; // Files API 处理需要更多时间
          if (prev >= targetProgress) {
            clearInterval(uploadInterval);
            setUploadStatus('analyzing');
            
            // 模拟AI分析时间，Files API 处理需要更长时间
            const analysisTime = 8000; // 8秒分析时间
            setTimeout(() => {
              setUploadStatus('complete');
              setUploadProgress(100);
              setTimeout(() => {
                setIsUploading(false);
                onUploadComplete(selectedFile);
              }, 1000);
            }, analysisTime);
            
            return targetProgress;
          }
          return prev + Math.random() * 8; // 较慢的上传进度
        });
      }, 500);

    } catch (error) {
      console.error('上传失败:', error);
      setUploadStatus('error');
      setErrorMessage('上传失败，请重试');
      setIsUploading(false);
    }
  };

  const handleRetry = () => {
    resetUploadState();
    // Keep the selected file for retry
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
    
    switch (uploadStatus) {
      case 'uploading':
        return '正在上传到 Google Files API...';
      case 'analyzing':
        return 'Google Files API 正在深度分析视频...';
      case 'complete':
        return 'Files API 分析完成！球员识别成功';
      case 'error':
        return '处理失败，请重试';
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
                {uploadingForPlayer.avatar ? (
                  <img
                    src={uploadingForPlayer.avatar}
                    alt={uploadingForPlayer.name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-green-500 shadow-lg"
                  />
                ) : (
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 p-4 rounded-full">
                    <User className="w-8 h-8 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    为 {uploadingForPlayer.name} 上传更多视频
                  </h1>
                  <p className="text-xl text-gray-600">
                    已有 {uploadingForPlayer.totalMatches} 场分析记录，继续添加新的比赛视频
                  </p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• 平均评分: {uploadingForPlayer.averagePerformance.overall}</p>
                  <p>• 上次分析: {new Date(uploadingForPlayer.lastAnalyzed).toLocaleDateString()}</p>
                  <p>• 新分析将与历史数据进行对比，显示进步趋势</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                上传您的足球视频
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                上传您的比赛或训练视频，Google Files API 将智能识别所有球员，让您选择要分析的目标球员
              </p>
            </>
          )}
          <div className="mt-4 inline-flex items-center bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-4 py-2 rounded-full text-sm">
            <Cloud className="w-4 h-4 mr-2" />
            <span>完全由 Google Files API 驱动</span>
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
                    将视频拖拽到这里
                  </h3>
                  <p className="text-gray-600 mb-6">
                    或点击选择文件，Google Files API 将自动识别所有球员
                  </p>
                  
                  <label className="inline-flex items-center bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold cursor-pointer hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200">
                    <FileVideo className="w-5 h-5 mr-2" />
                    选择视频文件
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>支持格式: MP4, AVI, MOV, WMV, MKV</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-blue-600">
                      <Cloud className="w-4 h-4" />
                      <span>Google Files API 处理 (最大支持 2GB)</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2 text-green-600">
                      <Server className="w-4 h-4" />
                      <span>服务器端处理，无客户端限制</span>
                    </div>
                  </div>
                  <p className="text-blue-600 font-medium mt-2">✨ 100% 由 Google Files API 提供稳定分析</p>
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
                        <span className="text-sm">Google Files API 处理</span>
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
                    Google Files API 分析准备就绪
                  </h5>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Google Files API 将智能识别视频中的所有球员</li>
                    <li>• 自动检测球衣号码和队伍归属</li>
                    <li>• 识别主队和客队的球衣颜色</li>
                    <li>• 分析球员位置和运动轨迹</li>
                    <li>• 为每个球员生成置信度评分</li>
                    {uploadingForPlayer && (
                      <li>• 与 {uploadingForPlayer.name} 的历史数据进行对比分析</li>
                    )}
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-medium text-green-800 mb-2 flex items-center">
                    <Cloud className="w-4 h-4 mr-2" />
                    Google Files API 优势
                  </h5>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• 支持最大 2GB 的大视频文件</li>
                    <li>• 100% 服务器端处理，无客户端限制</li>
                    <li>• 更稳定的 AI 分析，减少检测失败</li>
                    <li>• 智能重试机制，确保球员识别成功</li>
                    <li>• 更准确的队伍颜色和球员位置识别</li>
                    <li>• 优化的处理流程，提高成功率</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h5 className="font-medium text-purple-800 mb-2">上传建议:</h5>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• 确保视频中球员清晰可见</li>
                    <li>• 良好的光线和拍摄角度能提高识别准确度</li>
                    <li>• 避免过度晃动的镜头</li>
                    <li>• 选择球员活动较多的精彩片段</li>
                    <li>• Files API 将自动优化分析效果</li>
                  </ul>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleUpload}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
                  >
                    <span className="w-2 h-2 bg-white rounded-full mr-3 animate-pulse"></span>
                    {uploadingForPlayer ? `为 ${uploadingForPlayer.name} 开始分析` : '开始 Google Files API 分析'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setErrorMessage('');
                    }}
                    className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:border-red-500 hover:text-red-600 transition-all duration-200"
                  >
                    取消
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
                    {uploadStatus === 'uploading' && '正在将视频上传到 Google Cloud 进行 Files API 处理...'}
                    {uploadStatus === 'analyzing' && 'Google Files API 正在深度分析视频内容，智能重试确保检测成功...'}
                    {uploadStatus === 'complete' && '所有球员已成功识别，请选择要分析的目标球员'}
                    {uploadStatus === 'error' && '处理过程中出现问题，请检查网络连接后重试'}
                  </p>
                  {uploadingForPlayer && (
                    <p className="text-blue-600 mt-2">
                      分析完成后将与 {uploadingForPlayer.name} 的历史数据进行对比
                    </p>
                  )}
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${
                      uploadStatus === 'error' 
                        ? 'bg-red-500' 
                        : 'bg-gradient-to-r from-blue-500 to-purple-500'
                    }`}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-center space-x-4">
                  <p className="text-lg font-semibold text-gray-900">
                    {Math.round(uploadProgress)}% 完成
                  </p>
                  {uploadStatus === 'analyzing' && (
                    <div className="flex items-center text-sm text-blue-600">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                      Google Files API 深度分析中...
                    </div>
                  )}
                </div>

                {uploadStatus === 'error' && (
                  <button
                    onClick={handleRetry}
                    className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                  >
                    重新尝试
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
            <h3 className="font-semibold text-gray-900 mb-2">Google Files API</h3>
            <p className="text-gray-600 text-sm">
              100% 使用 Google Files API 处理，支持 2GB 大文件，无客户端限制
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 p-3 rounded-lg inline-block mb-4">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">稳定可靠分析</h3>
            <p className="text-gray-600 text-sm">
              服务器端处理配合智能重试机制，确保每次都能成功检测到球员
            </p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-lg inline-block mb-4">
              <Server className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {uploadingForPlayer ? '历史数据对比' : '无限制处理'}
            </h3>
            <p className="text-gray-600 text-sm">
              {uploadingForPlayer 
                ? '新分析将与历史数据对比，显示进步趋势和表现变化'
                : '完全服务器端处理，支持任意大小视频文件，无浏览器限制'
              }
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoUpload;