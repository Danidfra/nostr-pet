import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpecialMarkRenderer } from './SpecialMarkRenderer';
import { ALL_VALID_SPECIAL_MARKS } from '@/lib/blobbi-egg-validation';

export const SpecialMarkTest: React.FC = () => {
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Special Marks Test</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ALL_VALID_SPECIAL_MARKS.map((mark) => (
            <div key={mark} className="text-center space-y-2">
              <div className="relative w-24 h-30 mx-auto">
                {/* Simple egg background */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(135deg, #f0f0f0 0%, #ffffff 50%, #f0f0f0 100%)',
                    borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                    boxShadow: 'inset -5px -5px 10px rgba(0, 0, 0, 0.1), inset 5px 5px 10px rgba(255, 255, 255, 0.8)',
                  }}
                />
                
                {/* Special mark */}
                <SpecialMarkRenderer
                  specialMark={mark}
                  eggWidth={96}
                  eggHeight={120}
                  animated={true}
                  opacity={1}
                />
              </div>
              <p className="text-xs font-medium">{mark.replace(/_/g, ' ')}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};