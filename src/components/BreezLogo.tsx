import React from 'react';
import { assetPath } from '@/utils/assetPath';

const BreezLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        width="96"
        height="96"
        src={assetPath('assets/logo-breez-header.svg')}
        className="mr-2"
      >
      </img>
    </div>
  );
};

export default BreezLogo;

