import React, { useState, useEffect } from 'react';
import { Users, User, CheckCircle, ArrowRight, Loader, History, Star, Camera, AlertCircle, RefreshCw, Target, Zap, Square } from 'lucide-react';
import { PlayerRecord } from '../App';
import { FootballAI, PlayerDetection } from '../services/geminiAI';

interface PlayerSelectionProps {
  videoFile: File;
  onPlayerSelected: (playerId: number, playerName: string, playerAvatar?: string, players?: PlayerDetection[]) => void;
  playerDatabase: PlayerRecord[];
  existingDetectedPlayers?: PlayerDetection[];
  uploadingForPlayer?: PlayerRecord | null;
}

const PlayerSelection: React.FC<PlayerSelectionProps> = ({ 
  videoFile, 
  onPlayerSelected, 
  playerDatabase, 
  existingDetectedPlayers,
  uploadingForPlayer
}) => {
  // 关键修改：新增最佳帧相关状态
  const [isAnalyzing, setIsAnalyzing] = useState(!existingDetectedPlayers || existingDetectedPlayers.length === 0);
  const [detectedPlayers, setDetectedPlayers] = useState<PlayerDetection[]>(existingDetectedPlayers || []);
  const [bestFrameUrl, setBestFrameUrl] = useState<string>('');
  const [bestFrameTimestamp, setBestFrameTimestamp] = useState<number>(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState(uploadingForPlayer?.name || '');
  const [suggestedPlayers, setSuggestedPlayers] = useState<PlayerRecord[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [capturedAvatar, setCapturedAvatar] = useState<string | null>(uploadingForPlayer?.avatar || null);
  const [isCapturingAvatar, setIsCapturingAvatar] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>('');
  const [analysisStatus, setAnalysisStatus] = useState<string>('正在提取最佳帧...');
  const [teamColors, setTeamColors] = useState<{home: string, away: string}>({home: '', away: ''});
  const [hasAttemptedAnalysis, setHasAttemptedAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const footballAI = new FootballAI();

  useEffect(() => {
    // 关键修改：只有在没有现有检测结果且未尝试过分析时才开始分析
    if ((!existingDetectedPlayers || existingDetectedPlayers.length === 0) && !hasAttemptedAnalysis) {
      console.log('开始首次 AI 最佳帧分析...');
      setHasAttemptedAnalysis(true);
      analyzeVideoWithAI();
    } else if (existingDetectedPlayers && existingDetectedPlayers.length > 0) {
      console.log('使用现有检测结果:', existingDetectedPlayers.length, '名球员');
      setDetectedPlayers(existingDetectedPlayers);
      setIsAnalyzing(false);
      
      // 提取队伍颜色
      const homeTeamColor = existingDetectedPlayers.find(p => p.team === 'home')?.teamColor || '蓝色';
      const awayTeamColor = existingDetectedPlayers.find(p => p.team === 'away')?.teamColor || '红色';
      setTeamColors({ home: homeTeamColor, away: awayTeamColor });
    }
  }, [videoFile, existingDetectedPlayers, hasAttemptedAnalysis]);

  const analyzeVideoWithAI = async () => {
    try {
      console.log('🎯 开始 AI 最佳帧分析...');
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisStatus('正在提取包含最多球员的最佳帧...');
      setAnalysisError('');
      setDetectedPlayers([]);

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return 85;
          }
          return prev + Math.random() * 8;
        });
      }, 800);

      setAnalysisStatus('AI 正在分析视频，寻找最佳帧并过滤裁判...');

      // 关键修改：使用新的最佳帧分析方法
      const result = await footballAI.uploadAndAnalyzeVideo(videoFile);
      
      console.log('AI 最佳帧分析完成，检测到球员:', result.players.length);
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setAnalysisStatus('AI 分析完成，最佳帧球员识别成功（已过滤裁判）！');
      
      // 关键修改：设置最佳帧和球员数据
      if (result.players && result.players.length > 0) {
        setDetectedPlayers(result.players);
        setBestFrameUrl(result.bestFrameUrl);
        setBestFrameTimestamp(result.bestFrameTimestamp);
        
        // Extract team colors if available
        const homeTeamColor = result.players.find(p => p.team === 'home')?.teamColor || '蓝色';
        const awayTeamColor = result.players.find(p => p.team === 'away')?.teamColor || '红色';
        setTeamColors({ home: homeTeamColor, away: awayTeamColor });
        
        console.log('最佳帧数据设置成功，队伍颜色:', { home: homeTeamColor, away: awayTeamColor });
        console.log('最佳帧时间戳:', result.bestFrameTimestamp, '秒');
      } else {
        console.warn('AI 分析返回空结果');
        setAnalysisError('AI 未检测到任何球员，请重试');
      }
      
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 1500);

    } catch (error) {
      console.error('AI 最佳帧分析失败:', error);
      setAnalysisError(error instanceof Error ? error.message : 'AI 分析失败，请检查网络连接或稍后重试');
      setAnalysisStatus('分析失败');
      setIsAnalyzing(false);
      setDetectedPlayers([]);
    }
  };

  // 手动重新分析函数
  const handleRetryAnalysis = () => {
    console.log('用户手动重新分析...');
    setHasAttemptedAnalysis(false);
    setDetectedPlayers([]);
    setBestFrameUrl('');
    setBestFrameTimestamp(0);
    setAnalysisError('');
    analyzeVideoWithAI();
  };

  // Filter suggestions based on player name input
  useEffect(() => {
    if (uploadingForPlayer) {
      setSuggestedPlayers([]);
      setShowSuggestions(false);
      return;
    }

    if (playerName.trim().length > 0) {
      const filtered = playerDatabase.filter(player =>
        player.name.toLowerCase().includes(playerName.toLowerCase())
      );
      setSuggestedPlayers(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestedPlayers([]);
      setShowSuggestions(false);
    }
  }, [playerName, playerDatabase, uploadingForPlayer]);

  const handlePlayerClick = async (playerId: number) => {
    setSelectedPlayerId(playerId);
    
    if (uploadingForPlayer) {
      return;
    }
    
    // 关键修改：使用最佳帧截取头像
    const selectedPlayer = detectedPlayers.find(p => p.id === playerId);
    if (selectedPlayer && bestFrameUrl) {
      setTimeout(() => {
        capturePlayerAvatarFromBestFrame(selectedPlayer);
      }, 500);
    }
  };

  // 改进：从最佳帧截取球员头像（基于边界框）
  const capturePlayerAvatarFromBestFrame = async (player: PlayerDetection) => {
    if (!bestFrameUrl || !selectedPlayerId) return;
    
    setIsCapturingAvatar(true);
    
    try {
      console.log('📸 从最佳帧截取球员头像（边界框模式）...', { 
        playerId: player.id, 
        x: player.x, 
        y: player.y, 
        width: player.width, 
        height: player.height 
      });
      
      // 创建图像元素
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('无法创建画布上下文');
      }

      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          
          // 绘制最佳帧
          ctx.drawImage(img, 0, 0);
          
          // 根据球员边界框截取头像
          const cropX = (player.x / 100) * canvas.width;
          const cropY = (player.y / 100) * canvas.height;
          const cropWidth = (player.width / 100) * canvas.width;
          const cropHeight = (player.height / 100) * canvas.height;
          
          // 确保裁剪区域在画面内
          const safeCropX = Math.max(0, Math.min(canvas.width - cropWidth, cropX));
          const safeCropY = Math.max(0, Math.min(canvas.height - cropHeight, cropY));
          const safeCropWidth = Math.min(cropWidth, canvas.width - safeCropX);
          const safeCropHeight = Math.min(cropHeight, canvas.height - safeCropY);
          
          // 创建头像画布
          const avatarCanvas = document.createElement('canvas');
          const avatarCtx = avatarCanvas.getContext('2d');
          avatarCanvas.width = 150;
          avatarCanvas.height = 150;
          
          if (avatarCtx) {
            // 使用边界框精确截取球员
            avatarCtx.drawImage(
              canvas,
              safeCropX,
              safeCropY,
              safeCropWidth,
              safeCropHeight,
              0,
              0,
              150,
              150
            );
            
            const avatarDataUrl = avatarCanvas.toDataURL('image/jpeg', 0.8);
            setCapturedAvatar(avatarDataUrl);
            console.log('✅ 从最佳帧成功截取球员头像（边界框精确定位）');
          }
        } catch (error) {
          console.error('❌ 从最佳帧截取头像失败:', error);
        } finally {
          setIsCapturingAvatar(false);
        }
      };
      
      img.onerror = () => {
        console.error('❌ 最佳帧图像加载失败');
        setIsCapturingAvatar(false);
      };
      
      img.src = bestFrameUrl;
      
    } catch (error) {
      console.error('❌ 从最佳帧截取头像失败:', error);
      setIsCapturingAvatar(false);
    }
  };

  const handleSuggestionSelect = (player: PlayerRecord) => {
    setPlayerName(player.name);
    setShowSuggestions(false);
    if (player.avatar) {
      setCapturedAvatar(player.avatar);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedPlayerId && playerName.trim()) {
      onPlayerSelected(selectedPlayerId, playerName.trim(), capturedAvatar || undefined, detectedPlayers);
    }
  };

  const selectedPlayer = detectedPlayers.find(p => p.id === selectedPlayerId);
  const existingPlayer = playerDatabase.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase()
  );

  return (
    <section className="min-h-screen py-8 bg-gradient-to-br from-slate-50 to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          {uploadingForPlayer ? (
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-4 mb-4">
                {uploadingForPlayer.avatar && (
                  <img
                    src={uploadingForPlayer.avatar}
                    alt={uploadingForPlayer.name}
                    className="w-16 h-16 rounded-full object-cover border-4 border-green-500 shadow-lg"
                  />
                )}
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                    为 {uploadingForPlayer.name} 选择球员标签
                  </h1>
                  <p className="text-xl text-gray-600">
                    在最佳帧中找到 {uploadingForPlayer.name} 并点击对应的球员边界框
                  </p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• 已有 {uploadingForPlayer.totalMatches} 场分析记录</p>
                  <p>• 平均评分: {uploadingForPlayer.averagePerformance.overall}</p>
                  <p>• AI 已提取最佳帧并过滤裁判，生成精确边界框</p>
                  <p>• 球员姓名已自动填充，选择边界框后可直接开始分析</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                选择要分析的球员
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                AI 已从视频中提取最佳帧并过滤裁判，生成精确边界框，请点击您想要分析的球员
              </p>
            </>
          )}
          <div className="mt-4 inline-flex items-center bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-4 py-2 rounded-full text-sm">
            <Square className="w-4 h-4 mr-2" />
            <span>边界框精确识别 + 裁判过滤</span>
          </div>
        </div>

        {isAnalyzing ? (
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-gradient-to-r from-green-100 to-blue-100 rounded-full">
                <Loader className="w-8 h-8 text-green-600 animate-spin" />
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  {analysisStatus}
                </h3>
                <p className="text-gray-600">
                  AI 正在分析视频的每一帧，寻找包含最多球员的最佳画面并过滤裁判
                </p>
                {uploadingForPlayer && (
                  <p className="text-blue-600 mt-2">
                    分析完成后将与 {uploadingForPlayer.name} 的历史数据进行对比
                  </p>
                )}
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-500" 
                  style={{ width: `${analysisProgress}%` }} 
                />
              </div>
              
              <div className="flex items-center justify-center space-x-4">
                <p className="text-lg font-semibold text-gray-900">
                  {Math.round(analysisProgress)}% 完成
                </p>
                <div className="flex items-center text-sm text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  <span>边界框生成 + 裁判过滤中...</span>
                </div>
              </div>
            </div>
          </div>
        ) : analysisError ? (
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
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
                  <h4 className="font-medium text-red-800 mb-2">可能的原因：</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• API 密钥已过期或无效</li>
                    <li>• 网络连接问题</li>
                    <li>• 视频格式不支持或文件损坏</li>
                    <li>• Google AI 服务暂时不可用</li>
                    <li>• 视频中没有清晰的足球比赛画面</li>
                    <li>• 边界框生成或裁判过滤过程中出现问题</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleRetryAnalysis}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  重新分析
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-red-500 hover:text-red-600 transition-all duration-200"
                >
                  返回重新上传
                </button>
              </div>
            </div>
          </div>
        ) : detectedPlayers.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <div className="space-y-6">
              <div className="inline-flex p-4 bg-yellow-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  未检测到球员
                </h3>
                <p className="text-gray-600 mb-4">
                  AI 分析完成，但未在最佳帧中检测到任何球员（可能都被识别为裁判）
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
                  <h4 className="font-medium text-yellow-800 mb-2">建议：</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• 确保视频包含清晰的足球比赛画面</li>
                    <li>• 检查视频质量和光线条件</li>
                    <li>• 尝试上传不同的视频片段</li>
                    <li>• 确保球员在画面中清晰可见</li>
                    <li>• 选择球员活动较多的场景</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleRetryAnalysis}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  重新分析
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-red-500 hover:text-red-600 transition-all duration-200"
                >
                  返回重新上传
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* 关键修改：最佳帧显示区域，使用边界框标记球员 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="relative bg-gray-900 aspect-video">
                  {bestFrameUrl ? (
                    <img
                      src={bestFrameUrl}
                      alt="最佳帧 - 包含最多球员的画面（已过滤裁判）"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <div className="text-center">
                        <Loader className="w-12 h-12 animate-spin mx-auto mb-4" />
                        <p>正在加载最佳帧...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* AI Analysis Overlay */}
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2">
                    <Square className="w-4 h-4" />
                    <span>边界框识别 - 已识别 {detectedPlayers.length} 名球员（已过滤裁判）</span>
                  </div>
                  
                  {/* Best Frame Info */}
                  <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4" />
                      <span>时间戳: {bestFrameTimestamp.toFixed(1)}s</span>
                    </div>
                  </div>
                  
                  {/* Team Colors Legend */}
                  {teamColors.home && teamColors.away && (
                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span>主队 ({teamColors.home})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span>客队 ({teamColors.away})</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 关键修改：球员边界框标记 - 在最佳帧上显示 */}
                  {detectedPlayers.map((player) => {
                    const isSelected = selectedPlayerId === player.id;
                    
                    return (
                      <button
                        key={player.id}
                        onClick={() => handlePlayerClick(player.id)}
                        className={`absolute transition-all duration-300 ${
                          isSelected ? 'z-20' : 'hover:scale-105 z-10'
                        }`}
                        style={{
                          left: `${player.x}%`,
                          top: `${player.y}%`,
                          width: `${player.width}%`,
                          height: `${player.height}%`,
                        }}
                      >
                        <div className={`relative w-full h-full ${isSelected ? 'animate-pulse' : ''}`}>
                          {/* 边界框 */}
                          <div className={`w-full h-full border-3 rounded-lg transition-all duration-300 ${
                            isSelected
                              ? 'border-green-400 bg-green-400/30 shadow-xl'
                              : player.team === 'home'
                              ? 'border-blue-400 bg-blue-400/20 hover:bg-blue-400/30'
                              : 'border-red-400 bg-red-400/20 hover:bg-red-400/30'
                          }`}>
                            {/* 球员标签 */}
                            <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                              isSelected
                                ? 'bg-green-500'
                                : player.team === 'home'
                                ? 'bg-blue-500'
                                : 'bg-red-500'
                            }`}>
                              #{player.jersey || player.id}
                            </div>
                            
                            {/* 选中指示器 */}
                            {isSelected && (
                              <div className="absolute -top-2 -right-2">
                                <CheckCircle className="w-6 h-6 text-green-500 bg-white rounded-full shadow-lg" />
                              </div>
                            )}
                            
                            {/* AI 置信度指示器 */}
                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                              <div className="bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                AI: {Math.round(player.confidence * 100)}%
                              </div>
                            </div>
                          </div>
                          
                          {/* 球员信息悬浮提示 */}
                          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {player.team === 'home' ? `主队 (${teamColors.home})` : `客队 (${teamColors.away})`}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  
                  {/* Best Frame Controls */}
                  <div className="absolute bottom-4 left-4">
                    <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
                      <div className="text-white text-sm flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span>边界框精确识别（已过滤裁判）</span>
                      </div>
                      
                      {selectedPlayerId && !uploadingForPlayer && (
                        <button
                          onClick={() => capturePlayerAvatarFromBestFrame(selectedPlayer!)}
                          disabled={isCapturingAvatar}
                          className="mt-2 flex items-center space-x-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg text-white text-sm transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          <span>{isCapturingAvatar ? '截取中...' : '截取头像'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Player Selection Panel */}
            <div className="space-y-6">
              {/* AI Analysis Results */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 p-2 rounded-lg mr-3">
                    <Square className="w-5 h-5 text-white" />
                  </div>
                  边界框识别结果 ({detectedPlayers.length})
                </h3>
                
                {/* Best Frame Info */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-green-600" />
                    最佳帧信息:
                  </h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>⏱️ 提取时间: {bestFrameTimestamp.toFixed(1)} 秒</p>
                    <p>🎯 包含球员数: {detectedPlayers.length} 名</p>
                    <p>📊 平均置信度: {detectedPlayers.length > 0 ? Math.round(detectedPlayers.reduce((sum, p) => sum + p.confidence, 0) / detectedPlayers.length * 100) : 0}%</p>
                    <p>🏠 主队球员: {detectedPlayers.filter(p => p.team === 'home').length} 名</p>
                    <p>🏃 客队球员: {detectedPlayers.filter(p => p.team === 'away').length} 名</p>
                    <p>📦 边界框精确定位: 100% 覆盖</p>
                    <p>🚫 裁判过滤: 已启用</p>
                  </div>
                </div>
                
                {/* Team Colors Display */}
                {teamColors.home && teamColors.away && (
                  <div className="bg-gradient-to-r from-blue-50 to-red-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">AI 识别的队伍颜色:</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-800 font-medium">主队: {teamColors.home}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span className="text-red-800 font-medium">客队: {teamColors.away}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {detectedPlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handlePlayerClick(player.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 ${
                        selectedPlayerId === player.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold border-2 ${
                          player.team === 'home' ? 'bg-blue-500 border-blue-300' : 'bg-red-500 border-red-300'
                        }`}>
                          {player.jersey || player.id}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-gray-900 flex items-center space-x-2">
                            <span>球员 #{player.jersey || player.id}</span>
                            <Square className="w-3 h-3 text-gray-400" />
                          </div>
                          <div className="text-sm text-gray-500">
                            {player.team === 'home' ? `主队 (${teamColors.home || '蓝色'})` : `客队 (${teamColors.away || '红色'})`} • AI置信度 {Math.round(player.confidence * 100)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            边界框: {player.width.toFixed(1)}% × {player.height.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      {selectedPlayerId === player.id && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Name Input */}
              {selectedPlayer && (
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-600" />
                    球员信息
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Player Avatar Preview */}
                    {capturedAvatar && (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <img
                              src={capturedAvatar}
                              alt="球员头像"
                              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-green-500 p-1 rounded-full">
                              <Square className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {uploadingForPlayer ? '现有球员头像' : '边界框精确截取'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {uploadingForPlayer 
                                ? `来自 ${uploadingForPlayer.name} 的历史记录`
                                : `来自最佳帧边界框 (${bestFrameTimestamp.toFixed(1)}s)`
                              }
                            </div>
                          </div>
                          {!uploadingForPlayer && (
                            <button
                              onClick={() => capturePlayerAvatarFromBestFrame(selectedPlayer)}
                              disabled={isCapturingAvatar}
                              className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm transition-colors flex items-center space-x-1"
                            >
                              <Camera className="w-3 h-3" />
                              <span>重拍</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold border-2 ${
                          selectedPlayer.team === 'home' ? 'bg-blue-500 border-blue-300' : 'bg-red-500 border-red-300'
                        }`}>
                          {selectedPlayer.jersey || selectedPlayer.id}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center space-x-2">
                            <span>已选择球员 #{selectedPlayer.jersey || selectedPlayer.id}</span>
                            <Square className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedPlayer.team === 'home' ? `主队 (${teamColors.home || '蓝色'})` : `客队 (${teamColors.away || '红色'})`} • AI置信度 {Math.round(selectedPlayer.confidence * 100)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            边界框: {selectedPlayer.width.toFixed(1)}% × {selectedPlayer.height.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        球员姓名 *
                      </label>
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="请输入球员姓名"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        disabled={!!uploadingForPlayer}
                      />
                      
                      {uploadingForPlayer && (
                        <div className="mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                          球员姓名已自动填充，选择边界框后可直接开始分析
                        </div>
                      )}
                      
                      {/* Player Suggestions */}
                      {showSuggestions && !uploadingForPlayer && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {suggestedPlayers.map((player) => (
                            <button
                              key={player.id}
                              onClick={() => handleSuggestionSelect(player)}
                              className="w-full flex items-center space-x-3 p-3 hover:bg-green-50 transition-colors text-left"
                            >
                              <div className="relative">
                                {player.avatar ? (
                                  <img
                                    src={player.avatar}
                                    alt={player.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="bg-gradient-to-r from-green-500 to-blue-500 p-2 rounded-full">
                                    <History className="w-6 h-6 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{player.name}</div>
                                <div className="text-sm text-gray-500">
                                  {player.totalMatches} 场比赛 • 平均评分 {player.averagePerformance.overall}
                                </div>
                              </div>
                              <Star className="w-4 h-4 text-yellow-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Existing Player Info */}
                    {(existingPlayer || uploadingForPlayer) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          {(existingPlayer?.avatar || uploadingForPlayer?.avatar) ? (
                            <img
                              src={existingPlayer?.avatar || uploadingForPlayer?.avatar}
                              alt={existingPlayer?.name || uploadingForPlayer?.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-blue-300"
                            />
                          ) : (
                            <div className="bg-blue-600 p-2 rounded-full">
                              <History className="w-8 h-8 text-white" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-blue-800 flex items-center space-x-2">
                              <span>{uploadingForPlayer ? '为现有球员上传' : '发现历史记录'}</span>
                              <History className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p>• 已分析 {(existingPlayer || uploadingForPlayer)?.totalMatches} 场比赛</p>
                          <p>• 平均评分: {(existingPlayer || uploadingForPlayer)?.averagePerformance.overall}</p>
                          <p>• 上次分析: {new Date((existingPlayer || uploadingForPlayer)?.lastAnalyzed || '').toLocaleDateString()}</p>
                          {uploadingForPlayer && (
                            <p>• 新分析将自动与历史数据对比，显示详细进步趋势</p>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          {uploadingForPlayer 
                            ? '选择边界框后将直接开始分析，无需重新输入姓名'
                            : '将与历史数据进行对比分析，并更新球员头像'
                          }
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={handleConfirmSelection}
                      disabled={!playerName.trim()}
                      className={`w-full py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center ${
                        playerName.trim()
                          ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:shadow-lg transform hover:-translate-y-1'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {uploadingForPlayer 
                        ? `继续分析 "${uploadingForPlayer.name}"` 
                        : existingPlayer 
                        ? '继续 AI 深度分析' 
                        : '开始 AI 智能分析'
                      } {!uploadingForPlayer && playerName.trim() && `"${playerName}"`}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {/* AI Instructions */}
              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-6 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  边界框识别 + 裁判过滤技术
                </h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    AI 自动分析视频每一帧，找到包含最多球员的最佳画面
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    智能过滤裁判，只识别穿着球队球衣的球员
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    为每个球员生成精确边界框，准确框住球员身体轮廓
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    基于边界框精确位置截取球员头像，避免背景干扰
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    智能识别主队和客队的球衣颜色和号码
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    提供更高的识别准确率和位置精度
                  </li>
                  {uploadingForPlayer && (
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      为现有球员自动填充姓名，简化上传流程
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PlayerSelection;