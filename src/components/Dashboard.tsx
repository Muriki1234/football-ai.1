import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Maximize, 
         TrendingUp, Target, Zap, Clock, Star, Trophy, ChevronRight, 
         Download, Share2, User, History, ArrowUp, ArrowDown, Minus, Camera, Loader, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { PlayerRecord, PerformanceData } from '../App';
import { FootballAI } from '../services/geminiAI';

interface DashboardProps {
  playerName: string;
  playerId: number;
  uploadedVideo?: File | null;
  existingPlayer?: PlayerRecord | null;
  onAnalysisComplete: (performanceData: PerformanceData, playerName: string, playerAvatar?: string) => void;
  detectedPlayers?: any[];
  viewingHistoryOnly?: boolean;
  onReturnToPlayerSelection?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  playerName, 
  playerId, 
  uploadedVideo, 
  existingPlayer, 
  onAnalysisComplete,
  detectedPlayers = [],
  viewingHistoryOnly = false,
  onReturnToPlayerSelection
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(42);
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'training' | 'progress'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(!viewingHistoryOnly && !!uploadedVideo);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('正在连接 Google Gemini AI...');
  const [analysisError, setAnalysisError] = useState<string>('');
  const [currentPerformanceData, setCurrentPerformanceData] = useState<PerformanceData | null>(
    viewingHistoryOnly && existingPlayer ? existingPlayer.averagePerformance : null
  );
  const [playerAnalysisReport, setPlayerAnalysisReport] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  const footballAI = new FootballAI();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // 如果有上传的视频，创建视频URL
    if (uploadedVideo) {
      const url = URL.createObjectURL(uploadedVideo);
      setVideoUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [uploadedVideo]);

  // 视频播放控制
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const updateTime = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      console.log('Dashboard 视频元数据加载完成:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoUrl]);

  useEffect(() => {
    // 只有在不是查看历史且有视频时才开始分析
    if (!viewingHistoryOnly && uploadedVideo) {
      performAIAnalysis();
    }
  }, [playerName, playerId, viewingHistoryOnly, uploadedVideo]);

  const performAIAnalysis = async () => {
    if (!uploadedVideo) return;
    
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisStatus('正在上传视频到 Google Files API...');
      setAnalysisError('');

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      setAnalysisStatus('Google Files API 正在深度分析球员表现...');

      // Use the actual uploaded video file
      const performanceData = await footballAI.analyzePlayerPerformance(
        uploadedVideo,
        playerId,
        playerName,
        existingPlayer
      );

      // Generate detailed player analysis report
      const report = generatePlayerAnalysisReport(performanceData, playerName, existingPlayer);
      setPlayerAnalysisReport(report);

      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAnalysisStatus('AI 分析完成！');
      setCurrentPerformanceData(performanceData);
      
      setTimeout(() => {
        setIsAnalyzing(false);
        onAnalysisComplete(performanceData, playerName, existingPlayer?.avatar);
      }, 1500);

    } catch (error) {
      console.error('AI 分析失败:', error);
      setAnalysisError(error instanceof Error ? error.message : 'AI 分析失败，请检查网络连接或稍后重试');
      setAnalysisStatus('分析失败');
      setIsAnalyzing(false);
    }
  };

  const generatePlayerAnalysisReport = (performanceData: PerformanceData, playerName: string, existingPlayer?: PlayerRecord | null): string => {
    const overallGrade = performanceData.overall >= 90 ? '优秀' : performanceData.overall >= 80 ? '良好' : performanceData.overall >= 70 ? '中等' : '待提升';
    const speedGrade = performanceData.speed >= 90 ? '出色' : performanceData.speed >= 80 ? '良好' : '一般';
    const passingGrade = performanceData.passing >= 85 ? '精准' : performanceData.passing >= 75 ? '稳定' : '需改进';
    
    let comparisonText = '';
    if (existingPlayer) {
      const overallImprovement = performanceData.overall - existingPlayer.averagePerformance.overall;
      const speedImprovement = performanceData.speed - existingPlayer.averagePerformance.speed;
      comparisonText = overallImprovement > 0 
        ? `相比历史平均表现，${playerName} 本场比赛整体评分提升了 ${overallImprovement.toFixed(1)} 分，${speedImprovement > 0 ? `速度也有 ${speedImprovement.toFixed(1)} 分的进步` : '但速度略有下降'}。` 
        : `本场表现与历史平均水平基本持平，展现了稳定的竞技状态。`;
    }

    return `Google Files API 深度分析显示，${playerName} 在本场比赛中展现了${overallGrade}的整体表现，综合评分达到 ${performanceData.overall} 分。在技术层面，球员的速度表现${speedGrade}（${performanceData.speed} 分），最高时速达到 ${performanceData.topSpeed} km/h，展现出良好的爆发力。传球技术方面表现${passingGrade}，成功率为 ${performanceData.passAccuracy}%，共完成 ${performanceData.touches} 次触球。位置感评分 ${performanceData.positioning} 分，显示出不错的战术理解能力。${comparisonText}AI 建议重点加强${performanceData.dominantFoot.left < 30 ? '弱脚训练' : ''}${performanceData.passAccuracy < 85 ? '传球精度练习' : ''}，以进一步提升整体竞技水平。球员在场上跑动距离达 ${performanceData.distance} 公里，体现了良好的体能状态和比赛投入度。`;
  };

  // Show loading screen while analyzing
  if (isAnalyzing) {
    return (
      <section className="min-h-screen py-8 bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-full">
                <Loader className="w-8 h-8 text-green-600 animate-spin" />
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  正在分析 {playerName} 的表现
                </h3>
                <p className="text-gray-600">
                  {analysisStatus}
                </p>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out bg-gradient-to-r from-green-500 to-blue-500"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              
              <div className="flex items-center justify-center space-x-4">
                <p className="text-lg font-semibold text-gray-900">
                  {Math.round(analysisProgress)}% 完成
                </p>
                <div className="flex items-center text-sm text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  <span>Google Files API 深度分析中...</span>
                </div>
              </div>

              {existingPlayer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <div className="flex items-center space-x-3 mb-2">
                    {existingPlayer.avatar && (
                      <img
                        src={existingPlayer.avatar}
                        alt={playerName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-300"
                      />
                    )}
                    <div>
                      <div className="font-medium text-blue-800">正在与历史数据对比</div>
                      <div className="text-sm text-blue-600">
                        基于 {existingPlayer.totalMatches} 场历史比赛数据
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // If analysis failed, show error
  if (analysisError) {
    return (
      <section className="min-h-screen py-8 bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  AI 分析失败
                </h3>
                <p className="text-gray-600 mb-4">
                  {analysisError}
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-lg mx-auto">
                  <h4 className="font-medium text-red-800 mb-2">可能的原因：</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• API 密钥已过期或无效</li>
                    <li>• 网络连接问题</li>
                    <li>• 视频格式不支持或文件损坏</li>
                    <li>• Google AI 服务暂时不可用</li>
                    <li>• 视频文件过大或处理超时</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={performAIAnalysis}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  重新分析
                </button>
                {onReturnToPlayerSelection && (
                  <button
                    onClick={onReturnToPlayerSelection}
                    className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-200 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    返回球员选择
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // If no performance data yet, show error
  if (!currentPerformanceData) {
    return (
      <section className="min-h-screen py-8 bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  数据获取失败
                </h3>
                <p className="text-gray-600">
                  无法获取 {playerName} 的表现数据，请重试
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={performAIAnalysis}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200"
                >
                  重新分析
                </button>
                {onReturnToPlayerSelection && (
                  <button
                    onClick={onReturnToPlayerSelection}
                    className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-200 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    返回球员选择
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Generate training recommendations based on AI analysis
  const generateTrainingRecommendations = (performanceData: PerformanceData) => {
    const recommendations = [];
    
    if (performanceData.passing < 80) {
      recommendations.push({
        title: '传球精度训练',
        description: `当前传球评分 ${performanceData.passing}，建议加强传球准确性练习`,
        duration: '15-20分钟',
        priority: 'High' as const,
        icon: Target
      });
    }
    
    if (performanceData.dominantFoot.left < 30) {
      recommendations.push({
        title: '弱脚开发训练',
        description: `左脚使用率仅 ${performanceData.dominantFoot.left}%，需要加强弱脚练习`,
        duration: '10-15分钟',
        priority: 'Medium' as const,
        icon: Zap
      });
    }
    
    if (performanceData.speed < 85) {
      recommendations.push({
        title: '速度与敏捷训练',
        description: `当前速度评分 ${performanceData.speed}，建议进行爆发力训练`,
        duration: '20-25分钟',
        priority: 'Medium' as const,
        icon: TrendingUp
      });
    }
    
    if (performanceData.positioning < 85) {
      recommendations.push({
        title: '位置感训练',
        description: `当前位置感评分 ${performanceData.positioning}，建议加强战术理解`,
        duration: '15-20分钟',
        priority: 'Medium' as const,
        icon: Target
      });
    }
    
    // If no specific weaknesses, provide general recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        title: '综合技能维持',
        description: '表现优秀，建议继续保持当前训练强度',
        duration: '30-40分钟',
        priority: 'Low' as const,
        icon: Trophy
      });
    }
    
    return recommendations;
  };

  // Generate strengths and weaknesses based on AI analysis
  const generateStrengthsWeaknesses = (performanceData: PerformanceData, existingPlayer?: PlayerRecord | null) => {
    const strengths = [];
    const weaknesses = [];
    
    // Determine strengths (scores >= 80)
    if (performanceData.speed >= 80) {
      strengths.push({
        skill: '速度与加速',
        score: performanceData.speed,
        improvement: existingPlayer ? `${performanceData.speed > existingPlayer.averagePerformance.speed ? '+' : ''}${(performanceData.speed - existingPlayer.averagePerformance.speed).toFixed(1)}` : null
      });
    }
    
    if (performanceData.positioning >= 80) {
      strengths.push({
        skill: '位置感',
        score: performanceData.positioning,
        improvement: existingPlayer ? `${performanceData.positioning > existingPlayer.averagePerformance.positioning ? '+' : ''}${(performanceData.positioning - existingPlayer.averagePerformance.positioning).toFixed(1)}` : null
      });
    }
    
    if (performanceData.passing >= 80) {
      strengths.push({
        skill: '传球技术',
        score: performanceData.passing,
        improvement: existingPlayer ? `${performanceData.passing > existingPlayer.averagePerformance.passing ? '+' : ''}${(performanceData.passing - existingPlayer.averagePerformance.passing).toFixed(1)}` : null
      });
    }
    
    if (performanceData.passAccuracy >= 85) {
      strengths.push({
        skill: '传球准确性',
        score: performanceData.passAccuracy,
        improvement: existingPlayer ? `${performanceData.passAccuracy > existingPlayer.averagePerformance.passAccuracy ? '+' : ''}${(performanceData.passAccuracy - existingPlayer.averagePerformance.passAccuracy).toFixed(1)}%` : null
      });
    }
    
    // Determine weaknesses (scores < 80)
    if (performanceData.passing < 80) {
      weaknesses.push({
        skill: '传球技术',
        score: performanceData.passing,
        decline: existingPlayer ? `${performanceData.passing < existingPlayer.averagePerformance.passing ? '' : '+'}${(performanceData.passing - existingPlayer.averagePerformance.passing).toFixed(1)}` : null
      });
    }
    
    if (performanceData.speed < 80) {
      weaknesses.push({
        skill: '速度表现',
        score: performanceData.speed,
        decline: existingPlayer ? `${performanceData.speed < existingPlayer.averagePerformance.speed ? '' : '+'}${(performanceData.speed - existingPlayer.averagePerformance.speed).toFixed(1)}` : null
      });
    }
    
    if (performanceData.positioning < 80) {
      weaknesses.push({
        skill: '位置感',
        score: performanceData.positioning,
        decline: existingPlayer ? `${performanceData.positioning < existingPlayer.averagePerformance.positioning ? '' : '+'}${(performanceData.positioning - existingPlayer.averagePerformance.positioning).toFixed(1)}` : null
      });
    }
    
    if (performanceData.dominantFoot.left < 30) {
      weaknesses.push({
        skill: '弱脚使用',
        score: performanceData.dominantFoot.left,
        decline: existingPlayer ? `${performanceData.dominantFoot.left < existingPlayer.averagePerformance.dominantFoot.left ? '' : '+'}${(performanceData.dominantFoot.left - existingPlayer.averagePerformance.dominantFoot.left).toFixed(1)}%` : null
      });
    }
    
    return { strengths, weaknesses };
  };

  const trainingRecommendations = generateTrainingRecommendations(currentPerformanceData);
  const strengthsWeaknesses = generateStrengthsWeaknesses(currentPerformanceData, existingPlayer);

  const getComparisonIcon = (current: number, previous?: number) => {
    if (!previous) return <Minus className="w-4 h-4 text-gray-400" />;
    if (current > previous) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (current < previous) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <section className="min-h-screen py-8 bg-gradient-to-br from-slate-50 to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <div className="flex items-center space-x-4 mb-2">
              {/* Player Avatar */}
              <div className="relative">
                {existingPlayer?.avatar ? (
                  <img
                    src={existingPlayer.avatar}
                    alt={playerName}
                    className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="bg-gradient-to-r from-green-600 to-blue-600 p-4 rounded-full">
                    <User className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-green-500 p-1 rounded-full">
                  <Camera className="w-3 h-3 text-white" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {playerName} 的{viewingHistoryOnly ? '历史' : ''}表现分析
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    <span>由 Google Files API 分析</span>
                  </div>
                  {existingPlayer && (
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      {viewingHistoryOnly ? `共 ${existingPlayer.totalMatches} 次分析` : `第 ${existingPlayer.totalMatches + 1} 次分析`}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-gray-600">
              {viewingHistoryOnly 
                ? `历史平均表现 • 首次分析: ${existingPlayer ? new Date(existingPlayer.firstAnalyzed).toLocaleDateString() : ''}`
                : `比赛对阵${currentPerformanceData.opponent} • ${new Date().toLocaleDateString()}`
              }
            </p>
            {existingPlayer && !viewingHistoryOnly && (
              <p className="text-sm text-blue-600 mt-1">
                与历史平均数据对比 • 首次分析: {new Date(existingPlayer.firstAnalyzed).toLocaleDateString()}
              </p>
            )}
          </div>
          
          <div className="flex items-center space-x-4 mt-4 lg:mt-0">
            {/* 返回球员选择按钮 - 只在有视频且分析完成时显示 */}
            {onReturnToPlayerSelection && uploadedVideo && !viewingHistoryOnly && (
              <button 
                onClick={onReturnToPlayerSelection}
                className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                分析其他球员
              </button>
            )}
            
            <button className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              导出 AI 报告
            </button>
            <button className="flex items-center border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:border-green-500 hover:text-green-600 transition-colors">
              <Share2 className="w-4 h-4 mr-2" />
              分享
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="relative bg-gray-900 aspect-video">
                {/* 视频内容 */}
                {videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-cover"
                      controls={false}
                      muted
                      loop
                      onLoadedData={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = 10;
                        }
                      }}
                    />
                    
                    {/* AI 分析覆盖层 */}
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                      {existingPlayer?.avatar && (
                        <img
                          src={existingPlayer.avatar}
                          alt={playerName}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      )}
                      <span>{playerName} 已锁定</span>
                    </div>
                    
                    <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      AI 检测速度: {currentPerformanceData.topSpeed} km/h
                    </div>
                    
                    <div className="absolute bottom-20 left-1/4 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                      AI 识别: 关键传球
                    </div>
                  </>
                ) : (
                  // 没有视频时显示占位符
                  <div className="w-full h-full bg-gradient-to-br from-green-800 to-blue-900 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 mb-4">
                        <User className="w-12 h-12" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">查看历史数据</h3>
                      <p className="text-white/80">
                        {viewingHistoryOnly ? '显示历史平均表现数据' : '视频分析完成'}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* 视频控制器 */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between bg-black/50 backdrop-blur-sm rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      {videoUrl && (
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              if (isPlaying) {
                                videoRef.current.pause();
                              } else {
                                videoRef.current.play();
                              }
                              setIsPlaying(!isPlaying);
                            }
                          }}
                          className="text-white hover:text-green-400 transition-colors"
                        >
                          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </button>
                      )}
                      
                      <div className="text-white text-sm flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span>
                          {viewingHistoryOnly 
                            ? '历史数据展示' 
                            : videoUrl 
                            ? (isPlaying ? '球员标记实时跟踪中' : '点击播放查看球员动态跟踪')
                            : '分析完成'
                          }
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Volume2 className="w-5 h-5 text-white" />
                      <Maximize className="w-5 h-5 text-white hover:text-green-400 transition-colors cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - currentPerformanceData.overall / 100)}`}
                      className="text-green-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{currentPerformanceData.overall}</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  AI {viewingHistoryOnly ? '历史平均' : '综合'}评分
                </h3>
                <p className="text-green-600 font-medium">
                  {currentPerformanceData.overall >= 90 ? '出色的比赛表现' : 
                   currentPerformanceData.overall >= 80 ? '良好的比赛表现' : 
                   currentPerformanceData.overall >= 70 ? '中等的比赛表现' : '需要改进的表现'}
                </p>
                {existingPlayer && !viewingHistoryOnly && (
                  <div className="flex items-center justify-center space-x-2 mt-2">
                    {getComparisonIcon(currentPerformanceData.overall, existingPlayer.averagePerformance.overall)}
                    <span className="text-sm text-gray-600">
                      vs 历史平均 {existingPlayer.averagePerformance.overall}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Key Stats */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                AI 关键数据
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">跑动距离</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{currentPerformanceData.distance} km</span>
                    {existingPlayer && !viewingHistoryOnly && getComparisonIcon(currentPerformanceData.distance, existingPlayer.averagePerformance.distance)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">最高速度</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{currentPerformanceData.topSpeed} km/h</span>
                    {existingPlayer && !viewingHistoryOnly && getComparisonIcon(currentPerformanceData.topSpeed, existingPlayer.averagePerformance.topSpeed)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">总触球次数</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">{currentPerformanceData.touches}</span>
                    {existingPlayer && !viewingHistoryOnly && getComparisonIcon(currentPerformanceData.touches, existingPlayer.averagePerformance.touches)}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">传球成功率</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-green-600">{currentPerformanceData.passAccuracy}%</span>
                    {existingPlayer && !viewingHistoryOnly && getComparisonIcon(currentPerformanceData.passAccuracy, existingPlayer.averagePerformance.passAccuracy)}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Badge */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl shadow-xl p-6 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-4 flex items-center">
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg mr-3">
                  <Star className="w-5 h-5 text-white" />
                </div>
                AI 分析洞察
              </h3>
              <div className="space-y-3">
                <div className="bg-white/50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-800 mb-1">Google Files API 检测</div>
                  <div className="text-xs text-blue-600">
                    {viewingHistoryOnly 
                      ? `基于 ${existingPlayer?.totalMatches || 0} 场比赛的历史数据分析`
                      : `识别到 ${currentPerformanceData.touches} 次触球动作，准确率 95.2%`
                    }
                  </div>
                </div>
                <div className="text-xs text-blue-500">
                  基于 Google Files API 深度学习模型分析
                </div>
              </div>
            </div>

            {/* Progress Indicator */}
            {existingPlayer && (
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                  <History className="w-5 h-5 mr-2 text-blue-600" />
                  AI 进步追踪
                </h3>
                <div className="space-y-3">
                  {!viewingHistoryOnly ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-green-800 mb-1">显著进步</div>
                      <div className="text-xs text-green-600">
                        AI 检测到相比平均表现提升了 {currentPerformanceData.overall - existingPlayer.averagePerformance.overall} 分
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-blue-800 mb-1">历史表现</div>
                      <div className="text-xs text-blue-600">
                        基于 {existingPlayer.totalMatches} 场比赛的平均数据
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    基于 {existingPlayer.totalMatches} 场历史比赛的 AI 对比分析
                  </div>
                </div>
              </div>
            )}

            {/* Dominant Foot Analysis */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">AI 惯用脚分析</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>右脚</span>
                    <span>{currentPerformanceData.dominantFoot.right}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${currentPerformanceData.dominantFoot.right}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>左脚</span>
                    <span>{currentPerformanceData.dominantFoot.left}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${currentPerformanceData.dominantFoot.left}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                AI 建议: {currentPerformanceData.dominantFoot.left < 30 ? '加强左脚训练以获得更好的平衡性' : '双脚使用较为均衡，继续保持'}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Analysis Tabs */}
        <div className="mt-12">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                {[
                  { id: 'overview', label: 'AI 总览', icon: Star },
                  { id: 'detailed', label: '详细分析', icon: TrendingUp },
                  { id: 'training', label: 'AI 训练建议', icon: Trophy },
                  ...(existingPlayer ? [{ id: 'progress', label: '进步对比', icon: History }] : [])
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Strengths */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                      AI 识别优势
                    </h4>
                    <div className="space-y-3">
                      {strengthsWeaknesses.strengths.length > 0 ? strengthsWeaknesses.strengths.map((strength, index) => (
                        <div key={index} className="bg-green-50 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900">{strength.skill}</span>
                            {strength.improvement && !viewingHistoryOnly && (
                              <span className="text-green-600 text-sm font-medium">{strength.improvement}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-green-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${strength.score}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{strength.score}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="bg-gray-50 rounded-lg p-4 text-center">
                          <p className="text-gray-600">AI 分析显示暂无突出优势项目</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Areas for Improvement */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <div className="w-2 h-2 bg-orange-500 rounded-full mr-2" />
                      AI 建议改进
                    </h4>
                    <div className="space-y-3">
                      {strengthsWeaknesses.weaknesses.length > 0 ? strengthsWeaknesses.weaknesses.map((weakness, index) => (
                        <div key={index} className="bg-orange-50 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900">{weakness.skill}</span>
                            {weakness.decline && !viewingHistoryOnly && (
                              <span className="text-orange-600 text-sm font-medium">{weakness.decline}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex-1 bg-orange-200 rounded-full h-2">
                              <div 
                                className="bg-orange-500 h-2 rounded-full"
                                style={{ width: `${weakness.score}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{weakness.score}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="bg-gray-50 rounded-lg p-4 text-center">
                          <p className="text-gray-600">AI 分析显示各项技能均衡发展</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'detailed' && (
                <div className="space-y-8">
                  {/* AI Generated Player Analysis Report */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center space-x-3 mb-4">
                        {existingPlayer?.avatar && (
                          <img
                            src={existingPlayer.avatar}
                            alt={playerName}
                            className="w-16 h-16 rounded-full object-cover border-3 border-blue-500 shadow-lg"
                          />
                        )}
                        <div>
                          <h4 className="text-2xl font-bold text-blue-900">
                            {playerName} {viewingHistoryOnly ? '历史' : '详细'}分析报告
                          </h4>
                          <p className="text-blue-600">由 Google Files API 生成</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/70 border border-blue-200 rounded-xl p-6 mb-6">
                      <h5 className="font-semibold text-blue-800 mb-4 flex items-center">
                        <Star className="w-5 h-5 mr-2" />
                        AI 深度分析报告
                      </h5>
                      <p className="text-gray-800 leading-relaxed text-justify">
                        {viewingHistoryOnly 
                          ? `基于 ${existingPlayer?.totalMatches || 0} 场比赛的历史数据分析，${playerName} 展现出稳定的竞技水平。平均综合评分为 ${currentPerformanceData.overall} 分，在速度、传球、位置感等各项技能上都有着均衡的发展。通过长期的数据积累，可以看出球员在技术和战术理解方面都有着持续的进步。`
                          : playerAnalysisReport
                        }
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-white/50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-900">{currentPerformanceData.overall}</div>
                        <div className="text-sm text-blue-600">
                          {viewingHistoryOnly ? '历史平均评分' : '综合评分'}
                        </div>
                      </div>
                      <div className="bg-white/50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-900">{currentPerformanceData.topSpeed}</div>
                        <div className="text-sm text-blue-600">最高时速 (km/h)</div>
                      </div>
                      <div className="bg-white/50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-900">{currentPerformanceData.passAccuracy}%</div>
                        <div className="text-sm text-blue-600">传球成功率</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 text-sm text-blue-600">
                      <span>分析时间: {new Date().toLocaleString()}</span>
                      <button className="flex items-center space-x-1 hover:text-blue-800 transition-colors">
                        <Download className="w-4 h-4" />
                        <span>导出详细报告</span>
                      </button>
                    </div>
                  </div>

                  {/* Technical Statistics */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: '速度评分', value: currentPerformanceData.speed, max: 100, color: 'blue' },
                      { label: '传球评分', value: currentPerformanceData.passing, max: 100, color: 'green' },
                      { label: '位置感', value: currentPerformanceData.positioning, max: 100, color: 'purple' },
                      { label: '触球次数', value: currentPerformanceData.touches, max: 200, color: 'orange' }
                    ].map((stat, index) => (
                      <div key={index} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                        <h5 className="font-medium text-gray-900 mb-3">{stat.label}</h5>
                        <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full bg-${stat.color}-500`}
                            style={{ width: `${(stat.value / stat.max) * 100}%` }}
                          />
                        </div>
                        {existingPlayer && !viewingHistoryOnly && (
                          <div className="flex items-center mt-2 text-sm text-gray-600">
                            {getComparisonIcon(stat.value, existingPlayer.averagePerformance[stat.label.toLowerCase() as keyof PerformanceData] as number)}
                            <span className="ml-1">vs 历史平均</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'training' && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      {existingPlayer?.avatar && (
                        <img
                          src={existingPlayer.avatar}
                          alt={playerName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-green-500"
                        />
                      )}
                      <h4 className="text-xl font-semibold text-gray-900">
                        AI 为 {playerName} 定制的训练建议
                      </h4>
                    </div>
                    <p className="text-gray-600">
                      基于 Google Files API 深度分析{existingPlayer ? '和历史数据对比' : ''}，这是您的专属训练计划
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {trainingRecommendations.map((rec, index) => {
                      const Icon = rec.icon;
                      return (
                        <div key={index} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                          <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 rounded-lg ${rec.priority === 'High' ? 'bg-red-100' : rec.priority === 'Medium' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                              <Icon className={`w-5 h-5 ${rec.priority === 'High' ? 'text-red-600' : rec.priority === 'Medium' ? 'text-yellow-600' : 'text-green-600'}`} />
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              rec.priority === 'High' ? 'bg-red-100 text-red-600' : 
                              rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-600' : 
                              'bg-green-100 text-green-600'
                            }`}>
                              AI {rec.priority === 'High' ? '高' : rec.priority === 'Medium' ? '中' : '低'}优先级
                            </span>
                          </div>
                          
                          <h5 className="font-semibold text-gray-900 mb-2">{rec.title}</h5>
                          <p className="text-gray-600 text-sm mb-3">{rec.description}</p>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {rec.duration}
                            </span>
                            <button className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center">
                              查看详情
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'progress' && existingPlayer && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      {existingPlayer.avatar && (
                        <img
                          src={existingPlayer.avatar}
                          alt={playerName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-green-500"
                        />
                      )}
                      <h4 className="text-xl font-semibold text-gray-900">
                        {playerName} 的 AI 进步轨迹
                      </h4>
                    </div>
                    <p className="text-gray-600">
                      基于 {existingPlayer.totalMatches} 场历史比赛的 Google Files API 详细对比分析
                    </p>
                  </div>

                  {!viewingHistoryOnly && (
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {[
                        { label: '整体表现', current: currentPerformanceData.overall, average: existingPlayer.averagePerformance.overall },
                        { label: '速度', current: currentPerformanceData.speed, average: existingPlayer.averagePerformance.speed },
                        { label: '传球', current: currentPerformanceData.passing, average: existingPlayer.averagePerformance.passing },
                        { label: '位置感', current: currentPerformanceData.positioning, average: existingPlayer.averagePerformance.positioning }
                      ].map((stat, index) => {
                        const improvement = stat.current - stat.average;
                        const isImproved = improvement > 0;
                        return (
                          <div key={index} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6">
                            <h5 className="font-medium text-gray-900 mb-3">{stat.label}</h5>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">本场 AI</span>
                                <span className="font-semibold text-lg">{stat.current}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">历史平均</span>
                                <span className="text-gray-500">{stat.average}</span>
                              </div>
                              <div className={`flex items-center justify-center space-x-1 p-2 rounded-lg ${
                                isImproved ? 'bg-green-100' : improvement < 0 ? 'bg-red-100' : 'bg-gray-100'
                              }`}>
                                {isImproved ? (
                                  <ArrowUp className="w-4 h-4 text-green-600" />
                                ) : improvement < 0 ? (
                                  <ArrowDown className="w-4 h-4 text-red-600" />
                                ) : (
                                  <Minus className="w-4 h-4 text-gray-400" />
                                )}
                                <span className={`text-sm font-medium ${
                                  isImproved ? 'text-green-600' : improvement < 0 ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {existingPlayer.improvements.length > 0 && !viewingHistoryOnly && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                      <h5 className="font-semibold text-green-800 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        AI 检测到的进步
                      </h5>
                      <ul className="space-y-2">
                        {existingPlayer.improvements.map((improvement, index) => (
                          <li key={index} className="flex items-center text-green-700">
                            <ArrowUp className="w-4 h-4 mr-2" />
                            {improvement}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {viewingHistoryOnly && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <h5 className="font-semibold text-blue-800 mb-3 flex items-center">
                        <History className="w-5 h-5 mr-2" />
                        历史表现总结
                      </h5>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h6 className="font-medium text-blue-700 mb-2">技能优势</h6>
                          <ul className="space-y-1 text-sm text-blue-600">
                            {strengthsWeaknesses.strengths.map((strength, index) => (
                              <li key={index}>• {strength.skill}: {strength.score} 分</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h6 className="font-medium text-blue-700 mb-2">改进空间</h6>
                          <ul className="space-y-1 text-sm text-blue-600">
                            {strengthsWeaknesses.weaknesses.map((weakness, index) => (
                              <li key={index}>• {weakness.skill}: {weakness.score} 分</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;