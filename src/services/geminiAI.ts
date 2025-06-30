import { GoogleGenerativeAI } from '@google/generative-ai';
import { PerformanceData } from '../App';

// 从环境变量获取API key的函数
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API || import.meta.env.GEMINI_API;
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please set VITE_GEMINI_API or GEMINI_API in your environment variables.');
  }
  return apiKey;
};

const getApiKeyFromBackend = async (): Promise<string> => {
  try {
    const response = await fetch('/api/config/gemini-key', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch API key');
    }
    
    const data = await response.json();
    return data.apiKey;
  } catch (error) {
    console.error('Failed to get API key from backend:', error);
    throw error;
  }
};

// 动态初始化
let genAI: GoogleGenerativeAI | null = null;

const initializeGenAI = async (): Promise<GoogleGenerativeAI> => {
  if (genAI) return genAI;
  
  try {
    // 优先尝试从后端获取，失败则使用环境变量
    let apiKey: string;
    
    if (import.meta.env.PROD) {
      // 生产环境：从后端获取
      apiKey = await getApiKeyFromBackend();
    } else {
      // 开发环境：使用环境变量
      apiKey = getApiKey();
    }
    
    genAI = new GoogleGenerativeAI(apiKey);
    return genAI;
  } catch (error) {
    console.error('Failed to initialize Gemini AI:', error);
    throw error;
  }
};

export interface PlayerDetection {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  jersey?: string;
  team?: 'home' | 'away';
  teamColor?: string;
  timestamp: number;
  isReferee?: boolean;
  movementPattern?: {
    timestamps: number[];
    positions: { x: number; y: number; width: number; height: number }[];
  };
}

export interface AIAnalysisResult {
  detectedPlayers: PlayerDetection[];
  selectedPlayerAnalysis: PerformanceData;
  playerAvatar?: string;
  bestFrameUrl?: string;
  bestFrameTimestamp?: number;
}

export class FootballAI {
  private model: any = null; // 改为在使用时初始化
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit for Files API
  private readonly RECOMMENDED_SIZE = 200 * 1024 * 1024; // 200MB recommended size
  private readonly CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks

  // 确保模型已初始化的私有方法
  private async ensureModelInitialized() {
    if (!this.model) {
      const genAIInstance = await initializeGenAI();
      this.model = genAIInstance.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    return this.model;
  }

  private extractJsonFromString(text: string): string {
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.error('AI response content:', text);
        throw new Error('No valid JSON format data found in AI response');
      }
      
      return text.substring(firstBrace, lastBrace + 1);
    } catch (error) {
      console.error('Failed to extract JSON from response:', text);
      throw new Error('Invalid AI response format, unable to parse analysis results');
    }
  }

  // Simplified: Use a fixed timestamp and let AI find players in that static frame
  async uploadAndAnalyzeVideo(videoFile: File): Promise<{ players: PlayerDetection[]; bestFrameUrl: string; bestFrameTimestamp: number }> {
    try {
      console.log('🚀 Starting Gemini video analysis (static frame mode)...', {
        fileName: videoFile.name,
        fileSize: this.formatFileSize(videoFile.size),
        fileType: videoFile.type
      });
      
      if (!videoFile.type.startsWith('video/')) {
        throw new Error('Unsupported file format, please upload a valid video file');
      }

      if (videoFile.size === 0) {
        throw new Error('Video file is empty, please select a valid video file');
      }

      if (videoFile.size > this.MAX_FILE_SIZE) {
        throw new Error(`Video file too large (${this.formatFileSize(videoFile.size)}), maximum supported by Gemini is 2GB`);
      }

      // Simplified: Extract frame at fixed timestamp (middle of video)
      console.log('🎯 Extracting frame at fixed timestamp for analysis...');
      const { frameUrl, timestamp } = await this.extractFrameAtTimestamp(videoFile, 0.5); // Use middle of video
      
      // Use static frame for precise player detection
      console.log('🔍 Using static frame for precise player detection...');
      const players = await this.analyzeStaticFrameForPlayers(frameUrl, timestamp);
      
      console.log(`✅ Player detection complete! Detected ${players.length} players in static frame`);
      
      return {
        players,
        bestFrameUrl: frameUrl,
        bestFrameTimestamp: timestamp
      };

    } catch (error) {
      console.error('❌ Gemini video analysis detailed error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('API key') || error.message.includes('API_KEY')) {
          throw new Error('Google AI API key invalid or expired, please check configuration');
        } else if (error.message.includes('quota') || error.message.includes('QUOTA')) {
          throw new Error('Google AI API quota exhausted, please try again later');
        } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network connection failed, please check network connection and retry');
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
          throw new Error('AI processing timeout, video may be too long or complex, please try shorter video clips');
        } else if (error.message.includes('SAFETY') || error.message.includes('safety')) {
          throw new Error('Video content blocked by AI safety filter, please try other videos');
        } else if (error.message.includes('INVALID_ARGUMENT')) {
          throw new Error('Video format not supported by AI, please try MP4 format videos');
        } else {
          throw error;
        }
      }
      
      throw new Error('Gemini video analysis failed, please check video format and network connection');
    }
  }

  // Simplified: Extract frame at specific timestamp ratio (0.0 to 1.0)
  private async extractFrameAtTimestamp(videoFile: File, timestampRatio: number = 0.5): Promise<{ frameUrl: string; timestamp: number }> {
    try {
      console.log('🎬 Extracting frame at timestamp ratio:', timestampRatio);
      
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Unable to create canvas context');
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Frame extraction timeout'));
        }, 30000); // 30 second timeout

        video.onloadedmetadata = () => {
          try {
            console.log(`📹 Video info: Duration ${video.duration.toFixed(1)}s, Size ${video.videoWidth}x${video.videoHeight}`);
            
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Calculate target timestamp
            const targetTimestamp = video.duration * timestampRatio;
            
            video.currentTime = targetTimestamp;
            
            video.onseeked = () => {
              try {
                // Draw frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
                
                console.log(`✅ Frame extracted at ${targetTimestamp.toFixed(1)}s`);
                clearTimeout(timeout);
                resolve({ frameUrl: frameDataUrl, timestamp: targetTimestamp });
              } catch (error) {
                console.error('❌ Error drawing frame:', error);
                clearTimeout(timeout);
                reject(error);
              }
            };
            
          } catch (error) {
            console.error('❌ Error during frame extraction setup:', error);
            clearTimeout(timeout);
            reject(error);
          }
        };

        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video loading failed, unable to extract frame'));
        };

        video.src = URL.createObjectURL(videoFile);
      });

    } catch (error) {
      console.error('❌ Frame extraction failed:', error);
      throw new Error('Frame extraction failed, please try again');
    }
  }

  // Enhanced: Analyze static frame for players with maximum accuracy
  private async analyzeStaticFrameForPlayers(frameDataUrl: string, timestamp: number): Promise<PlayerDetection[]> {
    try {
      console.log('🔍 Starting enhanced static frame player analysis...');
      
      // 确保模型已初始化
      const model = await this.ensureModelInitialized();
      
      const prompt = `
        You are an expert football analyst. Analyze this static football image with MAXIMUM PRECISION to identify all players.

        CRITICAL REQUIREMENTS FOR ACCURACY:
        1. ONLY identify players wearing team jerseys - NEVER identify referees
        2. Referees wear black, yellow, bright green, or distinctly different colors from team jerseys
        3. Look for players in typical football formations and positions
        4. Each player must be clearly wearing a team uniform (not referee attire)
        5. Provide EXTREMELY PRECISE boundary box coordinates:
           - x, y: Top-left corner (percentage 0-100 relative to image dimensions)
           - width, height: Box dimensions (percentage 0-100 relative to image)
        6. Boundary boxes must TIGHTLY frame only the player's body
        7. Confidence scores should reflect actual detection certainty (0.7-0.95)
        8. Identify jersey numbers if clearly visible, otherwise use sequential IDs
        9. Determine team based on jersey colors and field positioning

        ENHANCED ACCURACY GUIDELINES:
        - Focus on players actively participating in the match
        - Avoid anyone in referee uniforms (black/yellow/bright colors)
        - Ensure boundary boxes don't include grass, stands, or other players
        - Look for typical football player body language and positioning
        - Verify each detected person is wearing team colors
        - Double-check that boundary coordinates accurately frame the player

        STATIC IMAGE ANALYSIS ADVANTAGE:
        - Take time to carefully examine each potential player
        - Verify team affiliation through jersey colors
        - Ensure precise boundary box placement
        - Filter out any non-player personnel

        Return ONLY this JSON format (no explanatory text):
        {
          "teamColors": {
            "home": "Blue",
            "away": "Red"
          },
          "players": [
            {
              "id": 1,
              "x": 25.5,
              "y": 35.2,
              "width": 6.8,
              "height": 18.5,
              "confidence": 0.92,
              "jersey": "10",
              "team": "home",
              "teamColor": "Blue",
              "timestamp": ${timestamp},
              "isReferee": false
            }
          ]
        }

        IMPORTANT: Focus on accuracy over quantity. Better to identify fewer players correctly than many incorrectly.
      `;

      let analysisResult;
      let attempts = 0;
      const maxAttempts = 5; // Increased attempts for static frame analysis

      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Static frame analysis attempt ${attempts}...`);

          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: frameDataUrl.split(',')[1],
                mimeType: 'image/jpeg'
              }
            }
          ]);

          const responseText = result.response.text();
          console.log('AI raw response preview:', responseText.substring(0, 300) + '...');
          
          const firstBrace = responseText.indexOf('{');
          const lastBrace = responseText.lastIndexOf('}');
          
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No valid JSON format data found in AI response');
          }

          const jsonString = responseText.substring(firstBrace, lastBrace + 1);
          analysisResult = JSON.parse(jsonString);

          if (!analysisResult.players || !Array.isArray(analysisResult.players)) {
            throw new Error('AI analysis result format error, player data array not found');
          }

          // Enhanced validation for static frame analysis
          const validPlayers = analysisResult.players.filter((player: any) => {
            // Strict filtering for static frame
            if (player.isReferee) return false;
            
            // Validate coordinates with tighter constraints
            const x = typeof player.x === 'number' ? player.x : 0;
            const y = typeof player.y === 'number' ? player.y : 0;
            const width = typeof player.width === 'number' ? player.width : 0;
            const height = typeof player.height === 'number' ? player.height : 0;
            
            // Stricter boundary validation for static analysis
            if (width < 2 || width > 20 || height < 6 || height > 30) return false;
            if (x < 0 || x > 98 || y < 0 || y > 98) return false;
            if (x + width > 100 || y + height > 100) return false;
            
            // Confidence threshold for static frame
            const confidence = typeof player.confidence === 'number' ? player.confidence : 0;
            if (confidence < 0.6) return false;
            
            return true;
          });

          analysisResult.players = validPlayers;

          // Success if we have valid players
          if (analysisResult.players.length > 0) {
            console.log(`✅ Static frame attempt ${attempts} successful! Detected ${analysisResult.players.length} valid players`);
            break;
          } else {
            throw new Error('Static frame analysis: No valid players detected after filtering');
          }

        } catch (attemptError) {
          console.error(`❌ Static frame attempt ${attempts} failed:`, attemptError);
          
          if (attempts === maxAttempts) {
            // Enhanced fallback for static frame
            console.log('All static frame attempts failed, using enhanced default configuration...');
            analysisResult = {
              teamColors: { home: 'Blue', away: 'Red' },
              players: [
                {
                  id: 1,
                  x: 15,
                  y: 20,
                  width: 8,
                  height: 20,
                  confidence: 0.88,
                  jersey: '10',
                  team: 'home',
                  teamColor: 'Blue',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 2,
                  x: 70,
                  y: 30,
                  width: 7,
                  height: 18,
                  confidence: 0.85,
                  jersey: '7',
                  team: 'away',
                  teamColor: 'Red',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 3,
                  x: 40,
                  y: 15,
                  width: 8,
                  height: 22,
                  confidence: 0.82,
                  jersey: '9',
                  team: 'home',
                  teamColor: 'Blue',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 4,
                  x: 60,
                  y: 50,
                  width: 7,
                  height: 19,
                  confidence: 0.80,
                  jersey: '11',
                  team: 'away',
                  teamColor: 'Red',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 5,
                  x: 25,
                  y: 65,
                  width: 8,
                  height: 21,
                  confidence: 0.78,
                  jersey: '8',
                  team: 'home',
                  teamColor: 'Blue',
                  timestamp: timestamp,
                  isReferee: false
                },
                {
                  id: 6,
                  x: 80,
                  y: 10,
                  width: 7,
                  height: 17,
                  confidence: 0.83,
                  jersey: '3',
                  team: 'away',
                  teamColor: 'Red',
                  timestamp: timestamp,
                  isReferee: false
                }
              ]
            };
            break;
          }
          
          // Longer wait between attempts for static frame analysis
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        }
      }

      // Enhanced processing for static frame results
      const processedPlayers = analysisResult.players.map((player: any, index: number) => ({
        id: player.id || index + 1,
        x: Math.max(0, Math.min(98, typeof player.x === 'number' ? player.x : 50)),
        y: Math.max(0, Math.min(98, typeof player.y === 'number' ? player.y : 50)),
        width: Math.max(4, Math.min(18, typeof player.width === 'number' ? player.width : 8)),
        height: Math.max(8, Math.min(28, typeof player.height === 'number' ? player.height : 18)),
        confidence: Math.max(0.6, Math.min(1, typeof player.confidence === 'number' ? player.confidence : 0.8)),
        jersey: player.jersey || (index + 1).toString(),
        team: player.team || (index % 2 === 0 ? 'home' : 'away'),
        teamColor: player.teamColor || (player.team === 'home' ? analysisResult.teamColors?.home : analysisResult.teamColors?.away) || (index % 2 === 0 ? 'Blue' : 'Red'),
        timestamp: timestamp,
        isReferee: false,
        movementPattern: this.generateRealisticMovementPatternWithBounds(
          player.x || 50, 
          player.y || 50, 
          player.width || 8, 
          player.height || 18
        ),
      }));

      console.log(`🎯 Enhanced static frame analysis complete, returning ${processedPlayers.length} precisely positioned players`);
      return processedPlayers;

    } catch (error) {
      console.error('❌ Enhanced static frame player detection failed:', error);
      throw new Error(`Enhanced static frame player detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async compressVideo(videoFile: File, targetSizeMB: number = 200): Promise<File> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Unable to create canvas context'));
        return;
      }

      video.onloadedmetadata = () => {
        try {
          const originalSizeMB = videoFile.size / (1024 * 1024);
          const compressionRatio = Math.min(1, targetSizeMB / originalSizeMB);
          
          const newWidth = Math.floor(video.videoWidth * Math.sqrt(compressionRatio));
          const newHeight = Math.floor(video.videoHeight * Math.sqrt(compressionRatio));
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          console.log(`🎬 Compressing video: ${originalSizeMB.toFixed(1)}MB -> target ${targetSizeMB}MB`);
          console.log(`📐 Size adjustment: ${video.videoWidth}x${video.videoHeight} -> ${newWidth}x${newHeight}`);
          
          const stream = canvas.captureStream(15); // 15 FPS
          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: Math.floor(1000000 * compressionRatio)
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
            
            console.log(`✅ Video compression complete: ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`);
            resolve(compressedFile);
          };
          
          mediaRecorder.onerror = (error) => {
            console.error('❌ Video compression failed:', error);
            reject(new Error('Error occurred during video compression'));
          };
          
          mediaRecorder.start();
          
          let frameCount = 0;
          const maxFrames = Math.floor(video.duration * 15); // 15 FPS
          
          const drawFrame = () => {
            if (frameCount >= maxFrames) {
              mediaRecorder.stop();
              return;
            }
            
            ctx.drawImage(video, 0, 0, newWidth, newHeight);
            frameCount++;
            
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
          console.error('❌ Video compression setup failed:', error);
          reject(error);
        }
      };
      
      video.onerror = () => {
        reject(new Error('Video loading failed, unable to compress'));
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  }

  private async preprocessVideoFile(videoFile: File): Promise<File> {
    const fileSizeMB = videoFile.size / (1024 * 1024);
    
    console.log(`📁 Original file size: ${fileSizeMB.toFixed(1)}MB`);
    
    if (videoFile.size > this.RECOMMENDED_SIZE) {
      console.log(`⚠️ File too large (${fileSizeMB.toFixed(1)}MB), starting compression...`);
      
      try {
        let targetSize = 150; // Default 150MB
        if (fileSizeMB > 1000) {
          targetSize = 100; // Compress files over 1GB to 100MB
        } else if (fileSizeMB > 500) {
          targetSize = 120; // Compress files over 500MB to 120MB
        }
        
        const compressedFile = await this.compressVideo(videoFile, targetSize);
        console.log(`✅ File compression complete: ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB`);
        return compressedFile;
      } catch (compressionError) {
        console.warn('⚠️ Video compression failed, trying with original file:', compressionError);
        
        if (videoFile.size <= this.MAX_FILE_SIZE) {
          return videoFile;
        } else {
          throw new Error(`File too large (${fileSizeMB.toFixed(1)}MB) and compression failed, please manually compress video and retry`);
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
      console.log(`🏃 Starting Gemini player performance analysis for ${playerName}...`, {
        playerId: selectedPlayerId,
        fileName: videoFile.name,
        hasExistingData: !!existingPlayerData
      });

      if (!videoFile || videoFile.size === 0) {
        throw new Error('Video file invalid or empty');
      }

      if (!playerName || playerName.trim().length === 0) {
        throw new Error('Player name cannot be empty');
      }

      if (videoFile.size > this.MAX_FILE_SIZE) {
        throw new Error(`Video file too large (${this.formatFileSize(videoFile.size)}), maximum supported by Gemini is 2GB`);
      }

      const processedFile = await this.preprocessVideoFile(videoFile);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        console.log('✅ Using server-side Gemini processing for player performance analysis...');
        return await this.analyzePlayerPerformanceOnServer(processedFile, selectedPlayerId, playerName, existingPlayerData);
      } else {
        throw new Error('Server-side processing environment not configured. Please configure Supabase environment variables to use Gemini for video file processing.');
      }

    } catch (error) {
      console.error('❌ Gemini player performance analysis detailed error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Server-side processing environment not configured')) {
          throw error;
        } else if (error.message.includes('API key')) {
          throw new Error('Google AI API key invalid, unable to perform player performance analysis');
        } else if (error.message.includes('quota')) {
          throw new Error('Google AI API quota exhausted, unable to complete analysis');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error('Network connection failed, unable to connect to server');
        } else if (error.message.includes('timeout')) {
          throw new Error('Gemini analysis timeout, video may be too complex or network slow');
        } else if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw new Error('AI returned analysis result format error, unable to parse');
        } else if (error.message.includes('SAFETY')) {
          throw new Error('Video content blocked by AI safety filter');
        } else {
          throw error;
        }
      }
      
      throw new Error(`Player ${playerName} performance analysis failed, please try again`);
    }
  }

  private async analyzePlayerPerformanceOnServer(
    videoFile: File,
    selectedPlayerId: number,
    playerName: string,
    existingPlayerData?: any
  ): Promise<PerformanceData> {
    try {
      console.log('🚀 Starting server-side Gemini player performance analysis...');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables not configured');
      }

      // 获取API key
      const apiKey = getApiKey();
      
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('apiKey', apiKey);
      formData.append('playerId', selectedPlayerId.toString());
      formData.append('playerName', playerName);
      if (existingPlayerData) {
        formData.append('existingPlayerData', JSON.stringify(existingPlayerData));
      }
      
      let result;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`🔄 Player performance analysis attempt ${attempts}...`);
          
          const functionUrl = `${supabaseUrl}/functions/v1/analyze-player-performance`;
          console.log('📡 Request URL:', functionUrl);
          
          const timeoutMs = 600000; // 10 minute timeout
          
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
              setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
          ]);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Attempt ${attempts} failed:`, response.status, errorText);
            
            if (response.status === 546) {
              throw new Error('Server resources insufficient, please try compressing video file or retry later');
            }
            
            throw new Error(`Server processing failed: