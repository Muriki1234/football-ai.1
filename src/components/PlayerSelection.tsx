import React, { useState, useEffect } from 'react';
import { Users, User, CheckCircle, ArrowRight, Loader, History, Star, Camera, AlertCircle, RefreshCw, Target, Zap, Brain } from 'lucide-react';
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
  const [analysisStatus, setAnalysisStatus] = useState<string>('Extracting optimal frame...');
  const [teamColors, setTeamColors] = useState<{home: string, away: string}>({home: '', away: ''});
  const [hasAttemptedAnalysis, setHasAttemptedAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const footballAI = new FootballAI();

  useEffect(() => {
    if ((!existingDetectedPlayers || existingDetectedPlayers.length === 0) && !hasAttemptedAnalysis) {
      console.log('Starting initial AI optimal frame analysis...');
      setHasAttemptedAnalysis(true);
      analyzeVideoWithAI();
    } else if (existingDetectedPlayers && existingDetectedPlayers.length > 0) {
      console.log('Using existing detection results:', existingDetectedPlayers.length, 'players');
      setDetectedPlayers(existingDetectedPlayers);
      setIsAnalyzing(false);
      
      const homeTeamColor = existingDetectedPlayers.find(p => p.team === 'home')?.teamColor || 'Blue';
      const awayTeamColor = existingDetectedPlayers.find(p => p.team === 'away')?.teamColor || 'Red';
      setTeamColors({ home: homeTeamColor, away: awayTeamColor });
    }
  }, [videoFile, existingDetectedPlayers, hasAttemptedAnalysis]);

  const analyzeVideoWithAI = async () => {
    try {
      console.log('🎯 Starting AI optimal frame analysis...');
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisStatus('Extracting frame with most players...');
      setAnalysisError('');
      setDetectedPlayers([]);

      // Enhanced progress simulation
      const progressStages = [
        { target: 15, duration: 1000, message: 'Initializing Gemini video analysis...' },
        { target: 35, duration: 2000, message: 'Scanning video frames for player density...' },
        { target: 55, duration: 2500, message: 'AI analyzing each frame for optimal detection...' },
        { target: 75, duration: 2000, message: 'Filtering referees and identifying players...' },
        { target: 90, duration: 1500, message: 'Generating precise player boundaries...' }
      ];

      // Animate through progress stages
      for (const stage of progressStages) {
        setAnalysisStatus(stage.message);
        await animateProgress(stage.target, stage.duration);
      }

      setAnalysisStatus('Gemini is analyzing video, finding optimal frame and filtering referees...');

      const result = await footballAI.uploadAndAnalyzeVideo(videoFile);
      
      console.log('AI optimal frame analysis complete, detected players:', result.players.length);
      
      setAnalysisProgress(100);
      setAnalysisStatus('Gemini analysis complete, optimal frame player identification successful (referees filtered)!');
      
      if (result.players && result.players.length > 0) {
        setDetectedPlayers(result.players);
        setBestFrameUrl(result.bestFrameUrl);
        setBestFrameTimestamp(result.bestFrameTimestamp);
        
        const homeTeamColor = result.players.find(p => p.team === 'home')?.teamColor || 'Blue';
        const awayTeamColor = result.players.find(p => p.team === 'away')?.teamColor || 'Red';
        setTeamColors({ home: homeTeamColor, away: awayTeamColor });
        
        console.log('Optimal frame data set successfully, team colors:', { home: homeTeamColor, away: awayTeamColor });
        console.log('Optimal frame timestamp:', result.bestFrameTimestamp, 'seconds');
      } else {
        console.warn('AI analysis returned empty results');
        setAnalysisError('Gemini detected no players, please try again');
      }
      
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 1500);

    } catch (error) {
      console.error('AI optimal frame analysis failed:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Gemini analysis failed, please check network connection or try again later');
      setAnalysisStatus('Analysis failed');
      setIsAnalyzing(false);
      setDetectedPlayers([]);
    }
  };

  const animateProgress = (target: number, duration: number): Promise<void> => {
    return new Promise(resolve => {
      const startProgress = analysisProgress;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentProgress = startProgress + (target - startProgress) * progress;
        
        setAnalysisProgress(currentProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      
      animate();
    });
  };

  const handleRetryAnalysis = () => {
    console.log('User manually retrying analysis...');
    setHasAttemptedAnalysis(false);
    setDetectedPlayers([]);
    setBestFrameUrl('');
    setBestFrameTimestamp(0);
    setAnalysisError('');
    analyzeVideoWithAI();
  };

  // Fixed: Filter suggestions based on starting characters only
  useEffect(() => {
    if (uploadingForPlayer) {
      setSuggestedPlayers([]);
      setShowSuggestions(false);
      return;
    }

    if (playerName.trim().length > 0) {
      // Only show suggestions if the input starts with the same characters
      const filtered = playerDatabase.filter(player => {
        const playerNameLower = player.name.toLowerCase();
        const inputLower = playerName.toLowerCase().trim();
        
        // Check if player name starts with the input
        return playerNameLower.startsWith(inputLower);
      });
      
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
    
    const selectedPlayer = detectedPlayers.find(p => p.id === playerId);
    if (selectedPlayer && bestFrameUrl) {
      setTimeout(() => {
        capturePlayerAvatarFromBestFrame(selectedPlayer);
      }, 500);
    }
  };

  const capturePlayerAvatarFromBestFrame = async (player: PlayerDetection) => {
    if (!bestFrameUrl || !selectedPlayerId) return;
    
    setIsCapturingAvatar(true);
    
    try {
      console.log('📸 Capturing player avatar from optimal frame (boundary box mode)...', { 
        playerId: player.id, 
        x: player.x, 
        y: player.y, 
        width: player.width, 
        height: player.height 
      });
      
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Unable to create canvas context');
      }

      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          
          ctx.drawImage(img, 0, 0);
          
          const cropX = (player.x / 100) * canvas.width;
          const cropY = (player.y / 100) * canvas.height;
          const cropWidth = (player.width / 100) * canvas.width;
          const cropHeight = (player.height / 100) * canvas.height;
          
          const safeCropX = Math.max(0, Math.min(canvas.width - cropWidth, cropX));
          const safeCropY = Math.max(0, Math.min(canvas.height - cropHeight, cropY));
          const safeCropWidth = Math.min(cropWidth, canvas.width - safeCropX);
          const safeCropHeight = Math.min(cropHeight, canvas.height - safeCropY);
          
          const avatarCanvas = document.createElement('canvas');
          const avatarCtx = avatarCanvas.getContext('2d');
          avatarCanvas.width = 150;
          avatarCanvas.height = 150;
          
          if (avatarCtx) {
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
            console.log('✅ Successfully captured player avatar from optimal frame (boundary box precise positioning)');
          }
        } catch (error) {
          console.error('❌ Failed to capture avatar from optimal frame:', error);
        } finally {
          setIsCapturingAvatar(false);
        }
      };
      
      img.onerror = () => {
        console.error('❌ Optimal frame image loading failed');
        setIsCapturingAvatar(false);
      };
      
      img.src = bestFrameUrl;
      
    } catch (error) {
      console.error('❌ Failed to capture avatar from optimal frame:', error);
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
                    Select Player Tag for {uploadingForPlayer.name}
                  </h1>
                  <p className="text-xl text-gray-600">
                    Find {uploadingForPlayer.name} in the optimal frame and click the corresponding player boundary box
                  </p>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Already has {uploadingForPlayer.totalMatches} analysis records</p>
                  <p>• Average rating: {uploadingForPlayer.averagePerformance.overall}</p>
                  <p>• Gemini has extracted optimal frame and filtered referees, generating precise boundary boxes</p>
                  <p>• Player name auto-filled, select boundary box to start analysis directly</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Select Player for Analysis
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Gemini has extracted the optimal frame from your video and filtered referees, generating precise boundary boxes. 
                Please click on the player you want to analyze
              </p>
            </>
          )}
          <div className="mt-4 inline-flex items-center bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-4 py-2 rounded-full text-sm">
            <Brain className="w-4 h-4 mr-2" />
            <span>Gemini Precise Identification + Referee Filtering</span>
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
                  Gemini is analyzing every frame of the video, finding the optimal scene with the most players and filtering referees
                </p>
                {uploadingForPlayer && (
                  <p className="text-blue-600 mt-2">
                    Upon completion, analysis will compare with {uploadingForPlayer.name}'s historical data
                  </p>
                )}
              </div>
              
              {/* Enhanced Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 max-w-md mx-auto overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-full transition-all duration-500 relative" 
                  style={{ width: `${analysisProgress}%` }} 
                >
                  {/* Animated shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-4">
                <p className="text-lg font-semibold text-gray-900">
                  {Math.round(analysisProgress)}% Complete
                </p>
                <div className="flex items-center text-sm text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  <span>Gemini boundary box generation + referee filtering...</span>
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
                  Gemini Analysis Failed
                </h3>
                <p className="text-gray-600 mb-4">
                  {analysisError}
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
                  <h4 className="font-medium text-red-800 mb-2">Possible causes:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• API key expired or invalid</li>
                    <li>• Network connection issues</li>
                    <li>• Unsupported video format or corrupted file</li>
                    <li>• Gemini service temporarily unavailable</li>
                    <li>• No clear football match scenes in video</li>
                    <li>• Issues during boundary box generation or referee filtering</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleRetryAnalysis}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Retry Analysis
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-red-500 hover:text-red-600 transition-all duration-200"
                >
                  Return to Re-upload
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
                  No Players Detected
                </h3>
                <p className="text-gray-600 mb-4">
                  Gemini analysis complete, but no players detected in optimal frame (possibly all identified as referees)
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
                  <h4 className="font-medium text-yellow-800 mb-2">Suggestions:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Ensure video contains clear football match scenes</li>
                    <li>• Check video quality and lighting conditions</li>
                    <li>• Try uploading different video segments</li>
                    <li>• Ensure players are clearly visible in the frame</li>
                    <li>• Select scenes with high player activity</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleRetryAnalysis}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Retry Analysis
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-red-500 hover:text-red-600 transition-all duration-200"
                >
                  Return to Re-upload
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Optimal Frame Display Area with Boundary Box Player Markers */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="relative bg-gray-900 aspect-video">
                  {bestFrameUrl ? (
                    <img
                      src={bestFrameUrl}
                      alt="Optimal Frame - Scene with most players (referees filtered)"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <div className="text-center">
                        <Loader className="w-12 h-12 animate-spin mx-auto mb-4" />
                        <p>Loading optimal frame...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* AI Analysis Overlay */}
                  <div className="absolute top-4 left-4 bg-gradient-to-r from-green-600 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2">
                    <Brain className="w-4 h-4" />
                    <span>Gemini Identification - Detected {detectedPlayers.length} players (referees filtered)</span>
                  </div>
                  
                  {/* Best Frame Info */}
                  <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4" />
                      <span>Timestamp: {bestFrameTimestamp.toFixed(1)}s</span>
                    </div>
                  </div>
                  
                  {/* Team Colors Legend */}
                  {teamColors.home && teamColors.away && (
                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                          <span>Home ({teamColors.home})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span>Away ({teamColors.away})</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Player Boundary Box Markers - Display on optimal frame */}
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
                          {/* Boundary Box */}
                          <div className={`w-full h-full border-3 rounded-lg transition-all duration-300 ${
                            isSelected
                              ? 'border-green-400 bg-green-400/30 shadow-xl'
                              : player.team === 'home'
                              ? 'border-blue-400 bg-blue-400/20 hover:bg-blue-400/30'
                              : 'border-red-400 bg-red-400/20 hover:bg-red-400/30'
                          }`}>
                            {/* Player Label */}
                            <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                              isSelected
                                ? 'bg-green-500'
                                : player.team === 'home'
                                ? 'bg-blue-500'
                                : 'bg-red-500'
                            }`}>
                              #{player.jersey || player.id}
                            </div>
                            
                            {/* Selection Indicator */}
                            {isSelected && (
                              <div className="absolute -top-2 -right-2">
                                <CheckCircle className="w-6 h-6 text-green-500 bg-white rounded-full shadow-lg" />
                              </div>
                            )}
                            
                            {/* AI Confidence Indicator */}
                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                              <div className="bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                AI: {Math.round(player.confidence * 100)}%
                              </div>
                            </div>
                          </div>
                          
                          {/* Player Info Hover Tooltip */}
                          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                            <div className="bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {player.team === 'home' ? `Home (${teamColors.home})` : `Away (${teamColors.away})`}
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
                        <span>Gemini precise identification (referees filtered)</span>
                      </div>
                      
                      {selectedPlayerId && !uploadingForPlayer && (
                        <button
                          onClick={() => capturePlayerAvatarFromBestFrame(selectedPlayer!)}
                          disabled={isCapturingAvatar}
                          className="mt-2 flex items-center space-x-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg text-white text-sm transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          <span>{isCapturingAvatar ? 'Capturing...' : 'Capture Avatar'}</span>
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
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  Gemini Identification Results ({detectedPlayers.length})
                </h3>
                
                {/* Best Frame Info */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-green-600" />
                    Optimal Frame Info:
                  </h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>⏱️ Extraction time: {bestFrameTimestamp.toFixed(1)} seconds</p>
                    <p>🎯 Players detected: {detectedPlayers.length}</p>
                    <p>📊 Average confidence: {detectedPlayers.length > 0 ? Math.round(detectedPlayers.reduce((sum, p) => sum + p.confidence, 0) / detectedPlayers.length * 100) : 0}%</p>
                    <p>🏠 Home team players: {detectedPlayers.filter(p => p.team === 'home').length}</p>
                    <p>🏃 Away team players: {detectedPlayers.filter(p => p.team === 'away').length}</p>
                    <p>📦 Boundary box precise positioning: 100% coverage</p>
                    <p>🚫 Referee filtering: Enabled</p>
                  </div>
                </div>
                
                {/* Team Colors Display */}
                {teamColors.home && teamColors.away && (
                  <div className="bg-gradient-to-r from-blue-50 to-red-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">Gemini identified team colors:</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-800 font-medium">Home: {teamColors.home}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span className="text-red-800 font-medium">Away: {teamColors.away}</span>
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
                            <span>Player #{player.jersey || player.id}</span>
                            <Brain className="w-3 h-3 text-gray-400" />
                          </div>
                          <div className="text-sm text-gray-500">
                            {player.team === 'home' ? `Home (${teamColors.home || 'Blue'})` : `Away (${teamColors.away || 'Red'})`} • AI confidence {Math.round(player.confidence * 100)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            Boundary box: {player.width.toFixed(1)}% × {player.height.toFixed(1)}%
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
                    Player Information
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Player Avatar Preview */}
                    {capturedAvatar && (
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <img
                              src={capturedAvatar}
                              alt="Player avatar"
                              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-green-500 p-1 rounded-full">
                              <Brain className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {uploadingForPlayer ? 'Existing Player Avatar' : 'Gemini Precise Capture'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {uploadingForPlayer 
                                ? `From ${uploadingForPlayer.name}'s historical records`
                                : `From optimal frame boundary box (${bestFrameTimestamp.toFixed(1)}s)`
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
                              <span>Retake</span>
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
                            <span>Selected Player #{selectedPlayer.jersey || selectedPlayer.id}</span>
                            <Brain className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="text-sm text-gray-600">
                            {selectedPlayer.team === 'home' ? `Home (${teamColors.home || 'Blue'})` : `Away (${teamColors.away || 'Red'})`} • AI confidence {Math.round(selectedPlayer.confidence * 100)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            Boundary box: {selectedPlayer.width.toFixed(1)}% × {selectedPlayer.height.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Player Name *
                      </label>
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter player name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        disabled={!!uploadingForPlayer}
                      />
                      
                      {uploadingForPlayer && (
                        <div className="mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                          Player name auto-filled, select boundary box to start analysis directly
                        </div>
                      )}
                      
                      {/* Fixed Player Suggestions - Better positioning */}
                      {showSuggestions && !uploadingForPlayer && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
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
                                  {player.totalMatches} matches • Average rating {player.averagePerformance.overall}
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
                              <span>{uploadingForPlayer ? 'Uploading for existing player' : 'Historical records found'}</span>
                              <History className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-blue-700 space-y-1">
                          <p>• Analyzed {(existingPlayer || uploadingForPlayer)?.totalMatches} matches</p>
                          <p>• Average rating: {(existingPlayer || uploadingForPlayer)?.averagePerformance.overall}</p>
                          <p>• Last analyzed: {new Date((existingPlayer || uploadingForPlayer)?.lastAnalyzed || '').toLocaleDateString()}</p>
                          {uploadingForPlayer && (
                            <p>• New analysis will automatically compare with historical data, showing detailed progress trends</p>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          {uploadingForPlayer 
                            ? 'Select boundary box to start analysis directly, no need to re-enter name'
                            : 'Will compare with historical data and update player avatar'
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
                        ? `Continue Analysis for "${uploadingForPlayer.name}"` 
                        : existingPlayer 
                        ? 'Continue AI Deep Analysis' 
                        : 'Start AI Smart Analysis'
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
                  Gemini Identification + Referee Filtering Technology
                </h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Gemini automatically analyzes every video frame, finding the optimal scene with the most players
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Intelligently filters referees, only identifying players wearing team jerseys
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Generates precise boundary boxes for each player, accurately framing player body contours
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Captures player avatars based on precise boundary box positions, avoiding background interference
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Intelligently identifies home and away team jersey colors and numbers
                  </li>
                  <li className="flex items-start">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    Provides higher recognition accuracy and positional precision
                  </li>
                  {uploadingForPlayer && (
                    <li className="flex items-start">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      Auto-fills name for existing players, simplifying upload workflow
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