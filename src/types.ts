export interface User {
  id: string;
  email: string;
  name: string;
  role: 'advertiser' | 'admin';
  status: 'active' | 'inactive';
  companyName?: string;
  phone?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  advertiserId: string;
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  targetAudience: {
    location: string;
    ageMin: number;
    ageMax: number;
    interests: string[];
  };
  budgetType: 'daily' | 'total';
  budgetAmount: number;
  spendingAmount: number;
  startDate: string;
  endDate: string;
  status: 'pending' | 'active' | 'rejected' | 'draft';
  rejectReason?: string;
  createdAt: string;
  paymentId?: string;
  keywords?: string[];
  optimalTimes?: string[];
}

export interface PaymentLog {
  id: string;
  campaignId: string;
  campaignTitle: string;
  advertiserId: string;
  advertiserName: string;
  amount: number;
  paymentMethod: string;
  cardBrand: string;
  last4: string;
  status: 'completed' | 'failed';
  transactionDate: string;
  trxId?: string;
  senderPhone?: string;
}

export interface Complaint {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  reply?: string;
  status: 'pending' | 'resolved';
  createdAt: string;
}

export interface PlatformSettings {
  adRules: string;
  pricingCpc: number;
  optimizationLevel: 'basic' | 'advanced' | 'ai-orchestrated';
  minDailyBudget: number;
}

export interface AdSuggestion {
  suggestedKeywords: string[];
  suggestedAges: { min: number; max: number };
  suggestedInterests: string[];
  suggestedTimes: string[];
  explanation: string;
}
