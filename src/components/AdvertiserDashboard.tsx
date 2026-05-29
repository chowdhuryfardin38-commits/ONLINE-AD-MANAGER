import React, { useState, useEffect } from 'react';
import { User, Campaign, Complaint, AdSuggestion, PlatformSettings } from '../types';
import { 
  Sparkles, PlusCircle, LayoutDashboard, Settings2, CreditCard, MessageCircle, AlertTriangle, 
  CheckCircle2, XCircle, Clock, Trash2, Send, ChevronRight, Check, HelpCircle, Bell, User as UserIcon, LogOut,
  Image, Video, UploadCloud, FileWarning
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdvertiserDashboardProps {
  user: User;
  onLogout: () => void;
  onProfileUpdate: (updatedUser: User) => void;
}

export default function AdvertiserDashboard({ user, onLogout, onProfileUpdate }: AdvertiserDashboardProps) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'create' | 'help' | 'profile'>('campaigns');
  
  // Server-backed Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  
  // UI Interaction States
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AdSuggestion | null>(null);
  const [suggestedCampaignId, setSuggestedCampaignId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutCampaign, setCheckoutCampaign] = useState<Campaign | null>(null);

  // Form states for creating a Campaign
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [mediaSource, setMediaSource] = useState<'url' | 'upload'>('url');
  const [uploadedBase64, setUploadedBase64] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<number>(0);
  const [uploadedFileType, setUploadedFileType] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [readingFile, setReadingFile] = useState<boolean>(false);
  const [location, setLocation] = useState('United States');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [interestsText, setInterestsText] = useState('Marketing, Business');
  const [budgetType, setBudgetType] = useState<'daily' | 'total'>('daily');
  const [budgetAmount, setBudgetAmount] = useState('50');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-30');
  const [keywordsText, setKeywordsText] = useState('growth, promotion');

  // Checkout Payment Simulator state
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [cardBrand, setCardBrand] = useState('Visa');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiry, setExpiry] = useState('09/29');
  const [cvc, setCvc] = useState('111');
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');

  // Support complaint form state
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintMessage, setComplaintMessage] = useState('');

  // Profile Edit Forms
  const [profileName, setProfileName] = useState(user.name);
  const [companyName, setCompanyName] = useState(user.companyName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Alerts List (Notifications for campaign pacing and limits)
  const [notifications, setNotifications] = useState<string[]>([]);

  // Real-time Notification States
  interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    reason?: string;
    timestamp: string;
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isBellOpen, setIsBellOpen] = useState(false);

  // Audio synthesizer beep alert using AudioContext
  const playBeepNotification = (frequency = 440) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Audio Context beep was blocked or unsupported:", e);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [campRes, compRes, setRes] = await Promise.all([
        fetch(`/api/campaigns?advertiserId=${user.id}`),
        fetch(`/api/complaints?userId=${user.id}`),
        fetch('/api/settings')
      ]);

      const campData = await campRes.json();
      const compData = await compRes.json();
      const setData = await setRes.json();

      setCampaigns(campData);
      setComplaints(compData);
      setSettings(setData);
    } catch (err) {
      console.error("Error loading Advertiser data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  // Real-time client WebSocket Sync connection and event hook
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isMounted = true;

    const connectWebSocket = () => {
      if (!isMounted) return;
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}`;
      console.log(`[WS Client] Connecting to: ${wsUrl}`);
      
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMounted) {
          ws?.close();
          return;
        }
        console.log(`[WS Client] Connected safely. Subscribing to advertiser.id: ${user.id}`);
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "subscribe", advertiserId: user.id }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[WS Client] Message received:", data);
          
          if (data.type === "status_changed") {
            const { campaignId, title, oldStatus, newStatus, rejectReason } = data;
            
            // Generate visual notification structure
            const statusType = newStatus === 'active' ? 'success' : 'error';

            const toastId = Math.random().toString();
            setToasts(prev => [
              {
                id: toastId,
                type: statusType as any,
                title: 'Campaign Status Updated',
                message: `"${title}" has been updated from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}.`,
                reason: rejectReason,
                timestamp: new Date().toLocaleTimeString()
              },
              ...prev
            ]);

            // Expand notifications block so they clearly register
            setNotifications(prev => [
              `[${new Date().toLocaleTimeString()}] ALERT: "${title}" transitioned from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}.${newStatus === 'rejected' && rejectReason ? ` Reason: ${rejectReason}` : ''}`,
              ...prev
            ]);

            // Beep alert
            playBeepNotification(newStatus === 'active' ? 523.25 : 349.23); // C5 sound for active, F4 for reject

            // Force refresh of campaigns lists silently
            loadData(true);
          }
        } catch (err) {
          console.error("[WS Client] Message parse failure:", err);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          console.log("[WS Client] Connection lost. Attempting reconnection in 4 seconds...");
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        }
      };

      ws.onerror = (err) => {
        console.error("[WS Client] Connection error observed:", err);
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user.id]);

  // Dismiss toast notifications automatically after 10 seconds
  useEffect(() => {
    if (toasts.length > 0) {
      const timeout = setTimeout(() => {
        setToasts(prev => prev.slice(0, prev.length - 1));
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [toasts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    if (file.size > 200 * 1024 * 1024) {
      setUploadError("Selected file exceeds the maximum size limit of 200 MB. Please choose a smaller file.");
      setUploadedBase64('');
      return;
    }

    setReadingFile(true);
    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    setUploadedFileType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedBase64(reader.result as string);
      setReadingFile(false);
    };
    reader.onerror = () => {
      setUploadError("Failed to import selected file.");
      setReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  // Create Campaign Action
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const interests = interestsText.split(',').map(i => i.trim()).filter(Boolean);
    const keywords = keywordsText.split(',').map(k => k.trim()).filter(Boolean);

    if (settings && parseFloat(budgetAmount) < settings.minDailyBudget) {
      alert(`Budget amount is too low! The minimum daily budget allowed is $${settings.minDailyBudget}.`);
      setLoading(false);
      return;
    }

    if (mediaSource === 'upload' && !uploadedBase64 && !uploadError) {
      alert("Please upload a media file or wait for the process to complete.");
      setLoading(false);
      return;
    }

    if (mediaSource === 'upload' && uploadError) {
      alert(`Cannot submit: ${uploadError}`);
      setLoading(false);
      return;
    }

    try {
      const finalImageValue = mediaSource === 'upload' 
        ? (uploadedBase64 || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80")
        : (imageUrl || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80");

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advertiserId: user.id,
          title,
          description,
          imageUrl: finalImageValue,
          targetAudience: {
            location,
            ageMin,
            ageMax,
            interests
          },
          budgetType,
          budgetAmount,
          startDate,
          endDate,
          keywords
        })
      });

      if (response.ok) {
        alert(`Campaign "${title}" saved successfully in Draft status!`);
        // Clear Form fields
        setTitle('');
        setDescription('');
        setImageUrl('');
        setMediaSource('url');
        setUploadedBase64('');
        setUploadedFileName('');
        setUploadedFileSize(0);
        setUploadedFileType('');
        setUploadError('');
        setReadingFile(false);
        setBudgetType('daily');
        setBudgetAmount('50');
        // Back to campaigns
        setActiveTab('campaigns');
        await loadData();
        setNotifications(prev => [
          `Success: Campaign "${title}" saved successfully in Draft status! Pay for ads to start delivering.`,
          ...prev
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Run Gemini Ad Optimization Suggestions
  const handleOptimizeCampaign = async (campId: string) => {
    setOptimizingId(campId);
    setAiSuggestion(null);
    setSuggestedCampaignId(campId);
    try {
      const response = await fetch(`/api/campaigns/${campId}/optimize`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setAiSuggestion(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOptimizingId(null);
    }
  };

  // Auto-Apply AI suggestions to Campaign state
  const handleApplyAiSuggestions = async () => {
    if (!aiSuggestion || !suggestedCampaignId) return;
    setLoading(true);
    try {
      const currentCamp = campaigns.find(c => c.id === suggestedCampaignId);
      if (!currentCamp) return;

      const response = await fetch(`/api/campaigns/${suggestedCampaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAudience: {
            ...currentCamp.targetAudience,
            ageMin: aiSuggestion.suggestedAges.min,
            ageMax: aiSuggestion.suggestedAges.max,
            interests: aiSuggestion.suggestedInterests
          },
          keywords: aiSuggestion.suggestedKeywords
        })
      });

      if (response.ok) {
        setAiSuggestion(null);
        setSuggestedCampaignId(null);
        await loadData();
        alert("Success! High-impact keywords and specific age segments applied safely to campaign parameters.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Open Checkout Simulator
  const handleOpenCheckout = (campaign: Campaign) => {
    setCheckoutCampaign(campaign);
    setIsCheckoutOpen(true);
  };

  // Complete Payment Action
  const handleProcessSimulatedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutCampaign) return;
    setActionLoadingId(checkoutCampaign.id);

    const isMobilePayment = paymentMethod === 'bKash' || paymentMethod === 'Nagad';

    try {
      const response = await fetch(`/api/campaigns/${checkoutCampaign.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          cardBrand: isMobilePayment ? paymentMethod : cardBrand,
          last4: isMobilePayment ? senderPhone.slice(-4) : cardNumber.slice(-4),
          amount: checkoutCampaign.budgetAmount * 10, // Simulating payment factor or daily threshold multiplied
          trxId: isMobilePayment ? trxId : undefined,
          senderPhone: isMobilePayment ? senderPhone : undefined
        })
      });

      if (response.ok) {
        setIsCheckoutOpen(false);
        setCheckoutCampaign(null);
        await loadData();
        setNotifications(prev => [
          "Success: Payment processed. Dynamic campaign status promoted to Pending Admin Moderation.",
          ...prev
        ]);
        alert("Simulated transaction captured! Advertising campaign promoted to pending approval.");
        setTrxId('');
        setSenderPhone('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return;
    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // File Complaint / Support Ticket request
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          subject: complaintSubject,
          message: complaintMessage
        })
      });

      if (response.ok) {
        setComplaintSubject('');
        setComplaintMessage('');
        await loadData();
        alert("Support request logged. A platform admin will review and response here shortly.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Save User Personal Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: profileName,
          companyName,
          phone
        })
      });
      if (response.ok) {
        const data = await response.json();
        onProfileUpdate(data.user);
        alert("Personal profile specs saved successfully.");
      } else {
        const d = await response.json();
        alert(d.error || "Profile save failed.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Edit Security password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword,
          newPassword
        })
      });
      if (response.ok) {
        setCurrentPassword('');
        setNewPassword('');
        alert("Security passphrase updated successfully!");
      } else {
        const d = await response.json();
        alert(d.error || "Failed to update security password.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Top Banner Header - Styled with Bento elements */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-xs sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="font-display font-black text-lg tracking-tight text-slate-900 block leading-tight">AdVantage Portal</span>
            <span className="text-[10px] text-slate-400 font-mono font-bold tracking-widest uppercase">Advertiser Console</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Real-time WebSockets Notification Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsBellOpen(!isBellOpen)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer transition relative flex items-center justify-center border border-slate-200 shadow-xs"
              title="Campaign Alerts"
              id="ws-notification-bell"
            >
              <Bell className="w-4 h-4" />
              {toasts.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-mono text-[9px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-md animate-bounce">
                  {toasts.length}
                </span>
              )}
            </button>

            {/* Notification drop center view */}
            {isBellOpen && (
              <div 
                className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-3"
                id="ws-notification-dropdown"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-display font-semibold text-xs tracking-wide text-slate-900 uppercase">Alerts History</span>
                  <button 
                    onClick={() => {
                      setToasts([]);
                      setNotifications([]);
                      setIsBellOpen(false);
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {toasts.length === 0 && notifications.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No status notifications yet.
                    </div>
                  ) : (
                    <>
                      {/* Show Toasts in Dropdown */}
                      {toasts.map((toast) => (
                        <div 
                          key={toast.id} 
                          className={`p-3 rounded-xl border text-xs leading-relaxed font-mono ${
                            toast.type === 'success' 
                              ? 'bg-emerald-50/50 border-emerald-100 text-emerald-950' 
                              : 'bg-red-50/50 border-red-101 text-red-950'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <strong className="font-bold font-sans text-slate-900 block">{toast.title}</strong>
                            <span className="text-[9px] text-slate-400 font-normal">{toast.timestamp}</span>
                          </div>
                          <p className="mt-1 font-sans text-[11px] text-slate-600 leading-normal">{toast.message}</p>
                          {toast.reason && (
                            <p className="mt-1.5 text-[10px] text-red-700 bg-red-100 p-1.5 rounded border border-red-200">
                              Reason: {toast.reason}
                            </p>
                          )}
                        </div>
                      ))}
                      {/* Older alerts that were added to local string alerts list */}
                      {notifications.filter(n => !toasts.some(t => n.includes(t.message))).map((note, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-600 font-mono">
                          {note}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-slate-905">{user.name}</div>
            <div className="text-[10px] text-indigo-600 font-mono font-bold uppercase">{user.companyName || 'Standard Account'}</div>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-xs rounded-xl font-bold cursor-pointer transition border border-rose-200 shadow-sm flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Primary Layout Row */}
      <div className="flex flex-1 flex-col lg:flex-row">
        
        {/* Navigation bar side panel - Styled with Bento elements */}
        <nav className="w-full lg:w-64 bg-white border-r border-slate-200 p-5 space-y-1.5 shrink-0">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest px-3 mb-3 block">ADVERTISER</div>
          
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'campaigns' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            My Ad Campaigns
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'create' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Setup New Campaign
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'help' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Support Desk & Tickets
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'profile' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Profile & Security
          </button>

          {/* Quick Stats sidebar widget */}
          <div className="pt-6 border-t border-slate-100 mt-6 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block px-3">BUDGET SUMMARY</span>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 text-xs text-slate-600 space-y-2 font-mono mx-1">
              <div className="flex justify-between">
                <span>Active ads:</span>
                <span className="font-bold text-slate-800">{campaigns.filter(c => c.status === 'active').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total spent:</span>
                <span className="font-bold text-slate-900">${campaigns.reduce((acc, curr) => acc + curr.spendingAmount, 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-150 mt-6">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="w-4 h-4" />
              Sign Out Account
            </button>
          </div>
        </nav>

        {/* Core panel window */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          
          {loading && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100/60 rounded-2xl flex items-center gap-2 text-indigo-700 text-sm font-mono">
              <div className="animate-spin w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent" />
              Syncing user database directories...
            </div>
          )}

          {/* Alerts / Notifications System block */}
          {activeTab === 'campaigns' && notifications.length > 0 && (
            <div className="mb-6 bg-amber-50/70 border border-amber-205 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-2 text-amber-900 text-xs font-bold uppercase tracking-wider">
                <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
                Live Budget & Pacing Threshold Alerts:
              </div>
              <ul className="text-xs text-amber-955 space-y-1.5 list-disc pl-5 font-mono leading-relaxed">
                {notifications.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ==========================================
              TAB: MY CAMPAIGNS & TRACKING
             ========================================== */}
          {activeTab === 'campaigns' && (
            <div className="space-y-8">
              
              {/* Header block with welcome and overall performance stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Campaign Management</h2>
                  <p className="text-sm text-slate-500">View real-time status tracking, run Gemini optimizations, and settle balances dynamically.</p>
                </div>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  New Ad Campaign
                </button>
              </div>

              {/* BENTO GRID SPECIFICATION Container */}
              <div className="grid grid-cols-12 gap-5 w-full">
                
                {/* 1. Campaign Performance Block (col-span-12 lg:col-span-8) */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 font-display">Campaign Performance Pace</h3>
                      <p className="text-xs text-slate-400 font-mono">Aggregated metrics across live active traffic streams</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-[9px] uppercase font-mono font-bold rounded text-slate-500">Real-time Stats</span>
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[9px] uppercase font-mono font-bold rounded">Live Sync</span>
                    </div>
                  </div>

                  {/* Gorgeous visual graphical bars */}
                  <div className="flex items-end gap-3 px-2 h-40 pb-2">
                    <div className="flex-1 bg-indigo-100 hover:bg-indigo-200 rounded-xl h-[45%] transition-all duration-200 group relative cursor-pointer">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Mon: 450 Reach</span>
                    </div>
                    <div className="flex-1 bg-indigo-250 hover:bg-indigo-300 rounded-xl h-[65%] transition-all duration-200 group relative cursor-pointer">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Tue: 650 Reach</span>
                    </div>
                    <div className="flex-1 bg-indigo-150 hover:bg-indigo-200 rounded-xl h-[55%] transition-all duration-200 group relative cursor-pointer">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Wed: 550 Reach</span>
                    </div>
                    <div className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl h-[88%] transition-all duration-200 group relative cursor-pointer">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Thu: 880 Reach</span>
                    </div>
                    <div className="flex-1 bg-indigo-400 hover:bg-indigo-500 rounded-xl h-[72%] transition-all duration-200 group relative cursor-pointer">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Fri: 720 Reach</span>
                    </div>
                    <div className="flex-1 bg-indigo-500 hover:bg-indigo-600 rounded-xl h-[78%] transition-all duration-200 group relative cursor-pointer">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Sat: 780 Reach</span>
                    </div>
                    <div className="flex-1 bg-indigo-700 hover:bg-indigo-800 rounded-xl h-[96%] transition-all duration-200 group relative cursor-pointer bg-gradient-to-t from-indigo-700 to-indigo-500">
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-905 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">Sun: 980 Reach (Highest)</span>
                    </div>
                  </div>

                  {(() => {
                    const dynamicReach = campaigns.reduce((sum, c) => {
                      let reach = 0;
                      if (c.status === 'active') {
                        reach += 1250;
                      } else if (c.status === 'pending') {
                        reach += 150;
                      } else {
                        reach += 50; // draft/rejected baseline
                      }
                      if (c.spendingAmount > 0) {
                        reach += Math.round(c.spendingAmount * 240);
                      }
                      return sum + reach;
                    }, 0);

                    const dynamicLeads = campaigns.reduce((sum, c) => {
                      let clicks = 0;
                      if (c.status === 'active') {
                        clicks += 58;
                      } else if (c.status === 'pending') {
                        clicks += 6;
                      } else {
                        clicks += 2;
                      }
                      if (c.spendingAmount > 0) {
                        clicks += Math.round(c.spendingAmount * 11);
                      }
                      return sum + clicks;
                    }, 0);

                    const dynamicCtr = dynamicReach > 0 
                      ? ((dynamicLeads / dynamicReach) * 100)
                      : 0;

                    return (
                      <div className="mt-4 grid grid-cols-3 border-t border-slate-100 pt-4 text-center sm:text-left">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-bold">Estimated Reach</p>
                          <p className="text-lg font-bold text-slate-800 font-display">
                            {campaigns.length > 0 ? `${dynamicReach.toLocaleString()} impressions` : '0 impressions'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-bold">Conversion Rate (CTR)</p>
                          <p className="text-lg font-bold text-indigo-600 font-display">
                            {campaigns.length > 0 ? `${dynamicCtr.toFixed(2)}% average` : '0.00% average'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-mono font-bold">Optimized Leads</p>
                          <p className="text-lg font-bold text-slate-800 font-display">
                            {campaigns.length > 0 ? `${dynamicLeads.toLocaleString()} user clicks` : '0 user clicks'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Optimization Suggestion Bento Panel (col-span-12 lg:col-span-4) */}
                <div className="col-span-12 lg:col-span-4 bg-indigo-600 rounded-3xl shadow-lg p-6 text-white flex flex-col justify-between hover:scale-[1.01] transition-transform duration-200 bg-gradient-to-br from-indigo-600 to-indigo-800 border border-indigo-700 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
                    <Sparkles className="w-44 h-44" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono">Gemini Smart Catalyst</span>
                      <Sparkles className="w-4 h-4 text-white animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold leading-snug mb-2 font-display">Auto-Refine Target Interests</h3>
                    <p className="text-indigo-120 text-xs font-medium leading-relaxed font-sans opacity-90">
                      Our system aligns your creative descriptions with natural language search targets to suggest best converting keywords.
                    </p>
                  </div>
                  
                  <div className="space-y-2 mt-4 relative z-10">
                    {campaigns.length > 0 ? (
                      <button
                        onClick={() => handleOptimizeCampaign(campaigns[0].id)}
                        disabled={optimizingId !== null}
                        className="w-full bg-white hover:bg-slate-50 text-indigo-600 font-bold py-3 px-4 rounded-xl text-xs transition shadow-md cursor-pointer block text-center"
                      >
                        {optimizingId ? 'Analysing Campaign...' : '✨ Run Gemini Optimizer'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveTab('create')}
                        className="w-full bg-white hover:bg-slate-50 text-indigo-600 font-bold py-3 px-4 rounded-xl text-xs transition shadow-md cursor-pointer block text-center"
                      >
                        Build Campaign to Begin
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Center Small: Quick Action (col-span-12 sm:col-span-7 lg:col-span-9) */}
                <div 
                  onClick={() => setActiveTab('create')}
                  className="col-span-12 sm:col-span-7 lg:col-span-9 bg-white rounded-3xl border border-slate-200 hover:border-indigo-300 shadow-xs p-6 flex items-center justify-between cursor-pointer group transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 transition-colors">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 leading-tight font-display text-sm group-hover:text-indigo-600 transition-colors">Setup Dynamic Advertising Campaign</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">Configure geo-targeting constraints, bidding rules, budgets and schedule pacing</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>

                {/* 4. Center Bottom: Monthly Budget Radial (col-span-12 sm:col-span-5 lg:col-span-3) */}
                <div className="col-span-12 sm:col-span-5 lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 font-mono">MONTHLY PACING LIMIT</span>
                  <div className="relative w-24 h-24 flex items-center justify-center mb-3">
                    <svg className="absolute w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
                      <circle cx="48" cy="48" r="40" fill="transparent" stroke="#4f46e5" strokeWidth="6" strokeDasharray="251" strokeDashoffset={
                        campaigns.length > 0 ? "75" : "251"
                      } strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="text-center">
                      <p className="text-base font-bold font-display text-slate-800 leading-none">
                        {campaigns.length > 0 ? '70%' : '0%'}
                      </p>
                      <p className="text-[8px] text-slate-400 font-mono font-bold uppercase mt-0.5">Utilized</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 px-1 leading-relaxed">
                    {campaigns.length > 0 
                      ? `$${campaigns.reduce((acc, curr) => acc + curr.budgetAmount, 0).toLocaleString()} limit configured.` 
                      : 'Create campaigns to track values.'
                    }
                  </p>
                </div>

              </div>

              {/* Dynamic list headers */}
              <div className="pt-8 border-t border-slate-200">
                <div className="mb-6">
                  <h3 className="text-base font-bold text-slate-900 font-display">Active Campaign Planners & Controls</h3>
                  <p className="text-xs text-slate-500">Monitor advertisement approval states, complete balance payments and run suggestions filters.</p>
                </div>

                {campaigns.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-xs">
                    <LayoutDashboard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-semibold text-slate-700 font-display">No campaigns configured yet</h4>
                    <p className="text-slate-400 text-xs mt-1 mb-4">Launch your first target demographics and set custom daily bidding structures.</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Build Campaigns
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {campaigns.map((camp) => (
                    <div key={camp.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between transition-colors">
                      <div className="p-5 space-y-4">
                        
                        {/* Title Row with Badge */}
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono block mb-1">ID: {camp.id}</span>
                            <h3 className="font-display font-semibold text-base text-slate-900">{camp.title}</h3>
                          </div>

                          {/* Status Badger styling */}
                          <span>
                            {camp.status === 'active' && (
                              <span className="bg-emerald-100 text-emerald-800 font-mono text-[9px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active Live
                              </span>
                            )}
                            {camp.status === 'pending' && (
                              <span className="bg-amber-100 text-amber-800 font-mono text-[9px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 uppercase">
                                <Clock className="w-3 h-3 animate-spin text-amber-500" />
                                Pending Approve
                              </span>
                            )}
                            {camp.status === 'rejected' && (
                              <span className="bg-red-100 text-red-800 font-mono text-[9px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 uppercase">
                                <XCircle className="w-3 h-3" />
                                Rejected
                              </span>
                            )}
                            {camp.status === 'draft' && (
                              <span className="bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[9px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 uppercase">
                                Unpaid Draft
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Image preview */}
                        {camp.imageUrl && (
                          <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-50 border border-slate-100">
                            {camp.imageUrl.startsWith('data:video/') || camp.imageUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/i) ? (
                              <video 
                                src={camp.imageUrl} 
                                controls
                                className="w-full h-full object-cover bg-black" 
                              />
                            ) : (
                              <img 
                                src={camp.imageUrl} 
                                alt="Ad graphics visual pointer" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                        )}

                        {/* Description Paragraph */}
                        <p className="text-xs text-slate-500 font-mono leading-relaxed line-clamp-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          {camp.description}
                        </p>

                        {/* Key targeting characteristics */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <span className="text-[10px] text-slate-400 uppercase font-mono block">Budget Cap</span>
                            <span className="font-semibold text-slate-800">${camp.budgetAmount} ({camp.budgetType === 'daily' ? 'Daily' : 'Total'})</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <span className="text-[10px] text-slate-400 uppercase font-mono block">Spent Amount</span>
                            <span className="font-semibold text-slate-800">${camp.spendingAmount} SGD</span>
                          </div>
                        </div>

                        {/* Spend Pacing Progress Bar */}
                        {(() => {
                          const budget = camp.budgetAmount || 1;
                          const ratio = camp.spendingAmount / budget;
                          const percentage = Math.min(Math.round(ratio * 100), 100);
                          const formattedPercent = (ratio * 100).toFixed(1);
                          return (
                            <div className="space-y-1.5 p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl" id={`pacing-progress-bar-${camp.id}`}>
                              <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                                <span>Pacing utilization</span>
                                <span className={`font-mono font-bold text-[10px] ${
                                  percentage >= 90 ? 'text-red-650' : percentage >= 50 ? 'text-amber-650' : 'text-indigo-650'
                                }`}>
                                  {formattedPercent}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/80 relative">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                                    percentage >= 90 
                                      ? 'from-red-500 to-rose-600' 
                                      : percentage >= 50 
                                        ? 'from-amber-400 to-orange-500' 
                                        : 'from-indigo-500 to-indigo-600'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Budget Alert (Within 10% of Budget Amount) */}
                        {camp.spendingAmount >= (camp.budgetAmount * 0.9) && (
                          <div 
                            id={`budget-alert-${camp.id}`} 
                            className="bg-red-50/80 border border-red-100 rounded-xl p-2.5 flex items-start gap-2.5 text-[11px] text-red-800 leading-relaxed shadow-xs"
                          >
                            <AlertTriangle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 animate-pulse" style={{ color: '#ef4444' }} />
                            <div className="space-y-0.5">
                              <span className="font-semibold text-slate-900 block font-display">Budget Alert</span>
                              <p className="text-slate-500">Your campaign has exhausted over 90% of its budget limit. Please top up your account funds to prevent delivery throttling.</p>
                            </div>
                          </div>
                        )}

                        {/* Start and end dates */}
                        <div className="text-[11px] font-mono text-slate-500 flex justify-between pt-1">
                          <span>Start: {camp.startDate}</span>
                          <span>Ends: {camp.endDate}</span>
                        </div>

                        {/* Rejection logs warning block */}
                        {camp.status === 'rejected' && camp.rejectReason && (
                          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-800 font-mono">
                            <span className="font-bold flex items-center gap-1 uppercase text-[10px] mb-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Rejection Analysis:
                            </span>
                            {camp.rejectReason}
                          </div>
                        )}

                        {/* Applied Targeting Specs logs */}
                        <div className="font-mono text-[10px] text-slate-400 border-t border-slate-100 pt-2.5">
                          <span className="font-semibold text-slate-600 block mb-1">ACTIVE TARGET DEMOGRAPHICS:</span>
                          <div>Location: {camp.targetAudience.location}</div>
                          <div>Ages: {camp.targetAudience.ageMin}-{camp.targetAudience.ageMax}</div>
                          <div className="truncate">Interests: {camp.targetAudience.interests.join(', ') || 'N/A'}</div>
                          <div className="truncate">Keywords: {(camp.keywords ?? []).join(', ') || 'N/A'}</div>
                        </div>

                      </div>

                      {/* Primary Actions Workspace button line */}
                      <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex gap-3 items-center justify-between">
                        
                        {/* Left button: Delete campaign */}
                        <button
                          onClick={() => handleDeleteCampaign(camp.id, camp.title)}
                          disabled={actionLoadingId === camp.id}
                          className="p-1 px-2 hover:bg-red-50 text-red-500 rounded-lg hover:text-red-700 transition cursor-pointer"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Right interactive button blocks */}
                        <div className="flex gap-2">
                          
                          {/* Gemini optimization suggestions engine trigger */}
                          {camp.status !== 'rejected' && (
                            <button
                              onClick={() => handleOptimizeCampaign(camp.id)}
                              disabled={optimizingId === camp.id}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:bg-slate-300"
                            >
                              <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                              {optimizingId === camp.id ? 'Structuring tags...' : '✨ Gemini Optimizer'}
                            </button>
                          )}

                          {/* Completes payments inside app */}
                          {camp.status === 'draft' && (
                            <button
                              onClick={() => handleOpenCheckout(camp)}
                              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer border border-slate-800"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Settle & Run Ad
                            </button>
                          )}

                        </div>

                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {/* ==========================================
              MODAL DETAILED WIDGET: GEMINI SUGGESTIONS
             ========================================== */}
          {suggestedCampaignId && (
            <div className="fixed inset-0 z-50 bg-slate-900/45 md:p-6 backdrop-blur-xs flex items-center justify-center">
              <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
                
                <h3 className="font-display font-bold text-lg text-slate-900 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  Gemini-powered Advertisement Optimization suggestions
                </h3>
                <p className="text-slate-400 text-xs font-mono mb-5 border-b border-slate-100 pb-3">
                  This system optimizes budgets and demographic targets by matching campaign headers in natural language models.
                </p>

                {(!aiSuggestion) ? (
                  <div className="py-12 text-center text-xs text-slate-500 font-mono space-y-3">
                    <p className="animate-pulse text-indigo-600">Loading AI models data pipeline...</p>
                    <p className="text-[10px] text-slate-400">Querying real-time @google/genai libraries.</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs font-mono">
                    <div className="p-3 bg-indigo-50/50 border border-indigo-105 rounded-xl text-slate-800">
                      <span className="font-bold text-indigo-800 block text-[10px] mb-1">STRATEGIC ROI RATIONALE:</span>
                      <p className="leading-relaxed">{aiSuggestion.explanation}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span className="font-bold text-slate-700 block text-[10px] mb-1">OPTIMIZED AGES:</span>
                        <p className="font-bold text-md text-slate-950 font-sans">{aiSuggestion.suggestedAges.min} - {aiSuggestion.suggestedAges.max} years old</p>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span className="font-bold text-slate-700 block text-[10px] mb-1">STRATEGIC TIMING TIMEFRAMES:</span>
                        <ul className="list-disc pl-4 text-slate-600 font-mono">
                           {aiSuggestion.suggestedTimes.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl">
                      <span className="font-bold text-slate-705 block text-[10px] mb-1">RECOMMENDED RETARGET INTEREST LABELS:</span>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {aiSuggestion.suggestedInterests.map((interest, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded font-bold text-[10px] text-slate-700">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <span className="font-bold text-emerald-800 block text-[10px] mb-1">CONVERTING SEO SEARCH KEYWORDS:</span>
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {aiSuggestion.suggestedKeywords.map((keyword, i) => (
                          <span key={i} className="px-2.5 py-0.5 bg-white border border-emerald-200 rounded font-bold text-[10.5px] text-emerald-800 font-mono">
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex gap-3 text-sans font-sans">
                      <button
                        onClick={handleApplyAiSuggestions}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 cursor-pointer font-semibold text-xs transition text-center"
                      >
                        Auto-Apply Target Parameters
                      </button>
                      <button
                        onClick={() => {
                          setAiSuggestion(null);
                          setSuggestedCampaignId(null);
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer font-semibold text-xs transition text-center"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              TAB: CREATE CAMPAIGN
             ========================================== */}
          {activeTab === 'create' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Setup New Advertising Campaign</h2>
                <p className="text-sm text-slate-500">Construct advertisement segments, target distinct online traffic corridors, and verify budget rules.</p>
              </div>

              <form onSubmit={handleCreateCampaign} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Campaign Display Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eco-Friendly Bamboo Athletic Towels"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-800 border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Ad Creative Description Text</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide detailed description of the offer, product specs, pre-sale discounts and target consumer values..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-slate-50 text-slate-800 border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none leading-relaxed"
                  />
                </div>

                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Advertisement Visual Creative</label>
                    <span className="text-[10px] text-slate-400 font-mono">Optional</span>
                  </div>

                  {/* Toggle Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200/50">
                    <button
                      type="button"
                      onClick={() => setMediaSource('url')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                        mediaSource === 'url'
                          ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Paste URL / HTTPS Path
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaSource('upload')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center ${
                        mediaSource === 'upload'
                          ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Upload File (Max 200MB)
                    </button>
                  </div>

                  {mediaSource === 'url' ? (
                    <div className="space-y-1.5">
                      <input
                        type="url"
                        placeholder="Leave blank for auto-graphics, or paste image/video HTTPS path..."
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white text-slate-800 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:border-slate-400 outline-none font-mono"
                      />
                      <p className="text-[10px] text-slate-400">Specify an external secure URL pointing to an image (.png, .jpg) or video (.mp4).</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative border-2 border-dashed border-slate-200 hover:border-slate-300 transition-colors bg-white rounded-2xl p-6 text-center">
                        <input
                          type="file"
                          accept="image/*,video/*,image/gif"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                          <UploadCloud className="w-8 h-8 text-slate-400" />
                          <div className="text-xs font-semibold text-slate-600">Select image, video, or animation (GIF)</div>
                          <p className="text-[10px] text-slate-400">Formats: JPG, PNG, WEBP, GIF, MP4, WEBM (Max size: 200MB)</p>
                        </div>
                      </div>

                      {readingFile && (
                        <div className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 h-6 animate-pulse">
                          Reading file from client system and encoding... Please wait.
                        </div>
                      )}

                      {uploadError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-[11px] font-mono">
                          <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>{uploadError}</div>
                        </div>
                      )}

                      {uploadedBase64 && !readingFile && (
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                            <span className="font-semibold truncate max-w-[200px]" title={uploadedFileName}>{uploadedFileName}</span>
                            <span>{(uploadedFileSize / (1024 * 1024)).toFixed(2)} MB</span>
                          </div>

                          {/* Live preview */}
                          <div className="w-full h-28 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
                            {uploadedFileType.startsWith('video/') ? (
                              <video
                                src={uploadedBase64}
                                controls
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <img
                                src={uploadedBase64}
                                alt="Uploader preview"
                                className="w-full h-full object-contain"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Stated Target Location Scope</label>
                    <input
                      type="text"
                      placeholder="e.g. California, Germany, Metropolitan SF"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-800 border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Target Min Age</label>
                      <input
                        type="number"
                        min="16"
                        max="100"
                        value={ageMin}
                        onChange={(e) => setAgeMin(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-800 border-slate-200 rounded-xl text-xs focus:bg-white outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Target Max Age</label>
                      <input
                        type="number"
                        min="18"
                        max="100"
                        value={ageMax}
                        onChange={(e) => setAgeMax(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 text-slate-800 border-slate-200 rounded-xl text-xs focus:bg-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Audience Interests (comma separated)</label>
                    <input
                      type="text"
                      placeholder="Yoga, Fitness, Athletic Gear, Zero Waste"
                      value={interestsText}
                      onChange={(e) => setInterestsText(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">SEO keywords (comma separated)</label>
                    <input
                      type="text"
                      placeholder="premium towels, sustainable athletic, bamboo non-slip"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Budget Rate Plan</label>
                    <select
                      value={budgetType}
                      onChange={(e: any) => setBudgetType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border-slate-200 rounded-xl text-xs focus:bg-white outline-none"
                    >
                      <option value="daily">Daily advertising budget</option>
                      <option value="total">Total Campaign Pacing cap</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Budget value ($ USD)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="50"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 text-slate-800 border-slate-200 rounded-xl text-xs focus:bg-white outline-none font-mono"
                    />
                    {settings && (
                      <span className="text-[10px] text-slate-400 font-mono block">Platform Minimum: ${settings.minDailyBudget}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Start Date</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2 py-2 bg-slate-50 border-slate-200 rounded-xl focus:bg-white outline-none font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">End Date</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-2 py-2 bg-slate-50 border-slate-200 rounded-xl focus:bg-white outline-none font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  Save as Unpaid Draft Campaign
                </button>

              </form>
            </div>
          )}

          {/* ==========================================
              TAB: SUPPORT DEPT COMPLAINTS DESK
             ========================================== */}
          {activeTab === 'help' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Submit ticket column */}
                <div className="lg:col-span-1 space-y-4">
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">File Inquiries & Feedback</h2>
                    <p className="text-xs text-slate-500">Contact admin operators for approval disputes, billing pacing, or algorithm adjustments.</p>
                  </div>

                  <form onSubmit={handleCreateComplaint} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Ticket Subject</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Budget billing query"
                        value={complaintSubject}
                        onChange={(e) => setComplaintSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Help Request Message</label>
                      <textarea
                        rows={5}
                        required
                        placeholder="Provide deep details, transaction IDs or rule sections references..."
                        value={complaintMessage}
                        onChange={(e) => setComplaintMessage(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:bg-white focus:border-slate-400 outline-none leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer flex justify-center items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit to Inquire Queue
                    </button>
                  </form>
                </div>

                {/* History list column */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-display font-medium text-slate-800 text-base">Inquiry Histories</h3>
                  
                  {complaints.length === 0 ? (
                    <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center text-slate-400 italic text-xs font-mono">
                      No tickets submitted by your account.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {complaints.map((comp) => (
                        <div key={comp.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
                          <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            <div>
                              <span className="text-[10px] text-indigo-500 font-mono font-bold block">{comp.id}</span>
                              <span className="font-bold text-slate-800 text-xs">{comp.subject}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase inline-block ${
                              comp.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {comp.status}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 font-mono pl-1">{comp.message}</p>

                          {comp.reply && (
                            <div className="p-3 bg-emerald-50/60 border border-emerald-100/50 rounded-xl text-xs space-y-1 font-mono">
                              <span className="text-emerald-800 uppercase font-bold text-[9px] block">Portal Admin Answer:</span>
                              <p className="text-slate-600 leading-relaxed">{comp.reply}</p>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB: ACCOUNT PROFILE & SECURITY
             ========================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">Profile & Security Headquarters</h2>
                <p className="text-sm text-slate-500">Edit business contacts, corporate details, or manage credentials safely.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Save details form */}
                <form onSubmit={handleSaveProfile} className="bg-white border border-slate-205 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-1 text-slate-700 text-xs font-bold uppercase tracking-wider pb-2 border-b border-slate-100">
                    <UserIcon className="w-4 h-4 text-indigo-600" />
                    Business details
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Personal Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 text-xs rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Registered Corporate Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 text-xs rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Mobile Phone Line</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 text-xs font-mono rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs transition cursor-pointer"
                  >
                    Save business profile
                  </button>
                </form>

                {/* Change security password form */}
                <form onSubmit={handleChangePassword} className="bg-white border border-slate-205 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-1 text-slate-700 text-xs font-bold uppercase tracking-wider pb-2 border-b border-slate-100">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Reset Password credentials
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Current active password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 text-xs rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Submit new password string</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-205 text-xs rounded-xl focus:bg-white outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !newPassword || !currentPassword}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-xl text-xs transition cursor-pointer disabled:bg-slate-300"
                  >
                    Set New Password
                  </button>
                </form>

              </div>
            </div>
          )}

          {/* ==========================================
              MODAL DETAILED WIDGET: BILLING CHECKOUT
             ========================================== */}
          {isCheckoutOpen && checkoutCampaign && (
            <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 md:p-6 backdrop-blur-xs flex items-center justify-center">
              <form onSubmit={handleProcessSimulatedPayment} className="bg-white border border-slate-300 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 relative">
                
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-1.5">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    Simulated Dynamic Checkout Payment
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Settle dynamic bids, generate receipt transaction logs, and promote ads to active queues.
                  </p>
                </div>

                {/* Campaign context recap */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1 text-xs">
                  <div className="font-bold text-slate-700">Campaign details:</div>
                  <div className="text-slate-950 font-semibold">{checkoutCampaign.title}</div>
                  <div className="font-mono text-[10px] text-slate-400">ID: {checkoutCampaign.id} • Rate: ${checkoutCampaign.budgetAmount} ({checkoutCampaign.budgetType})</div>
                </div>

                {/* Card or mobile wallet input spaces */}
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`space-y-1 ${paymentMethod === 'bKash' || paymentMethod === 'Nagad' ? 'col-span-2' : ''}`}>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment Gateway</label>
                      <select 
                        value={paymentMethod}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value);
                          if (e.target.value === 'bKash' || e.target.value === 'Nagad') {
                            setTrxId('');
                            setSenderPhone('');
                          }
                        }}
                        className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                      >
                        <option value="Credit Card">Credit Card</option>
                        <option value="Bank Wire">Bank Wire Transfer</option>
                        <option value="bKash">bKash (01954802524)</option>
                        <option value="Nagad">Nagad (01954802524)</option>
                      </select>
                    </div>

                    {(paymentMethod === 'Credit Card' || paymentMethod === 'Bank Wire') && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Card Issuer</label>
                        <select 
                          value={cardBrand}
                          onChange={(e) => setCardBrand(e.target.value)}
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                        >
                          <option value="Visa">Visa</option>
                          <option value="Mastercard">Mastercard</option>
                          <option value="American Express">American Express</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {paymentMethod === 'bKash' || paymentMethod === 'Nagad' ? (
                    <div className="space-y-4">
                      {/* Mobile banking instruction card block */}
                      <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse animate-duration-1000" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                            {paymentMethod} Transfer Instruction
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Please open your {paymentMethod} app, tap <strong>Send Money</strong>, and type the official recipient number:
                        </p>
                        <div className="flex items-center justify-between bg-white px-3 py-1.5 border border-indigo-105 rounded-xl">
                          <span className="font-mono text-sm font-bold text-slate-800 tracking-wider">
                            01954802524
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText("01954802524");
                              alert("Official phone number 01954802524 was copied to clipboard successfully!");
                            }}
                            className="text-[10px] uppercase font-bold text-indigo-600 hover:text-indigo-800 font-mono transition"
                          >
                            Copy Number
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Sender Mobile Number
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. 01954802524 (11-digit number)"
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-mono rounded-xl focus:bg-white outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Transaction ID (TrxID)
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. TRX82937510"
                          value={trxId}
                          onChange={(e) => setTrxId(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-mono rounded-xl focus:bg-white outline-none uppercase"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">16-Digit card number</label>
                        <input 
                          type="text" 
                          required
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-mono rounded-xl focus:bg-white outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Expiration date</label>
                          <input 
                            type="text" 
                            required
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-mono rounded-xl focus:bg-white outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Security Code (CVC)</label>
                          <input 
                            type="password" 
                            required
                            maxLength={4}
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 font-mono rounded-xl focus:bg-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex gap-3 text-sans font-sans">
                  <button
                    type="submit"
                    disabled={actionLoadingId === checkoutCampaign.id}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-center text-xs transition cursor-pointer"
                  >
                    {actionLoadingId === checkoutCampaign.id ? 'Authorizing secure payment...' : 'Pay & Run Live Ads'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutCampaign(null);
                      setIsCheckoutOpen(false);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-250 text-slate-600 rounded-xl cursor-pointer text-xs transition font-semibold text-center"
                  >
                    Cancel Draft
                  </button>
                </div>

              </form>
            </div>
          )}

        </main>
      </div>

      {/* Floating real-time status alerts portal overlay */}
      <div 
        className="fixed bottom-5 right-5 z-55 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
        id="ws-toast-alerts-portal"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className={`p-4 bg-white border rounded-2xl shadow-2xl pointer-events-auto flex gap-3 relative overflow-hidden ${
                toast.type === 'success' 
                  ? 'border-emerald-250 shadow-emerald-50' 
                  : 'border-rose-250 shadow-rose-50'
              }`}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-indigo-700" />
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono leading-tight">
                    {toast.type === 'success' ? '🚀 Campaign Approved' : '❌ Campaign Rejected'}
                  </span>
                  <button 
                    onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                    className="text-slate-400 hover:text-slate-700 font-mono text-xs cursor-pointer px-1.5 py-0.5 rounded-lg hover:bg-slate-50 transition border border-transparent"
                  >
                    ×
                  </button>
                </div>
                <h4 className="font-display font-semibold text-xs text-slate-900 leading-snug">{toast.title}</h4>
                <p className="text-[11px] text-slate-500 leading-normal">{toast.message}</p>
                {toast.reason && (
                  <div className="mt-2 text-[10px] text-rose-850 bg-rose-50 border border-rose-100 p-2 rounded-lg font-mono leading-relaxed">
                    <strong>Reason:</strong> {toast.reason}
                  </div>
                )}
                <div className="text-[9px] text-slate-400 font-mono pt-1 text-right">
                  {toast.timestamp}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
