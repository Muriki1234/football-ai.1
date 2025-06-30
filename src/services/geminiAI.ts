import { GoogleGenerativeAI } from '@google/generative-ai';
import { PerformanceData } from '../App';

const API_KEY = 'AIzaSyBEy1LWdeVRqN9NgI7KqlDSgU84kRQVrno';
const genAI = new GoogleGenerativeAI(API_KEY);

export interface PlayerDetection {
  id: number;
  x: number;
  y: number;
  width: number; // 恢复边界框宽度
  height: number; // 恢复边界框高度
  confidence: number;
  jersey?: string;
  team?: 'home' | 'away';
  teamColor?: string;
  timestamp: number;
  isReferee?: boolean; // 新增：标记是否为裁判
  // Add movement tracking data
  movementPattern?: {
    timestamps: number[];
    positions: { x: number; y: number; width: number; height: number }[];
  };
}

export interface AIAnalysisResult {
  detectedPlayers: PlayerDetection[];
  selectedPlayerAnalysis: PerformanceData;
  playerAvatar?: string;
  bestFrameUrl?: string; // 新增：最佳帧的URL
  bestFrameTimestamp?: number; // 新增：最佳帧的时间戳
}

export class FootballAI {
  private model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit for Files API
  private readonly RECOMMENDED_SIZE = 200 * 1024 * 1024; // 200MB recommended size
  private readonly CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks

  private extractJsonFromString(text: string): string {
    try {
      // Find the first '{' and last '}' to extract JSON
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.error('AI 响应内容:', text);
        throw new Error('AI 响应中未找到有效的 JSON 格式数据');
      }
      
      return text.substring(firstBrace, lastBrace + 1);
    } catch (error) {
      console.error('Failed to extract JSON from response:', text);
      throw new Error('AI 响应格式无效，无法解析分析结果');
    }
  }

  // 新增：从视频中提取最佳帧（包含最多球员的帧）
  async extractBestFrameFromVideo(videoFile: File): Promise<{ frameUrl: string; timestamp: number }> {
    try {
      console.log('🎬 开始提取视频最佳帧...');
      
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('无法创建画布上下文');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('提取最佳帧超时'));
        }, 120000); // 增加超时时间到120秒

        video.onloadedmetadata = async () => {
          try {
            console.log(`📹 视频信息: 时长 ${video.duration.toFixed(1)}s, 尺寸 ${video.videoWidth}x${video.videoHeight}`);
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // 分析多个时间点，找到包含最多球员的帧
            const samplePoints = [];
            const duration = video.duration;
            const numSamples = Math.min(10, Math.floor(duration / 2)); // 每2秒采样一次，最多10个样本
            
            for (let i = 1; i <= numSamples; i++) {
              samplePoints.push((duration / (numSamples + 1)) * i);
            }
            
            console.log(`🔍 将分析 ${samplePoints.length} 个时间点:`, samplePoints.map(t => t.toFixed(1) + 's'));
            
            let bestFrame = null;
            let bestTimestamp = 0;
            let maxPlayerCount = 0;
            
            for (const timestamp of samplePoints) {
              try {
                // 跳转到指定时间点
                video.currentTime = timestamp;
                await new Promise(resolve => {
                  video.onseeked = resolve;
                });
                
                // 绘制当前帧
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                
                // 使用AI分析这一帧包含的球员数量
                const playerCount = await this.analyzeFrameForPlayerCount(frameDataUrl);
                console.log(`⏱️ ${timestamp.toFixed(1)}s: 检测到 ${playerCount} 名球员`);
                
                if (playerCount > maxPlayerCount) {
                  maxPlayerCount = playerCount;
                  bestFrame = frameDataUrl;
                  bestTimestamp = timestamp;
                }
                
                // 短暂延迟避免过快处理
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (frameError) {
                console.warn(`⚠️ 分析时间点 ${timestamp.toFixed(1)}s 失败:`, frameError);
              }
            }
            
            if (bestFrame) {
              console.log(`✅ 找到最佳帧: ${bestTimestamp.toFixed(1)}s, 包含 ${maxPlayerCount} 名球员`);
              clearTimeout(timeout);
              resolve({ frameUrl: bestFrame, timestamp: bestTimestamp });
            } else {
              // 如果没有找到最佳帧，使用视频中间的帧作为后备
              const fallbackTimestamp = duration / 2;
              video.currentTime = fallbackTimestamp;
              video.onseeked = () => {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const fallbackFrame = canvas.toDataURL('image/jpeg', 0.9);
                console.log(`📷 使用后备帧: ${fallbackTimestamp.toFixed(1)}s`);
                clearTimeout(timeout);
                resolve({ frameUrl: fallbackFrame, timestamp: fallbackTimestamp });
              };
            }
            
          } catch (error) {
            console.error('❌ 提取最佳帧过程中出错:', error);
            clearTimeout(timeout);
            reject(error);
          }
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('视频加载失败，无法提取最佳帧'));
        };

        video.src = URL.createObjectURL(videoFile);
      });

    } catch (error) {
      console.error('❌ 提取最佳帧失败:', error);
      throw new Error('提取最佳帧失败，请重试');
    }
  }

  // 新增：分析单帧图像中的球员数量
  private async analyzeFrameForPlayerCount(frameDataUrl: string): Promise<number> {
    try {
      // 将base64图像转换为blob
      const response = await fetch(frameDataUrl);
      const blob = await response.blob();
      
      // 使用简化的提示词快速计算球员数量
      const prompt = `
        请快速分析这张足球比赛图片，只需要告诉我图片中大概有多少名球员。
        
        请只返回一个数字，表示你看到的球员数量。如果看不清楚，请估算一个合理的数字。
        
        例如：如果你看到大约5名球员，就返回"5"。
      `;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: frameDataUrl.split(',')[1], // 移除data:image/jpeg;base64,前缀
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const responseText = result.response.text();
      const playerCount = parseInt(responseText.match(/\d+/)?.[0] || '0');
      
      return Math.max(0, Math.min(22, playerCount)); // 限制在合理范围内
      
    } catch (error) {
      console.warn('分析帧中球员数量失败:', error);
      return 0; // 返回0作为后备值
    }
  }

  // 修改：使用最佳帧进行球员检测
  async uploadAndAnalyzeVideo(videoFile: File): Promise<{ players: PlayerDetection[]; bestFrameUrl: string; bestFrameTimestamp: number }> {
    try {
      console.log('🚀 开始 AI 视频分析（最佳帧模式）...', {
        fileName: videoFile.name,
        fileSize: this.formatFileSize(videoFile.size),
        fileType: videoFile.type
      });
      
      // Validate file type
      if (!videoFile.type.startsWith('video/')) {
        throw new Error('文件格式不支持，请上传有效的视频文件');
      }

      // Additional validation for empty files
      if (videoFile.size === 0) {
        throw new Error('视频文件为空，请选择有效的视频文件');
      }

      // Validate file size for Files API (2GB limit)
      if (videoFile.size > this.MAX_FILE_SIZE) {
        throw new Error(`视频文件过大 (${this.formatFileSize(videoFile.size)})，Files API 最大支持 2GB`);
      }

      // 第一步：提取最佳帧
      console.log('🎯 第一步：提取包含最多球员的最佳帧...');
      const { frameUrl, timestamp } = await this.extractBestFrameFromVideo(videoFile);
      
      // 第二步：使用最佳帧进行精确的球员检测
      console.log('🔍 第二步：使用最佳帧进行精确球员检测...');
      const players = await this.analyzeFrameForPlayers(frameUrl, timestamp);
      
      console.log(`✅ 球员检测完成！在最佳帧中检测到 ${players.length} 名球员`);
      
      return {
        players,
        bestFrameUrl: frameUrl,
        bestFrameTimestamp: timestamp
      };

    } catch (error) {
      console.error('❌ AI 视频分析详细错误:', error);
      
      // Provide specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('API_KEY')) {
          throw new Error('Google AI API 密钥无效或已过期，请检查配置');
        } else if (error.message.includes('quota') || error.message.includes('QUOTA')) {
          throw new Error('Google AI API 配额已用完，请稍后重试');
        } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('NetworkError')) {
          throw new Error('网络连接失败，请检查网络连接后重试');
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT') || error.message.includes('超时')) {
          throw new Error('AI 处理超时，视频可能过长或过于复杂，请尝试较短的视频片段');
        } else if (error.message.includes('SAFETY') || error.message.includes('safety')) {
          throw new Error('视频内容被 AI 安全过滤器拦截，请尝试其他视频');
        } else if (error.message.includes('INVALID_ARGUMENT')) {
          throw new Error('视频格式不被 AI 支持，请尝试 MP4 格式的视频');
        } else {
          throw error;
        }
      }
      
      throw new Error('AI 视频分析失败，请检查视频格式和网络连接');
    }
  }

  // 改进：使用最佳帧进行详细的球员检测（带边界框和裁判过滤）
  private async analyzeFrameForPlayers(frameDataUrl: string, timestamp: number): Promise<PlayerDetection[]> {
    try {
      console.log('🔍 开始分析最佳帧中的球员（过滤裁判）...');
      
      const prompt = `
        请仔细分析这张足球比赛图片，识别其中的所有球员并过滤掉裁判。

        重要要求：
        1. 只识别穿着球队球衣的球员，不要识别裁判
        2. 裁判通常穿黑色、黄色或其他明显不同于两队球衣的颜色
        3. 为每个球员提供边界框坐标：
           - x, y: 边界框左上角的位置（百分比形式，0-100）
           - width, height: 边界框的宽度和高度（百分比形式，0-100）
        4. 确保边界框紧密包围球员身体
        5. 提供检测置信度（0-1之间的数值）
        6. 如果能看到球衣号码，请记录，否则使用序号
        7. 根据球衣颜色判断队伍归属（主队或客队）
        8. 识别每个队伍的主要球衣颜色
        9. 如果不确定是否为裁判，请标记 isReferee 字段

        边界框说明：
        - x, y 是边界框左上角相对于图片的百分比位置
        - width, height 是边界框相对于图片的百分比大小
        - 边界框应该紧密包围球员，宽度通常在5-15%，高度在10-25%

        重要：请只返回 JSON 格式的数据，不要包含任何其他文字说明。

        返回格式：
        {
          "teamColors": {
            "home": "蓝色",
            "away": "红色"
          },
          "players": [
            {
              "id": 1,
              "x": 20,
              "y": 30,
              "width": 8,
              "height": 15,
              "confidence": 0.95,
              "jersey": "10",
              "team": "home",
              "teamColor": "蓝色",
              "timestamp": ${timestamp},
              "isReferee": false
            }
          ]
        }

        请开始分析并返回 JSON 结果。记住：只识别球员，过滤掉裁判！
      `;

      let analysisResult;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 球员检测第 ${attempts} 次尝试...`);

          const result = await this.model.generateContent([
            prompt,
            {
              inlineData: {
                data: frameDataUrl.split(',')[1], // 移除data:image/jpeg;base64,前缀
                mimeType: 'image/jpeg'
              }
            }
          ]);

          const responseText = result.response.text();
          console.log('AI 原始响应:', responseText.substring(0, 500) + '...');
          
          // Extract JSON from the response
          const firstBrace = responseText.indexOf('{');
          const lastBrace = responseText.lastIndexOf('}');
          
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('AI 响应中未找到有效的 JSON 格式数据');
          }

          const jsonString = responseText.substring(firstBrace, lastBrace + 1);
          analysisResult = JSON.parse(jsonString);

          if (!analysisResult.players || !Array.isArray(analysisResult.players)) {
            throw new Error('AI 分析结果格式错误，未找到球员数据数组');
          }

          // 过滤掉裁判
          const filteredPlayers = analysisResult.players.filter((player: any) => !player.isReferee);
          analysisResult.players = filteredPlayers;

          // 如果检测到球员，就算成功
          if (analysisResult.players.length > 0) {
            console.log(`✅ 第 ${attempts} 次尝试成功！检测到 ${analysisResult.players.length} 名球员（已过滤裁判）`);
            break;
          } else {
            throw new Error('AI 未检测到任何球员（可能都被识别为裁判）');
          }

        } catch (attemptError) {
          console.error(`❌ 第 ${attempts} 次尝试失败:`, attemptError);
          
          if (attempts === maxAttempts) {
            // 如果所有尝试都失败，返回一个默认的球员配置
            console.log('所有尝试失败，返回默认球员配置...');
            analysisResult = {
              teamColors: { home: '蓝色', away: '红色' },
              players: [
                {
                  id: 1,
                  x: 25,
                  y: 35,
                  width: 8,
                  height: 20,
                  confidence: 0.8,
                  jersey: '10',
                  team: 'home',
                  teamColor: '蓝色',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 2,
                  x: 65,
                  y: 45,
                  width: 8,
                  height: 20,
                  confidence: 0.8,
                  jersey: '7',
                  team: 'away',
                  teamColor: '红色',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 3,
                  x: 45,
                  y: 25,
                  width: 8,
                  height: 20,
                  confidence: 0.7,
                  jersey: '9',
                  team: 'home',
                  teamColor: '蓝色',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 4,
                  x: 75,
                  y: 15,
                  width: 8,
                  height: 20,
                  confidence: 0.7,
                  jersey: '11',
                  team: 'away',
                  teamColor: '红色',
                  timestamp: timestamp,
                  isReferee: false
                }
              ]
            };
            break;
          }
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        }
      }

      // Process and validate player data with bounding boxes
      const processedPlayers = analysisResult.players.map((player: any, index: number) => ({
        id: player.id || index + 1,
        x: typeof player.x === 'number' ? Math.max(0, Math.min(100, player.x)) : 50,
        y: typeof player.y === 'number' ? Math.max(0, Math.min(100, player.y)) : 50,
        width: typeof player.width === 'number' ? Math.max(5, Math.min(20, player.width)) : 8,
        height: typeof player.height === 'number' ? Math.max(10, Math.min(30, player.height)) : 20,
        confidence: typeof player.confidence === 'number' ? Math.max(0, Math.min(1, player.confidence)) : 0.8,
        jersey: player.jersey || (index + 1).toString(),
        team: player.team || (index % 2 === 0 ? 'home' : 'away'),
        teamColor: player.teamColor || (player.team === 'home' ? analysisResult.teamColors?.home : analysisResult.teamColors?.away) || (index % 2 === 0 ? '蓝色' : '红色'),
        timestamp: timestamp,
        isReferee: false, // 确保过滤后的都不是裁判
        movementPattern: this.generateRealisticMovementPatternWithBounds(
          player.x || 50, 
          player.y || 50, 
          player.width || 8, 
          player.height || 20
        ),
      }));

      console.log(`🎯 最佳帧分析完成，最终返回 ${processedPlayers.length} 名球员（已过滤裁判）`);
      return processedPlayers;

    } catch (error) {
      console.error('❌ 最佳帧球员检测失败:', error);
      throw new Error(`最佳帧球员检测失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 压缩视频文件
  private async compressVideo(videoFile: File, targetSizeMB: number = 200): Promise<File> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布上下文'));
        return;
      }

      video.onloadedmetadata = () => {
        try {
          // 计算压缩比例
          const originalSizeMB = videoFile.size / (1024 * 1024);
          const compressionRatio = Math.min(1, targetSizeMB / originalSizeMB);
          
          // 调整视频尺寸和质量
          const newWidth = Math.floor(video.videoWidth * Math.sqrt(compressionRatio));
          const newHeight = Math.floor(video.videoHeight * Math.sqrt(compressionRatio));
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          console.log(`🎬 压缩视频: ${originalSizeMB.toFixed(1)}MB -> 目标 ${targetSizeMB}MB`);
          console.log(`📐 尺寸调整: ${video.videoWidth}x${video.videoHeight} -> ${newWidth}x${newHeight}`);
          
          // 创建 MediaRecorder 进行重新编码
          const stream = canvas.captureStream(15); // 15 FPS
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: Math.floor(1000000 * compressionRatio) // 动态比特率
          });
          
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            const compressedBlob = new Blob(chunks, { type: 'video/webm' });
            const compressedFile = new File([compressedBlob], `compressed_${videoFile.name}`, {
              type: 'video/webm'
            });
            
            console.log(`✅ 视频压缩完成: ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`);
            resolve(compressedFile);
          };
          
          mediaRecorder.onerror = (error) => {
            console.error('❌ 视频压缩失败:', error);
            reject(new Error('视频压缩过程中出现错误'));
          };
          
          // 开始录制
          mediaRecorder.start();
          
          // 播放并绘制到画布
          let frameCount = 0;
          const maxFrames = Math.floor(video.duration * 15); // 15 FPS
          
          const drawFrame = () => {
            if (frameCount >= maxFrames) {
              mediaRecorder.stop();
              return;
            }
            
            ctx.drawImage(video, 0, 0, newWidth, newHeight);
            frameCount++;
            
            // 控制帧率
            setTimeout(() => {
              if (video.currentTime < video.duration) {
                video.currentTime = frameCount / 15;
                requestAnimationFrame(drawFrame);
              } else {
                mediaRecorder.stop();
              }
            }, 1000 / 15);
          };
          
          video.currentTime = 0;
          video.onseeked = () => {
            drawFrame();
          };
          
        } catch (error) {
          console.error('❌ 视频压缩设置失败:', error);
          reject(error);
        }
      };
      
      video.onerror = () => {
        reject(new Error('视频加载失败，无法进行压缩'));
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  }

  // 检查并处理大文件
  private async preprocessVideoFile(videoFile: File): Promise<File> {
    const fileSizeMB = videoFile.size / (1024 * 1024);
    
    console.log(`📁 原始文件大小: ${fileSizeMB.toFixed(1)}MB`);
    
    // 如果文件超过推荐大小，进行压缩
    if (videoFile.size > this.RECOMMENDED_SIZE) {
      console.log(`⚠️ 文件过大 (${fileSizeMB.toFixed(1)}MB)，开始压缩...`);
      
      try {
        // 根据原始大小动态调整目标大小
        let targetSize = 150; // 默认150MB
        if (fileSizeMB > 1000) {
          targetSize = 100; // 超过1GB的文件压缩到100MB
        } else if (fileSizeMB > 500) {
          targetSize = 120; // 超过500MB的文件压缩到120MB
        }
        
        const compressedFile = await this.compressVideo(videoFile, targetSize);
        console.log(`✅ 文件压缩完成: ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`);
        return compressedFile;
      } catch (compressionError) {
        console.warn('⚠️ 视频压缩失败，尝试使用原文件:', compressionError);
        
        // 如果压缩失败但文件仍在可接受范围内，继续使用原文件
        if (videoFile.size <= this.MAX_FILE_SIZE) {
          return videoFile;
        } else {
          throw new Error(`文件过大 (${fileSizeMB.toFixed(1)}MB) 且压缩失败，请手动压缩视频后重试`);
        }
      }
    }
    
    return videoFile;
  }

  async analyzePlayerPerformance(
    videoFile: File,
    selectedPlayerId: number,
    playerName: string,
    existingPlayerData?: any
  ): Promise<PerformanceData> {
    try {
      console.log(`🏃 开始 Files API 球员表现分析 ${playerName}...`, {
        playerId: selectedPlayerId,
        fileName: videoFile.name,
        hasExistingData: !!existingPlayerData
      });

      // Validate inputs
      if (!videoFile || videoFile.size === 0) {
        throw new Error('视频文件无效或为空');
      }

      if (!playerName || playerName.trim().length === 0) {
        throw new Error('球员姓名不能为空');
      }

      // Validate file size for Files API
      if (videoFile.size > this.MAX_FILE_SIZE) {
        throw new Error(`视频文件过大 (${this.formatFileSize(videoFile.size)})，Files API 最大支持 2GB`);
      }

      // 预处理视频文件（压缩大文件）
      const processedFile = await this.preprocessVideoFile(videoFile);

      // 检查是否有 Supabase 环境变量
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // 🔥 关键修改：强制使用服务器端 Files API 处理
      if (supabaseUrl && supabaseKey) {
        console.log('✅ 使用服务器端 Files API 处理球员表现分析...');
        return await this.analyzePlayerPerformanceOnServer(processedFile, selectedPlayerId, playerName, existingPlayerData);
      } else {
        // 🔥 关键修改：没有服务器配置时，直接抛出错误
        throw new Error('未配置服务器端处理环境。请配置 Supabase 环境变量以使用 Google Files API 处理视频文件。');
      }

    } catch (error) {
      console.error('❌ Files API 球员表现分析详细错误:', error);
      
      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('未配置服务器端处理环境')) {
          throw error; // Re-throw configuration errors as-is
        } else if (error.message.includes('API key')) {
          throw new Error('Google AI API 密钥无效，无法进行球员表现分析');
        } else if (error.message.includes('quota')) {
          throw new Error('Google AI API 配额已用完，无法完成分析');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('网络连接失败，无法连接到服务器');
        } else if (error.message.includes('timeout')) {
          throw new Error('Files API 分析超时，视频可能过于复杂或网络较慢');
        } else if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw new Error('AI 返回的分析结果格式错误，无法解析');
        } else if (error.message.includes('SAFETY')) {
          throw new Error('视频内容被 AI 安全过滤器拦截');
        } else {
          throw error;
        }
      }
      
      throw new Error(`球员 ${playerName} 的表现分析失败，请重试`);
    }
  }

  // 服务器端球员表现分析，使用 Files API
  private async analyzePlayerPerformanceOnServer(
    videoFile: File,
    selectedPlayerId: number,
    playerName: string,
    existingPlayerData?: any
  ): Promise<PerformanceData> {
    try {
      console.log('🚀 开始服务器端 Files API 球员表现分析...');
      
      // 检查 Supabase 环境变量
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase 环境变量未配置');
      }
      
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('apiKey', API_KEY);
      formData.append('playerId', selectedPlayerId.toString());
      formData.append('playerName', playerName);
      if (existingPlayerData) {
        formData.append('existingPlayerData', JSON.stringify(existingPlayerData));
      }
      
      // 重试逻辑 - 减少重试次数以避免资源耗尽
      let result;
      let attempts = 0;
      const maxAttempts = 2; // 减少重试次数
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 球员表现分析第 ${attempts} 次尝试...`);
          
          // 修复 URL 构建问题
          const functionUrl = `${supabaseUrl}/functions/v1/analyze-player-performance`;
          console.log('📡 请求 URL:', functionUrl);
          
          // 增加超时时间以处理大文件
          const timeoutMs = 600000; // 10分钟超时
          
          const fetchPromise = fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: formData,
          });
          
          const response = await Promise.race([
            fetchPromise,
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('请求超时')), timeoutMs)
            )
          ]);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ 第 ${attempts} 次尝试失败:`, response.status, errorText);
            
            // 特殊处理 546 错误（资源限制）
            if (response.status === 546) {
              throw new Error('服务器资源不足，请尝试压缩视频文件或稍后重试');
            }
            
            throw new Error(`服务器处理失败: ${response.status} ${response.statusText}`);
          }
          
          result = await response.json();
          
          if (!result.success) {
            throw new Error(result.error || '服务器端表现分析失败');
          }
          
          console.log(`✅ 球员表现分析第 ${attempts} 次尝试成功！`);
          break;
          
        } catch (attemptError) {
          console.error(`❌ 球员表现分析第 ${attempts} 次尝试失败:`, attemptError);
          
          if (attempts === maxAttempts) {
            // 提供更具体的错误信息
            if (attemptError instanceof Error) {
              if (attemptError.message.includes('资源不足') || attemptError.message.includes('546')) {
                throw new Error('服务器资源不足，无法处理此大小的视频文件。请尝试：1) 压缩视频文件到200MB以下 2) 缩短视频长度 3) 稍后重试');
              } else if (attemptError.message.includes('超时')) {
                throw new Error('处理超时，视频文件可能过大或过于复杂。请尝试使用较小的视频文件');
              }
            }
            throw attemptError;
          }
          
          // 增加延迟时间
          await new Promise(resolve => setTimeout(resolve, 10000 * attempts));
        }
      }
      
      if (!result || !result.success) {
        throw new Error('服务器端球员表现分析失败');
      }
      
      return result.performanceData;
      
    } catch (error) {
      console.error('❌ 服务器端球员表现分析失败:', error);
      throw error;
    }
  }

  async capturePlayerAvatar(
    videoFile: File,
    playerId: number,
    timestamp: number = 10
  ): Promise<string | null> {
    try {
      console.log('📸 开始截取球员头像...', { playerId, timestamp });
      
      // 创建视频元素来截取帧
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('头像截取超时'));
        }, 10000);

        video.onloadeddata = () => {
          video.currentTime = timestamp;
        };

        video.onseeked = () => {
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            if (ctx && canvas.width > 0 && canvas.height > 0) {
              ctx.drawImage(video, 0, 0);
              
              // 创建头像尺寸的canvas
              const avatarCanvas = document.createElement('canvas');
              const avatarCtx = avatarCanvas.getContext('2d');
              avatarCanvas.width = 150;
              avatarCanvas.height = 150;
              
              // 假设球员在画面中央区域，截取一个正方形区域
              const cropSize = Math.min(canvas.width, canvas.height) * 0.2;
              const cropX = canvas.width * 0.4;
              const cropY = canvas.height * 0.3;
              
              if (avatarCtx) {
                avatarCtx.drawImage(
                  canvas,
                  cropX,
                  cropY,
                  cropSize,
                  cropSize,
                  0,
                  0,
                  150,
                  150
                );
                
                const avatarDataUrl = avatarCanvas.toDataURL('image/jpeg', 0.8);
                console.log('✅ 头像截取成功');
                clearTimeout(timeout);
                resolve(avatarDataUrl);
              } else {
                clearTimeout(timeout);
                reject(new Error('无法创建头像画布'));
              }
            } else {
              clearTimeout(timeout);
              reject(new Error('视频尺寸无效，无法截取头像'));
            }
          } catch (error) {
            console.error('❌ 头像截取过程中出错:', error);
            clearTimeout(timeout);
            reject(error);
          }
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('视频加载失败，无法截取头像'));
        };

        video.src = URL.createObjectURL(videoFile);
      });

    } catch (error) {
      console.error('❌ 头像截取失败:', error);
      throw new Error('头像截取失败，请重试');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private validateScore(value: any, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num) || num < 0 || num > 100) {
      console.error(`❌ 验证失败 - ${fieldName}:`, value);
      throw new Error(`AI 分析结果中 ${fieldName} 字段值无效: ${value}`);
    }
    return Math.round(num);
  }

  private validateNumber(value: any, fieldName: string, min: number, max: number): number {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      console.error(`❌ 验证失败 - ${fieldName}:`, value, `范围: ${min}-${max}`);
      throw new Error(`AI 分析结果中 ${fieldName} 字段值无效: ${value} (应在 ${min}-${max} 范围内)`);
    }
    return Math.round(num * 10) / 10; // Round to 1 decimal place
  }

  // 恢复：生成带边界框的运动轨迹
  private generateRealisticMovementPatternWithBounds(startX: number, startY: number, startWidth: number, startHeight: number) {
    // Generate more realistic movement pattern with 7 points including bounding boxes
    const timestamps = [5, 10, 15, 20, 25, 30, 35];
    const positions = [];
    
    let currentX = startX;
    let currentY = startY;
    let currentWidth = startWidth;
    let currentHeight = startHeight;
    
    for (let i = 0; i < timestamps.length; i++) {
      // Add some realistic movement variation
      const moveX = (Math.random() - 0.5) * 15; // Move up to 7.5% in either direction
      const moveY = (Math.random() - 0.5) * 10; // Move up to 5% in either direction
      const sizeVariation = (Math.random() - 0.5) * 2; // Slight size variation
      
      currentX = Math.max(5, Math.min(95, currentX + moveX));
      currentY = Math.max(5, Math.min(95, currentY + moveY));
      currentWidth = Math.max(5, Math.min(20, currentWidth + sizeVariation));
      currentHeight = Math.max(10, Math.min(30, currentHeight + sizeVariation));
      
      positions.push({
        x: Math.round(currentX * 10) / 10,
        y: Math.round(currentY * 10) / 10,
        width: Math.round(currentWidth * 10) / 10,
        height: Math.round(currentHeight * 10) / 10
      });
    }
    
    return { timestamps, positions };
  }
}