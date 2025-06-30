import React, { useState } from 'react';
import { Search, User, TrendingUp, Calendar, Star, ArrowRight, Trophy, Target, History, Camera, Upload, Plus, Trash2, AlertCircle } from 'lucide-react';
import { PlayerRecord } from '../App';

interface PlayerDatabaseProps {
  players: PlayerRecord[];
  onPlayerSelect: (player: PlayerRecord) => void;
  onUploadMoreVideos: (player: PlayerRecord) => void;
  onDeletePlayer?: (playerId: string) => void;
}

const PlayerDatabase: React.FC<PlayerDatabaseProps> = ({ 
  players, 
  onPlayerSelect, 
  onUploadMoreVideos,
  onDeletePlayer 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'matches' | 'performance' | 'recent'>('recent');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredPlayers = players
    .filter(player => 
      player.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'matches':
          return b.totalMatches - a.totalMatches;
        case 'performance':
          return b.averagePerformance.overall - a.averagePerformance.overall;
        case 'recent':
        default:
          return new Date(b.lastAnalyzed).getTime() - new Date(a.lastAnalyzed).getTime();
      }
    });

  const getPerformanceColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'bg-green-500' };
    if (score >= 80) return { label: '良好', color: 'bg-blue-500' };
    if (score >= 70) return { label: '一般', color: 'bg-yellow-500' };
    return { label: '待提升', color: 'bg-red-500' };
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (onDeletePlayer) {
      await onDeletePlayer(playerId);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <section className="min-h-screen py-8 bg-gradient-to-br from-slate-50 to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">我的球员数据库</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            查看您所有已分析球员的历史记录、头像和表现趋势，支持云端同步
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-lg inline-block mb-3">
              <User className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{players.length}</div>
            <div className="text-gray-600">我的球员数</div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 p-3 rounded-lg inline-block mb-3">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {players.reduce((sum, p) => sum + p.totalMatches, 0)}
            </div>
            <div className="text-gray-600">总分析次数</div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-lg inline-block mb-3">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.averagePerformance.overall, 0) / players.length) : 0}
            </div>
            <div className="text-gray-600">平均评分</div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-3 rounded-lg inline-block mb-3">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {players.filter(p => p.avatar).length}
            </div>
            <div className="text-gray-600">有头像球员</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索球员姓名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="recent">最近分析</option>
              <option value="name">姓名排序</option>
              <option value="matches">分析次数</option>
              <option value="performance">表现评分</option>
            </select>
          </div>
        </div>

        {/* Players Grid */}
        {filteredPlayers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {players.length === 0 ? '暂无球员数据' : '未找到匹配的球员'}
            </h3>
            <p className="text-gray-600">
              {players.length === 0 ? '开始上传视频分析您的第一个球员' : '尝试调整搜索条件'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map((player) => {
              const badge = getPerformanceBadge(player.averagePerformance.overall);
              return (
                <div
                  key={player.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                >
                  {/* Player Header with Avatar */}
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 p-6 text-white relative">
                    {/* Delete Button */}
                    {onDeletePlayer && (
                      <button
                        onClick={() => setShowDeleteConfirm(player.id)}
                        className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="删除球员"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {player.avatar ? (
                          <div className="relative">
                            <img
                              src={player.avatar}
                              alt={player.name}
                              className="w-12 h-12 rounded-full object-cover border-3 border-white shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-green-400 p-1 rounded-full">
                              <Camera className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white/20 p-3 rounded-full">
                            <User className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-bold">{player.name}</h3>
                          <p className="text-white/80 text-sm">
                            {player.totalMatches} 场分析
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color} text-white`}>
                        {badge.label}
                      </span>
                    </div>
                    
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80 text-sm">平均评分</span>
                        <span className="text-2xl font-bold">{player.averagePerformance.overall}</span>
                      </div>
                    </div>
                  </div>

                  {/* Player Stats */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{player.averagePerformance.speed}</div>
                        <div className="text-sm text-gray-600">速度</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{player.averagePerformance.passing}</div>
                        <div className="text-sm text-gray-600">传球</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{player.averagePerformance.positioning}</div>
                        <div className="text-sm text-gray-600">位置感</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{player.averagePerformance.passAccuracy}%</div>
                        <div className="text-sm text-gray-600">传球率</div>
                      </div>
                    </div>

                    {/* Recent Improvements */}
                    {player.improvements.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">最近进步</span>
                        </div>
                        <div className="text-xs text-green-700">
                          {player.improvements.slice(0, 2).join(', ')}
                          {player.improvements.length > 2 && '...'}
                        </div>
                      </div>
                    )}

                    {/* Weaknesses */}
                    {player.weaknesses.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Target className="w-4 h-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">待改进</span>
                        </div>
                        <div className="text-xs text-orange-700">
                          {player.weaknesses.slice(0, 2).join(', ')}
                          {player.weaknesses.length > 2 && '...'}
                        </div>
                      </div>
                    )}

                    {/* Last Analysis */}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>上次分析</span>
                      </div>
                      <span>{new Date(player.lastAnalyzed).toLocaleDateString()}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <button
                        onClick={() => onPlayerSelect(player)}
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
                      >
                        查看详细分析
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </button>
                      
                      <button
                        onClick={() => onUploadMoreVideos(player)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        上传更多视频
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Performance Insights */}
        {players.length > 0 && (
          <div className="mt-12 bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <History className="w-6 h-6 mr-3 text-blue-600" />
              数据洞察
            </h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl">
                <h4 className="font-semibold text-green-800 mb-2">表现最佳球员</h4>
                <div className="flex items-center space-x-3 mb-2">
                  {(() => {
                    const bestPlayer = players.reduce((best, current) => 
                      current.averagePerformance.overall > best.averagePerformance.overall ? current : best
                    );
                    return (
                      <>
                        {bestPlayer.avatar ? (
                          <img
                            src={bestPlayer.avatar}
                            alt={bestPlayer.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-green-500"
                          />
                        ) : (
                          <div className="bg-green-500 p-2 rounded-full">
                            <User className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="text-xl font-bold text-green-900">{bestPlayer.name}</div>
                          <div className="text-sm text-green-700">
                            平均评分 {bestPlayer.averagePerformance.overall}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl">
                <h4 className="font-semibold text-blue-800 mb-2">最活跃球员</h4>
                <div className="flex items-center space-x-3 mb-2">
                  {(() => {
                    const mostActive = players.reduce((most, current) => 
                      current.totalMatches > most.totalMatches ? current : most
                    );
                    return (
                      <>
                        {mostActive.avatar ? (
                          <img
                            src={mostActive.avatar}
                            alt={mostActive.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-blue-500"
                          />
                        ) : (
                          <div className="bg-blue-500 p-2 rounded-full">
                            <User className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="text-xl font-bold text-blue-900">{mostActive.name}</div>
                          <div className="text-sm text-blue-700">
                            {mostActive.totalMatches} 场分析
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl">
                <h4 className="font-semibold text-purple-800 mb-2">进步最快球员</h4>
                <div className="flex items-center space-x-3 mb-2">
                  {(() => {
                    const mostImproved = players.reduce((most, current) => 
                      current.improvements.length > most.improvements.length ? current : most
                    );
                    return (
                      <>
                        {mostImproved.avatar ? (
                          <img
                            src={mostImproved.avatar}
                            alt={mostImproved.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-purple-500"
                          />
                        ) : (
                          <div className="bg-purple-500 p-2 rounded-full">
                            <User className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="text-xl font-bold text-purple-900">{mostImproved.name}</div>
                          <div className="text-sm text-purple-700">
                            {mostImproved.improvements.length} 项进步
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
              <div className="text-center">
                <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">确认删除球员</h3>
                <p className="text-gray-600 mb-6">
                  确定要删除这个球员的所有数据吗？此操作无法撤销。
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleDeletePlayer(showDeleteConfirm)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PlayerDatabase;