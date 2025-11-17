import React from 'react';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-brand-bg">
      <div className="text-center">
         <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-4 text-brand-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 01-6.23-.693L4.2 15.3m15.6 0l-1.2-1.2" />
         </svg>
        <h1 className="text-4xl font-bold text-white">Plif! tv</h1>
        <p className="mt-2 text-lg text-gray-300">Cargando...</p>
      </div>
    </div>
  );
};

export default WelcomeScreen;