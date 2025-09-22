// src/components/AnimatedWrapper.tsx
import React, { useState, useEffect, memo } from 'react';

interface AnimatedWrapperProps {
  children: React.ReactNode;
  animationClass?: string;
  delay?: number;
  className?: string;
}

const AnimatedWrapper = memo<AnimatedWrapperProps>(({ 
  children, 
  animationClass = 'animate-fade-in', 
  delay = 0,
  className = ''
}) => {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasAnimated(true);
    }, delay);
    
    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only runs once on mount

  return (
    <div 
      className={`${className} ${hasAnimated ? animationClass : 'opacity-0'}`}
      style={{ animationFillMode: 'forwards' }}
    >
      {children}
    </div>
  );
});

AnimatedWrapper.displayName = 'AnimatedWrapper';

export default AnimatedWrapper;
