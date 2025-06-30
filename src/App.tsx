import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { databaseService } from './services/database';
import Auth from './components/Auth';
import Header from './components/Header';
import Hero from './components/Hero';
import VideoUpload from './components/VideoUpload';
import PlayerSelection from './components/PlayerSelection';
import Dashboard from './components/Dashboard';
import Features from './components/Features';
import PlayerDatabase from './components/PlayerDatabase';

export interface PlayerRecord {
  id?: string; // Make id optional since database will generate it
  name: string;
  totalMatches: number;
  firstAnalyzed: string;
  lastAnalyzed: string;
  avatar?: string;
  performanceHistory: PerformanceData[];
  averagePerformance: PerformanceData;
  improvements: string[];
  weaknesses: string[];
}

export interface PerformanceData {
  matchId: string;
  date: string;
  opponent?: string;
  overall: number;
  speed: number;
  passing: number;
  positioning: number;
  touches: number;
  distance: number;
  topSpeed: number;
  passAccuracy: number;
  dominantFoot: {
    right: number;
    left: number;
  };
}

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'home' | 'upload' | 'player-selection' | 'dashboard' | 'database'>('home');
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{id: number, name: string} | null>(null);
  const [playerDatabase, setPlayerDatabase] = useState<PlayerRecord[]>([]);
  const [existingPlayer, setExistingPlayer] = useState<PlayerRecord | null>(null);
  const [detectedPlayers, setDetectedPlayers] = useState<any[]>([]);
  const [uploadingForPlayer, setUploadingForPlayer] = useState<PlayerRecord | null>(null);
  const [dbError, setDbError] = useState<string>('');
  const [viewingPlayerHistory, setViewingPlayerHistory] = useState<boolean>(false); // 新增：标记是否在查看历史数据

  // 检查用户认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 检查用户认证状态...');
        
        // 先进行快速健康检查
        const isHealthy = await databaseService.quickHealthCheck();
        if (!isHealthy) {
          console.warn('⚠️ 数据库健康检查失败，但继续加载应用');
          setDbError('数据库连接不稳定，部分功能可能受影响');
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ 认证检查失败:', error);
          setDbError(`认证检查失败: ${error.message}`);
        } else {
          setUser(session?.user || null);
          
          if (session?.user) {
            console.log('✅ 用户已登录:', session.user.email);
            // 异步加载球员数据，不阻塞UI
            loadUserPlayers(session.user.id).catch(err => {
              console.error('❌ 异步加载球员数据失败:', err);
            });
          } else {
            console.log('ℹ️ 用户未登录');
          }
        }
      } catch (error) {
        console.error('❌ 认证检查异常:', error);
        setDbError(`认证检查异常: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        // 确保加载状态总是会结束
        setTimeout(() => {
          setLoading(false);
        }, 100);
      }
    };

    checkAuth();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 认证状态变化:', event, session?.user?.email);
      
      setUser(session?.user || null);
      
      if (session?.user) {
        // 异步加载球员数据
        loadUserPlayers(session.user.id).catch(err => {
          console.error('❌ 认证状态变化时加载球员数据失败:', err);
        });
      } else {
        setPlayerDatabase([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 加载用户的球员数据
  const loadUserPlayers = async (userId: string) => {
    try {
      console.log('📊 加载用户球员数据...');
      setDbError(''); // 清除之前的错误
      
      // 使用超时控制，避免无限等待
      const timeoutPromise = new Promise<PlayerRecord[]>((_, reject) => {
        setTimeout(() => reject(new Error('加载球员数据超时')), 15000); // 15秒超时
      });

      const loadPromise = databaseService.getUserPlayers(userId);
      
      const players = await Promise.race([loadPromise, timeoutPromise]);
      
      console.log('✅ 成功加载球员数据:', players.length, '名球员');
      setPlayerDatabase(players);
    } catch (error) {
      console.error('❌ 加载球员数据失败:', error);
      setDbError(`加载球员数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 不要阻止应用继续运行，设置空数组
      setPlayerDatabase([]);
    }
  };

  // 处理认证成功
  const handleAuthSuccess = () => {
    console.log('✅ 认证成功');
    setDbError(''); // 清除错误信息
    // 认证成功后会自动触发 onAuthStateChange
  };

  // 处理登出
  const handleSignOut = async () => {
    try {
      console.log('👋 用户登出...');
      await supabase.auth.signOut();
      setActiveView('home');
      setPlayerDatabase([]);
      setSelectedPlayer(null);
      setUploadedVideo(null);
      setExistingPlayer(null);
      setDetectedPlayers([]);
      setUploadingForPlayer(null);
      setDbError('');
      setViewingPlayerHistory(false);
    } catch (error) {
      console.error('❌ 登出失败:', error);
    }
  };

  const handleVideoUpload = (file: File) => {
    setUploadedVideo(file);
    setActiveView('player-selection');
  };

  const handlePlayerSelection = (playerId: number, playerName: string, playerAvatar?: string, players?: any[]) => {
    // 检查是否是为现有球员上传更多视频
    if (uploadingForPlayer) {
      // 为现有球员上传视频，直接使用现有球员信息
      setSelectedPlayer({ id: playerId, name: uploadingForPlayer.name });
      setExistingPlayer(uploadingForPlayer);
    } else {
      // 新的球员选择流程
      const existing = playerDatabase.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      
      if (existing) {
        setExistingPlayer(existing);
      } else {
        setExistingPlayer(null);
      }
      
      setSelectedPlayer({ id: playerId, name: playerName });
    }
    
    // 存储检测到的球员以避免重新分析
    if (players) {
      setDetectedPlayers(players);
    }
    
    setActiveView('dashboard');
  };

  const handleAnalysisComplete = async (performanceData: PerformanceData, playerName: string, playerAvatar?: string) => {
    if (!user) {
      console.error('❌ 用户未登录，无法保存数据');
      return;
    }

    const now = new Date().toISOString();
    
    try {
      console.log('💾 开始保存分析结果...');
      setDbError(''); // 清除之前的错误
      
      const existingIndex = playerDatabase.findIndex(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      
      if (existingIndex >= 0) {
        // 更新现有球员
        console.log('🔄 更新现有球员:', playerName);
        const existing = playerDatabase[existingIndex];
        const updatedHistory = [...existing.performanceHistory, performanceData];
        
        // 计算新的平均表现
        const avgPerformance = calculateAveragePerformance(updatedHistory);
        
        // 检测进步和需要改进的地方
        const improvements = detectImprovements(existing.performanceHistory, performanceData);
        const weaknesses = detectWeaknesses(performanceData);
        
        const updatedPlayer: PlayerRecord = {
          ...existing,
          totalMatches: existing.totalMatches + 1,
          lastAnalyzed: now,
          avatar: playerAvatar || existing.avatar,
          performanceHistory: updatedHistory,
          averagePerformance: avgPerformance,
          improvements,
          weaknesses
        };
        
        // 保存到数据库（异步，不阻塞UI）
        Promise.all([
          databaseService.savePlayerRecord(user.id, updatedPlayer),
          databaseService.savePerformanceRecord(existing.id!, performanceData)
        ]).then(([savedPlayer]) => {
          console.log('✅ 现有球员更新成功');
          // 更新本地状态
          const newDatabase = [...playerDatabase];
          newDatabase[existingIndex] = savedPlayer;
          setPlayerDatabase(newDatabase);
        }).catch(error => {
          console.error('❌ 保存现有球员失败:', error);
          setDbError(`保存数据失败: ${error.message}`);
        });
        
        // 立即更新UI，不等待数据库操作
        const newDatabase = [...playerDatabase];
        newDatabase[existingIndex] = updatedPlayer;
        setPlayerDatabase(newDatabase);
        
      } else {
        // 创建新球员记录
        console.log('➕ 创建新球员:', playerName);
        const newPlayer: PlayerRecord = {
          // Don't set id - let database generate it
          name: playerName,
          totalMatches: 1,
          firstAnalyzed: now,
          lastAnalyzed: now,
          avatar: playerAvatar,
          performanceHistory: [performanceData],
          averagePerformance: performanceData,
          improvements: [],
          weaknesses: detectWeaknesses(performanceData)
        };
        
        // 立即更新UI with temporary player
        const tempPlayer = { ...newPlayer, id: `temp_${Date.now()}` };
        setPlayerDatabase(prev => [...prev, tempPlayer]);
        
        // Save to database sequentially to get proper UUID
        try {
          // First save the player record to get the database-generated UUID
          const savedPlayer = await databaseService.savePlayerRecord(user.id, newPlayer);
          console.log('✅ 新球员创建成功，ID:', savedPlayer.id);
          
          // Then save the performance record with the actual player ID
          await databaseService.savePerformanceRecord(savedPlayer.id!, performanceData);
          console.log('✅ 表现记录保存成功');
          
          // Update local state with the actual saved player
          setPlayerDatabase(prev => 
            prev.map(p => p.id === tempPlayer.id ? savedPlayer : p)
          );
        } catch (error) {
          console.error('❌ 保存新球员失败:', error);
          setDbError(`保存数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
          // Remove the temporary player from UI on error
          setPlayerDatabase(prev => prev.filter(p => p.id !== tempPlayer.id));
        }
      }
      
      // 清理上传状态
      setUploadingForPlayer(null);
      
    } catch (error) {
      console.error('❌ 保存球员数据失败:', error);
      setDbError(`保存数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
      // 显示错误但不阻止应用继续运行
    }
  };

  // 处理为现有球员上传更多视频
  const handleUploadMoreVideos = (player: PlayerRecord) => {
    setUploadingForPlayer(player);
    setViewingPlayerHistory(false); // 重置历史查看状态
    setActiveView('upload');
  };

  // 处理删除球员
  const handleDeletePlayer = async (playerId: string) => {
    if (!user) return;

    try {
      console.log('🗑️ 删除球员:', playerId);
      setDbError(''); // 清除之前的错误
      
      // 立即更新UI
      setPlayerDatabase(prev => prev.filter(p => p.id !== playerId));
      
      // 异步删除数据库记录
      databaseService.deletePlayer(playerId).then(() => {
        console.log('✅ 球员删除成功');
      }).catch(error => {
        console.error('❌ 删除球员失败:', error);
        setDbError(`删除球员失败: ${error.message}`);
        // 如果删除失败，恢复数据
        loadUserPlayers(user.id);
      });
      
    } catch (error) {
      console.error('❌ 删除球员失败:', error);
      setDbError(`删除球员失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 新增：处理返回球员选择页面
  const handleReturnToPlayerSelection = () => {
    // 保持当前的视频和检测到的球员数据
    setActiveView('player-selection');
    // 重置选择状态，但保留检测数据
    setSelectedPlayer(null);
    setExistingPlayer(null);
    setViewingPlayerHistory(false);
    // 不清除 uploadedVideo 和 detectedPlayers，这样用户可以继续选择其他球员
  };

  const calculateAveragePerformance = (history: PerformanceData[]): PerformanceData => {
    const total = history.length;
    const sums = history.reduce((acc, curr) => ({
      overall: acc.overall + curr.overall,
      speed: acc.speed + curr.speed,
      passing: acc.passing + curr.passing,
      positioning: acc.positioning + curr.positioning,
      touches: acc.touches + curr.touches,
      distance: acc.distance + curr.distance,
      topSpeed: acc.topSpeed + curr.topSpeed,
      passAccuracy: acc.passAccuracy + curr.passAccuracy,
      dominantFoot: {
        right: acc.dominantFoot.right + curr.dominantFoot.right,
        left: acc.dominantFoot.left + curr.dominantFoot.left
      }
    }), {
      overall: 0, speed: 0, passing: 0, positioning: 0,
      touches: 0, distance: 0, topSpeed: 0, passAccuracy: 0,
      dominantFoot: { right: 0, left: 0 }
    });

    return {
      matchId: 'average',
      date: new Date().toISOString(), // Always use valid timestamp
      overall: Math.round(sums.overall / total),
      speed: Math.round(sums.speed / total),
      passing: Math.round(sums.passing / total),
      positioning: Math.round(sums.positioning / total),
      touches: Math.round(sums.touches / total),
      distance: Math.round((sums.distance / total) * 10) / 10,
      topSpeed: Math.round((sums.topSpeed / total) * 10) / 10,
      passAccuracy: Math.round(sums.passAccuracy / total),
      dominantFoot: {
        right: Math.round(sums.dominantFoot.right / total),
        left: Math.round(sums.dominantFoot.left / total)
      }
    };
  };

  const detectImprovements = (history: PerformanceData[], latest: PerformanceData): string[] => {
    if (history.length < 2) return [];
    
    const previous = history[history.length - 2];
    const improvements: string[] = [];
    
    if (latest.overall > previous.overall + 2) improvements.push('整体表现显著提升');
    if (latest.speed > previous.speed + 3) improvements.push('速度有明显进步');
    if (latest.passing > previous.passing + 3) improvements.push('传球技术改善');
    if (latest.positioning > previous.positioning + 3) improvements.push('位置感更好');
    if (latest.passAccuracy > previous.passAccuracy + 5) improvements.push('传球准确率提高');
    if (latest.topSpeed > previous.topSpeed + 1) improvements.push('最高速度突破');
    
    return improvements;
  };

  const detectWeaknesses = (performance: PerformanceData): string[] => {
    const weaknesses: string[] = [];
    
    if (performance.passing < 75) weaknesses.push('传球准确性需要加强');
    if (performance.speed < 80) weaknesses.push('速度训练可以增加');
    if (performance.positioning < 80) weaknesses.push('位置感有待提高');
    if (performance.passAccuracy < 85) weaknesses.push('传球成功率偏低');
    if (performance.dominantFoot.left < 30) weaknesses.push('弱脚使用频率较低');
    
    return weaknesses;
  };

  // 显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载...</p>
          {dbError && (
            <p className="text-red-600 text-sm mt-2">
              {dbError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 如果有数据库错误，显示错误信息但不阻止应用运行
  if (dbError && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">数据库连接问题：</strong>
            <span className="block sm:inline">{dbError}</span>
          </div>
          <p className="text-gray-600 mb-4">
            应用仍可正常使用，但数据可能无法保存。请检查网络连接或稍后重试。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 如果用户未登录，显示认证页面
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
      <Header 
        activeView={activeView} 
        onViewChange={setActiveView}
        user={user}
        onSignOut={handleSignOut}
      />
      
      {/* 显示数据库错误（如果有）但不阻止应用运行 */}
      {dbError && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">
                数据库连接问题：{dbError}。应用仍可使用，但数据可能无法保存。
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setDbError('')}
                className="text-yellow-500 hover:text-yellow-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <main className="relative">
        {activeView === 'home' && (
          <>
            <Hero onGetStarted={() => setActiveView('upload')} />
            <Features />
          </>
        )}
        
        {activeView === 'upload' && (
          <VideoUpload 
            onUploadComplete={handleVideoUpload}
            uploadingForPlayer={uploadingForPlayer}
          />
        )}
        
        {activeView === 'player-selection' && uploadedVideo && (
          <PlayerSelection 
            videoFile={uploadedVideo}
            onPlayerSelected={handlePlayerSelection}
            playerDatabase={playerDatabase}
            existingDetectedPlayers={detectedPlayers}
            uploadingForPlayer={uploadingForPlayer}
          />
        )}
        
        {activeView === 'dashboard' && selectedPlayer && (uploadedVideo || viewingPlayerHistory) && (
          <Dashboard 
            playerName={selectedPlayer.name}
            playerId={selectedPlayer.id}
            uploadedVideo={uploadedVideo}
            existingPlayer={existingPlayer}
            onAnalysisComplete={handleAnalysisComplete}
            detectedPlayers={detectedPlayers}
            viewingHistoryOnly={viewingPlayerHistory} // 新增：传递历史查看状态
            onReturnToPlayerSelection={uploadedVideo ? handleReturnToPlayerSelection : undefined} // 新增：只有在有视频时才显示返回按钮
          />
        )}
        
        {activeView === 'database' && (
          <PlayerDatabase 
            players={playerDatabase}
            onPlayerSelect={(player) => {
              setExistingPlayer(player);
              setSelectedPlayer({ id: 0, name: player.name });
              setViewingPlayerHistory(true); // 新增：设置为查看历史状态
              setUploadedVideo(null); // 清除视频，因为只是查看历史
              setDetectedPlayers([]); // 清除检测到的球员数据
              setActiveView('dashboard');
            }}
            onUploadMoreVideos={handleUploadMoreVideos}
            onDeletePlayer={handleDeletePlayer}
          />
        )}
      </main>
    </div>
  );
}

export default App;