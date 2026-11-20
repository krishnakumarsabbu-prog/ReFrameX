import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useActiveTab() {
  const [activeTab, setActiveTab] = useState('overview');
  const location = useLocation();

  useEffect(() => {
    setActiveTab('overview');
  }, [location.pathname]);

  return { activeTab, setActiveTab };
}
