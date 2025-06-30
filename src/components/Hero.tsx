import React from 'react';
import { Play, Zap, Target, TrendingUp } from 'lucide-react';

interface HeroProps {
  onGetStarted: () => void;
}

const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-32 h-32 border-2 border-green-500 rounded-full"></div>
        <div className="absolute top-40 right-20 w-24 h-24 border-2 border-blue-500 rounded-full"></div>
        <div className="absolute bottom-20 left-1/4 w-20 h-20 border-2 border-green-500 rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center bg-gradient-to-r from-green-100 to-blue-100 rounded-full px-4 py-2">
                <Zap className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">AI-Powered Football Analysis</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Elevate Your
                </span>
                <br />
                <span className="text-gray-900">Football Game</span>
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                Upload your match videos and receive AI-powered insights on your performance. 
                Discover your strengths, improve your weaknesses, and reach your full potential.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onGetStarted}
                className="group bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                <span className="flex items-center justify-center">
                  Get Started Free
                  <Play className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              
              <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg hover:border-green-500 hover:text-green-600 transition-all duration-200">
                Watch Demo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">10k+</div>
                <div className="text-sm text-gray-600">Players Analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">95%</div>
                <div className="text-sm text-gray-600">Accuracy Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">24/7</div>
                <div className="text-sm text-gray-600">AI Analysis</div>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-green-100 to-blue-100 rounded-3xl p-8 shadow-2xl">
              {/* Mock Video Player */}
              <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-inner">
                <div className="aspect-video bg-gradient-to-br from-green-800 to-blue-900 relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="relative z-10 bg-white/20 backdrop-blur-sm rounded-full p-6 hover:bg-white/30 transition-colors cursor-pointer">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                  
                  {/* Field Lines */}
                  <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white"></div>
                    <div className="absolute top-1/2 left-1/2 w-20 h-20 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                  </div>
                </div>
                
                {/* Controls */}
                <div className="bg-gray-800 p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm">AI Analysis in Progress</span>
                  </div>
                  <div className="flex items-center space-x-2 text-white text-sm">
                    <Target className="w-4 h-4" />
                    <span>Player Tracking: ON</span>
                  </div>
                </div>
              </div>
              
              {/* Floating Cards */}
              <div className="absolute -right-4 top-8 bg-white rounded-lg shadow-xl p-4 w-48 transform rotate-3">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Speed Analysis</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">24.8 km/h</div>
                <div className="text-xs text-gray-500">Peak speed detected</div>
              </div>
              
              <div className="absolute -left-6 bottom-12 bg-white rounded-lg shadow-xl p-4 w-44 transform -rotate-2">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">Performance</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">87%</div>
                <div className="text-xs text-gray-500">Overall rating</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;