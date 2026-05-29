import React, { useState, useEffect } from 'react';
import { User } from './types';
import AuthScreen from './components/AuthScreen';
import AdvertiserDashboard from './components/AdvertiserDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Shield, Sparkles } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for pre-existing persistent session to recover fast on dynamic reviews
  useEffect(() => {
    const savedUser = localStorage.getItem('adportal_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Session recovery failed, clearing state:", err);
        localStorage.removeItem('adportal_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('adportal_user', JSON.stringify(user));
    setCurrentUser(user);
    
    // Inject system-level notification on successful portal login
    console.log(`Successfully authorized user profile: ${user.name} as ${user.role}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('adportal_user');
    setCurrentUser(null);
  };

  const handleProfileUpdate = (updatedUser: User) => {
    localStorage.setItem('adportal_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
        <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
        <p className="text-xs font-mono text-slate-400">Restoring active ad portal credentials...</p>
      </div>
    );
  }

  // Auth Guard Routing
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Admin Dashboard Mode Routing
  if (currentUser.role === 'admin') {
    return (
      <AdminDashboard 
        adminUser={currentUser} 
        onLogout={handleLogout} 
      />
    );
  }

  // Standard Advertiser Client Mode Routing
  return (
    <AdvertiserDashboard 
      user={currentUser} 
      onLogout={handleLogout} 
      onProfileUpdate={handleProfileUpdate}
    />
  );
}
