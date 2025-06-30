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
import DemoModal from './components/DemoModal';

export interface PlayerRecord {
  id?: string;
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
  const [viewingPlayerHistory, setViewingPlayerHistory] = useState<boolean>(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoVideoUrl, setDemoVideoUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Default demo URL

  // Check user authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 Checking user authentication status...');
        
        const isHealthy = await databaseService.quickHealthCheck();
        if (!isHealthy) {
          console.warn('⚠️ Database health check failed, but continuing to load app');
          setDbError('Database connection unstable, some features may be affected');
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Authentication check failed:', error);
          setDbError(`Authentication check failed: ${error.message}`);
        } else {
          setUser(session?.user || null);
          
          if (session?.user) {
            console.log('✅ User logged in:', session.user.email);
            loadUserPlayers(session.user.id).catch(err => {
              console.error('❌ Async player data loading failed:', err);
            });
          } else {
            console.log('ℹ️ User not logged in');
          }
        }
      } catch (error) {
        console.error('❌ Authentication check exception:', error);
        setDbError(`Authentication check exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 100);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Authentication state change:', event, session?.user?.email);
      
      setUser(session?.user || null);
      
      if (session?.user) {
        loadUserPlayers(session.user.id).catch(err => {
          console.error('❌ Failed to load player data on auth state change:', err);
        });
      } else {
        setPlayerDatabase([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserPlayers = async (userId: string) => {
    try {
      console.log('📊 Loading user player data...');
      setDbError('');
      
      const timeoutPromise = new Promise<PlayerRecord[]>((_, reject) => {
        setTimeout(() => reject(new Error('Player data loading timeout')), 15000);
      });

      const loadPromise = databaseService.getUserPlayers(userId);
      
      const players = await Promise.race([loadPromise, timeoutPromise]);
      
      console.log('✅ Successfully loaded player data:', players.length, 'players');
      setPlayerDatabase(players);
    } catch (error) {
      console.error('❌ Failed to load player data:', error);
      setDbError(`Failed to load player data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPlayerDatabase([]);
    }
  };

  const handleAuthSuccess = () => {
    console.log('✅ Authentication successful');
    setDbError('');
  };

  const handleSignOut = async () => {
    try {
      console.log('👋 User signing out...');
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
      console.error('❌ Sign out failed:', error);
    }
  };

  const handleVideoUpload = (file: File) => {
    setUploadedVideo(file);
    setActiveView('player-selection');
  };

  const handlePlayerSelection = (playerId: number, playerName: string, playerAvatar?: string, players?: any[]) => {
    if (uploadingForPlayer) {
      setSelectedPlayer({ id: playerId, name: uploadingForPlayer.name });
      setExistingPlayer(uploadingForPlayer);
    } else {
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
    
    if (players) {
      setDetectedPlayers(players);
    }
    
    setActiveView('dashboard');
  };

  const handleAnalysisComplete = async (performanceData: PerformanceData, playerName: string, playerAvatar?: string) => {
    if (!user) {
      console.error('❌ User not logged in, cannot save data');
      return;
    }

    const now = new Date().toISOString();
    
    try {
      console.log('💾 Starting to save analysis results...');
      setDbError('');
      
      const existingIndex = playerDatabase.findIndex(p => 
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      
      if (existingIndex >= 0) {
        console.log('🔄 Updating existing player:', playerName);
        const existing = playerDatabase[existingIndex];
        const updatedHistory = [...existing.performanceHistory, performanceData];
        
        const avgPerformance = calculateAveragePerformance(updatedHistory);
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
        
        Promise.all([
          databaseService.savePlayerRecord(user.id, updatedPlayer),
          databaseService.savePerformanceRecord(existing.id!, performanceData)
        ]).then(([savedPlayer]) => {
          console.log('✅ Existing player update successful');
          const newDatabase = [...playerDatabase];
          newDatabase[existingIndex] = savedPlayer;
          setPlayerDatabase(newDatabase);
        }).catch(error => {
          console.error('❌ Failed to save existing player:', error);
          setDbError(`Failed to save data: ${error.message}`);
        });
        
        const newDatabase = [...playerDatabase];
        newDatabase[existingIndex] = updatedPlayer;
        setPlayerDatabase(newDatabase);
        
      } else {
        console.log('➕ Creating new player:', playerName);
        const newPlayer: PlayerRecord = {
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
        
        const tempPlayer = { ...newPlayer, id: `temp_${Date.now()}` };
        setPlayerDatabase(prev => [...prev, tempPlayer]);
        
        try {
          const savedPlayer = await databaseService.savePlayerRecord(user.id, newPlayer);
          console.log('✅ New player created successfully, ID:', savedPlayer.id);
          
          await databaseService.savePerformanceRecord(savedPlayer.id!, performanceData);
          console.log('✅ Performance record saved successfully');
          
          setPlayerDatabase(prev => 
            prev.map(p => p.id === tempPlayer.id ? savedPlayer : p)
          );
        } catch (error) {
          console.error('❌ Failed to save new player:', error);
          setDbError(`Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setPlayerDatabase(prev => prev.filter(p => p.id !== tempPlayer.id));
        }
      }
      
      setUploadingForPlayer(null);
      
    } catch (error) {
      console.error('❌ Failed to save player data:', error);
      setDbError(`Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUploadMoreVideos = (player: PlayerRecord) => {
    setUploadingForPlayer(player);
    setViewingPlayerHistory(false);
    setActiveView('upload');
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!user) return;

    try {
      console.log('🗑️ Deleting player:', playerId);
      setDbError('');
      
      setPlayerDatabase(prev => prev.filter(p => p.id !== playerId));
      
      databaseService.deletePlayer(playerId).then(() => {
        console.log('✅ Player deleted successfully');
      }).catch(error => {
        console.error('❌ Failed to delete player:', error);
        setDbError(`Failed to delete player: ${error.message}`);
        loadUserPlayers(user.id);
      });
      
    } catch (error) {
      console.error('❌ Failed to delete player:', error);
      setDbError(`Failed to delete player: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleReturnToPlayerSelection = () => {
    setActiveView('player-selection');
    setSelectedPlayer(null);
    setExistingPlayer(null);
    setViewingPlayerHistory(false);
  };

  const handleWatchDemo = () => {
    setShowDemoModal(true);
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
      date: new Date().toISOString(),
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
    
    if (latest.overall > previous.overall + 2) improvements.push('Overall performance significantly improved');
    if (latest.speed > previous.speed + 3) improvements.push('Speed showed notable progress');
    if (latest.passing > previous.passing + 3) improvements.push('Passing technique improved');
    if (latest.positioning > previous.positioning + 3) improvements.push('Positioning sense enhanced');
    if (latest.passAccuracy > previous.passAccuracy + 5) improvements.push('Pass accuracy increased');
    if (latest.topSpeed > previous.topSpeed + 1) improvements.push('Top speed breakthrough');
    
    return improvements;
  };

  const detectWeaknesses = (performance: PerformanceData): string[] => {
    const weaknesses: string[] = [];
    
    if (performance.passing < 75) weaknesses.push('Passing accuracy needs strengthening');
    if (performance.speed < 80) weaknesses.push('Speed training can be increased');
    if (performance.positioning < 80) weaknesses.push('Positioning sense needs improvement');
    if (performance.passAccuracy < 85) weaknesses.push('Pass success rate is low');
    if (performance.dominantFoot.left < 30) weaknesses.push('Weak foot usage frequency is low');
    
    return weaknesses;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          {dbError && (
            <p className="text-red-600 text-sm mt-2">
              {dbError}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (dbError && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Database Connection Issue:</strong>
            <span className="block sm:inline">{dbError}</span>
          </div>
          <p className="text-gray-600 mb-4">
            App can still be used normally, but data may not be saved. Please check network connection or try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

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
                Database connection issue: {dbError}. App can still be used, but data may not be saved.
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
            <Hero onGetStarted={() => setActiveView('upload')} onWatchDemo={handleWatchDemo} />
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
            viewingHistoryOnly={viewingPlayerHistory}
            onReturnToPlayerSelection={uploadedVideo ? handleReturnToPlayerSelection : undefined}
          />
        )}
        
        {activeView === 'database' && (
          <PlayerDatabase 
            players={playerDatabase}
            onPlayerSelect={(player) => {
              setExistingPlayer(player);
              setSelectedPlayer({ id: 0, name: player.name });
              setViewingPlayerHistory(true);
              setUploadedVideo(null);
              setDetectedPlayers([]);
              setActiveView('dashboard');
            }}
            onUploadMoreVideos={handleUploadMoreVideos}
            onDeletePlayer={handleDeletePlayer}
          />
        )}
      </main>

      {/* Demo Modal */}
      <DemoModal 
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        videoUrl={demoVideoUrl}
      />
    </div>
  );
}

export default App;