import React from 'react';
import { Eye, Brain, Target, TrendingUp, Users, Clock } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: Eye,
      title: 'Smart Player Detection',
      description: 'Advanced AI automatically identifies and tracks your movements throughout the match.',
      color: 'from-blue-500 to-purple-500'
    },
    {
      icon: Brain,
      title: 'Intelligent Analysis',
      description: 'Get detailed insights on your playing style, decision-making, and tactical awareness.',
      color: 'from-green-500 to-teal-500'
    },
    {
      icon: Target,
      title: 'Precision Metrics',
      description: 'Track passing accuracy, shot precision, and movement efficiency with pinpoint accuracy.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: TrendingUp,
      title: 'Performance Trends',
      description: 'Monitor your progress over time and identify areas of improvement and strength.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Users,
      title: 'Team Analysis',
      description: 'Understand your role within the team and how you contribute to overall performance.',
      color: 'from-cyan-500 to-blue-500'
    },
    {
      icon: Clock,
      title: 'Real-time Feedback',
      description: 'Get instant analysis and recommendations to accelerate your development.',
      color: 'from-indigo-500 to-blue-500'
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features for Every Player
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our AI-powered platform provides comprehensive analysis tools designed to help players 
            at every level understand and improve their game.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-200 hover:border-green-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-green-700 transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-gradient-to-r from-green-600 to-blue-600 rounded-3xl p-12 text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Game?</h3>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of players who are already using AI to reach their full potential.
          </p>
          <button className="bg-white text-green-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transform hover:-translate-y-1 transition-all duration-200 shadow-lg">
            Start Your Analysis Today
          </button>
        </div>
      </div>
    </section>
  );
};

export default Features;