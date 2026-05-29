import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, setDoc, collection, deleteDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize express app
const app = express();
const PORT = 3000;

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

interface ClientConnection {
  ws: WebSocket;
  advertiserId?: string;
}
const connectedClients = new Set<ClientConnection>();

wss.on("connection", (ws) => {
  const connection: ClientConnection = { ws };
  connectedClients.add(connection);
  console.log("New WebSocket advertiser connected.");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "subscribe" && data.advertiserId) {
        connection.advertiserId = data.advertiserId;
        console.log(`WebSocket client subscribed to advertiser: ${data.advertiserId}`);
        ws.send(JSON.stringify({ type: "subscribed", advertiserId: data.advertiserId }));
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    connectedClients.delete(connection);
    console.log("WebSocket client disconnected.");
  });
});

const broadcastCampaignStatusChange = (campaignId: string, title: string, advertiserId: string, oldStatus: string, newStatus: string, rejectReason?: string) => {
  connectedClients.forEach(client => {
    if (client.advertiserId === advertiserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: "status_changed",
        campaignId,
        title,
        oldStatus,
        newStatus,
        rejectReason
      }));
    }
  });
};

// Enable JSON body parsing with clean formats
app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini API client:", error);
  }
} else {
  console.log("No valid GEMINI_API_KEY found, running in offline fallback mode for suggestions.");
}

// ==========================================
// FIREBASE FIRESTORE ADAPTER
// ==========================================

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Generic Firestore Helpers
const getUsers = async () => {
  const q = collection(db, "users");
  const snapshot = await getDocs(q);
  const list: any[] = [];
  snapshot.forEach(d => list.push(d.data()));
  return list;
};

const saveUser = async (user: any) => {
  await setDoc(doc(db, "users", user.id), user);
};

const getCampaigns = async () => {
  const q = collection(db, "campaigns");
  const snapshot = await getDocs(q);
  const list: any[] = [];
  snapshot.forEach(d => list.push(d.data()));
  return list;
};

const saveCampaign = async (campaign: any) => {
  await setDoc(doc(db, "campaigns", campaign.id), campaign);
};

const deleteCampaignDb = async (id: string) => {
  await deleteDoc(doc(db, "campaigns", id));
};

const getPayments = async () => {
  const q = collection(db, "payments");
  const snapshot = await getDocs(q);
  const list: any[] = [];
  snapshot.forEach(d => list.push(d.data()));
  return list;
};

const savePayment = async (payment: any) => {
  await setDoc(doc(db, "payments", payment.id), payment);
};

const getComplaints = async () => {
  const q = collection(db, "complaints");
  const snapshot = await getDocs(q);
  const list: any[] = [];
  snapshot.forEach(d => list.push(d.data()));
  return list;
};

const saveComplaint = async (complaint: any) => {
  await setDoc(doc(db, "complaints", complaint.id), complaint);
};

const getPlatformSettings = async () => {
  const docRef = doc(db, "settings", "global");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  const defaultSettings = {
    adRules: "1. No misleading claims or overnight wealth templates. \n2. Medical products require proof of FDA certifications. \n3. Content appropriate for audience 16+. \n4. Transparent contact disclosure and clear pricing guidelines.",
    pricingCpc: 0.75,
    optimizationLevel: "ai-orchestrated",
    minDailyBudget: 10
  };
  await setDoc(docRef, defaultSettings);
  return defaultSettings;
};

const savePlatformSettings = async (settings: any) => {
  await setDoc(doc(db, "settings", "global"), settings);
};

// ==========================================
// SEEDING ON STARTUP
// ==========================================

const seedDatabaseIfEmpty = async () => {
  try {
    const existingUsers = await getUsers();
    if (existingUsers.length === 0) {
      console.log("Seeding initial database users to Firestore...");
      const initialUsers = [
        {
          id: "user-3",
          email: "admin@platform.com",
          name: "Platform Chief Admin",
          role: "admin",
          status: "active",
          companyName: "Ad Portal Inc.",
          phone: "911-3000",
          password: "password",
          createdAt: "2025-11-01T12:00:00Z"
        },
        {
          id: "user-1",
          email: "alice@test.com",
          name: "Alice Jenkins",
          role: "advertiser",
          status: "active",
          companyName: "Apex Retail Solutions",
          phone: "555-0192",
          password: "password",
          createdAt: "2026-01-15T08:30:00Z"
        },
        {
          id: "user-2",
          email: "bob@test.com",
          name: "Bob Cooper",
          role: "advertiser",
          status: "active",
          companyName: "TechSphere Consulting",
          phone: "555-0481",
          password: "password",
          createdAt: "2026-02-10T14:45:00Z"
        },
        {
          id: "user-4",
          email: "shadowy_ad_scammer@spambox.net",
          name: "Shady Ads Admin",
          role: "advertiser",
          status: "inactive",
          companyName: "Quick Cash Overnight",
          phone: "1-800-SPAM",
          password: "password",
          createdAt: "2026-03-01T10:00:00Z"
        }
      ];
      for (const u of initialUsers) {
        await saveUser(u);
      }
    }

    const existingCampaigns = await getCampaigns();
    if (existingCampaigns.length === 0) {
      console.log("Seeding initial campaigns to Firestore...");
      const initialCampaigns = [
        {
          id: "camp-1",
          advertiserId: "user-1",
          title: "Apex Summer Outdoor Jacket Pre-sale",
          description: "Get 25% off our premium, waterproof windbreakers and hiking apparel. Ultra-light, highly breathable fabric designed for mountain adventures and wet environments.",
          imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80",
          targetAudience: {
            location: "United States, Canada",
            ageMin: 22,
            ageMax: 50,
            interests: ["Hiking", "Camping", "Outdoor Activities", "Eco Fashion", "Travel"]
          },
          budgetType: "daily",
          budgetAmount: 150,
          spendingAmount: 2450,
          startDate: "2026-06-01",
          endDate: "2026-08-31",
          status: "active",
          createdAt: "2026-05-10T09:00:00Z",
          paymentId: "pay-101",
          keywords: ["waterproof windbreaker", "hiking jackets", "outdoor presale", "breathable rain gear", "Apex outdoors"],
          optimalTimes: ["Morning (8:00 AM - 10:00 AM)", "Lunch Hour (12:00 PM - 1:30 PM)", "Evening (6:00 PM - 9:00 PM)"]
        },
        {
          id: "camp-2",
          advertiserId: "user-2",
          title: "TechSphere Cloud Infrastructure Demo",
          description: "Simplify your Kubernetes orchestration and serverless workflows. Deploy microservices internationally with 99.999% uptime guarantees and high performance metrics.",
          imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80",
          targetAudience: {
            location: "Global",
            ageMin: 25,
            ageMax: 60,
            interests: ["Software Engineering", "Cloud Architecture", "DevOps", "Kubernetes", "SaaS startups"]
          },
          budgetType: "total",
          budgetAmount: 5000,
          spendingAmount: 3120,
          startDate: "2026-05-01",
          endDate: "2026-07-15",
          status: "active",
          createdAt: "2026-04-25T11:20:00Z",
          paymentId: "pay-102",
          keywords: ["serverless container deployment", "multi cloud management", "DevOps orchestration", "microservices setup"],
          optimalTimes: ["Working Hours (9:00 AM - 5:00 PM)"]
        },
        {
          id: "camp-3",
          advertiserId: "user-1",
          title: "Gourmet Coffee Subscription Box",
          description: "Ethically sourced, single-origin whole bean coffee shipped directly from independent high-altitude farms to your door. Dynamic taste profiles rotated monthly.",
          imageUrl: "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=600&auto=format&fit=crop&q=80",
          targetAudience: {
            location: "Metropolitan Areas (Chicago, NY, SF)",
            ageMin: 18,
            ageMax: 45,
            interests: ["Specialty Coffee", "Subscription Services", "Eco-friendly", "Home Brewing", "Organic Food"]
          },
          budgetType: "daily",
          budgetAmount: 40,
          spendingAmount: 0,
          startDate: "2026-06-15",
          endDate: "2026-09-15",
          status: "pending",
          createdAt: "2026-05-27T16:15:00Z",
          keywords: ["single origin coffee", "artisan coffee delivery", "coffee subscription", "morning brew boxes"]
        },
        {
          id: "camp-4",
          advertiserId: "user-4",
          title: "Shady Overnight Financial Loophole Guide",
          description: "Secret methods banks do not want you to know! Turn $10 into $5000 index funds within 2 weeks with absolute zero margin risk. Guaranteed compound return ratios.",
          imageUrl: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80",
          targetAudience: {
            location: "Worldwide",
            ageMin: 18,
            ageMax: 80,
            interests: ["Get Rich Quick", "Cryptocurrency", "Day Trading", "Financial Freedom"]
          },
          budgetType: "total",
          budgetAmount: 10000,
          spendingAmount: 0,
          startDate: "2026-05-15",
          endDate: "2026-05-25",
          status: "rejected",
          rejectReason: "Violates system rule Section 3.2: Offers misleading financial returns, get-rich-quick claims, and lacks valid financial compliance verification text.",
          createdAt: "2026-05-10T11:00:00Z"
        },
        {
          id: "camp-5",
          advertiserId: "user-1",
          title: "Eco-Friendly Bamboo Yoga Towels",
          description: "Ultra-absorbent non-slip natural athletic towels. Hypoallergenic, biodegradable, and double-sided patterns matching clean bohemian studio aesthetics.",
          imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&auto=format&fit=crop&q=80",
          targetAudience: {
            location: "California, Oregon, Washington",
            ageMin: 20,
            ageMax: 55,
            interests: ["Yoga", "Meditation", "Athletic Apparel", "Zero Waste", "Vegan Lifestyle"]
          },
          budgetType: "daily",
          budgetAmount: 30,
          spendingAmount: 0,
          startDate: "2026-06-10",
          endDate: "2026-07-10",
          status: "draft",
          createdAt: "2026-05-28T09:40:00Z"
        }
      ];
      for (const c of initialCampaigns) {
        await saveCampaign(c);
      }
    }

    const existingPayments = await getPayments();
    if (existingPayments.length === 0) {
      console.log("Seeding initial payments to Firestore...");
      const initialPayments = [
        {
          id: "pay-101",
          campaignId: "camp-1",
          campaignTitle: "Apex Summer Outdoor Jacket Pre-sale",
          advertiserId: "user-1",
          advertiserName: "Alice Jenkins",
          amount: 1500,
          paymentMethod: "Credit Card",
          cardBrand: "Visa",
          last4: "4242",
          status: "completed",
          transactionDate: "2026-05-09T18:00:20Z"
        },
        {
          id: "pay-102",
          campaignId: "camp-2",
          campaignTitle: "TechSphere Cloud Infrastructure Demo",
          advertiserId: "user-2",
          advertiserName: "Bob Cooper",
          amount: 5000,
          paymentMethod: "Bank Transfer",
          cardBrand: "Mastercard",
          last4: "9876",
          status: "completed",
          transactionDate: "2026-04-24T10:15:30Z"
        }
      ];
      for (const p of initialPayments) {
        await savePayment(p);
      }
    }

    const existingComplaints = await getComplaints();
    if (existingComplaints.length === 0) {
      console.log("Seeding initial complaints to Firestore...");
      const initialComplaints = [
        {
          id: "comp-1",
          userId: "user-1",
          userName: "Alice Jenkins",
          userEmail: "alice@test.com",
          subject: "Ad approval is taking minor delay",
          message: "Greetings, my Gourmet Coffee campaign has been in pending status for 24 hours. Could you please check if there is any violation or if it's waiting in the moderation queue? Thanks!",
          reply: "Hello Alice, we apologize for the wait. Your coffee campaign was flagged by the autocheck filters for secondary coffee estate review. Our team verified that it is highly compliant. It is now cleared for final review.",
          status: "resolved",
          createdAt: "2026-05-27T17:00:00Z"
        },
        {
          id: "comp-2",
          userId: "user-2",
          userName: "Bob Cooper",
          userEmail: "bob@test.com",
          subject: "Budget daily distribution options query",
          message: "Is there any setup to restrict delivery during specific hours of the day to maximize cost-per-click efficiency, or is budget spread evenly across all 24 hours?",
          status: "pending",
          createdAt: "2026-05-28T11:10:00Z"
        }
      ];
      for (const comp of initialComplaints) {
        await saveComplaint(comp);
      }
    }

    // Initialize Global Settings
    await getPlatformSettings();
  } catch (error) {
    console.error("Error during Firestore seeding:", error);
  }
};

let isSeeded = false;
app.use(async (req, res, next) => {
  if (!isSeeded) {
    try {
      await seedDatabaseIfEmpty();
      isSeeded = true;
    } catch (e) {
      console.error("Lazy database seeding failed:", e);
    }
  }
  next();
});

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

// ==========================================
// API ENDPOINTS & LOGIC
// ==========================================

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, companyName, phone, role, adminCode } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Missing required registration parameters." });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const allUsers = await getUsers();

    if (role === "admin") {
      const cleanCode = adminCode ? adminCode.trim() : "";
      if (cleanCode !== "group 5" && cleanCode !== "[ group 5]" && cleanCode !== "[group 5]") {
        return res.status(403).json({ error: "Unauthorized: Invalid security registration code to register as a Platform Admin." });
      }

      let adminUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail && u.role === "admin");
      if (adminUser) {
        adminUser.name = name;
        if (password) adminUser.password = password;
        if (phone) adminUser.phone = phone;
        await saveUser(adminUser);
      } else {
        adminUser = {
          id: generateId("admin"),
          email: cleanEmail,
          name,
          role: "admin",
          status: "active",
          companyName: "Ad Portal Inc.",
          phone: phone || "",
          password,
          createdAt: new Date().toISOString()
        };
        await saveUser(adminUser);
      }

      // Sync/Upsert as advertiser too so they can access advertiser panel
      let advertiserUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail && u.role === "advertiser");
      if (advertiserUser) {
        advertiserUser.name = name;
        if (password) advertiserUser.password = password;
        if (phone) advertiserUser.phone = phone;
        await saveUser(advertiserUser);
      } else {
        advertiserUser = {
          id: generateId("user"),
          email: cleanEmail,
          name,
          role: "advertiser",
          status: "active",
          companyName: companyName || "Ad Portal Inc.",
          phone: phone || "",
          password,
          createdAt: new Date().toISOString()
        };
        await saveUser(advertiserUser);
      }

      const { password: _, ...userSafe } = adminUser;
      return res.status(201).json({ user: userSafe });

    } else {
      let advertiserUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail && u.role === "advertiser");
      if (advertiserUser) {
        if (advertiserUser.password === password) {
          const { password: _, ...userSafe } = advertiserUser;
          return res.status(201).json({ user: userSafe });
        } else {
          return res.status(409).json({ error: "User with this email already exists." });
        }
      }

      const newUser = {
        id: generateId("user"),
        email: cleanEmail,
        name,
        role: "advertiser",
        status: "active" as const,
        companyName: companyName || "",
        phone: phone || "",
        password,
        createdAt: new Date().toISOString()
      };
      await saveUser(newUser);

      const { password: _, ...userSafe } = newUser;
      return res.status(201).json({ user: userSafe });
    }
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration database transaction failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password, role, adminCode } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const allUsers = await getUsers();

    if (role === 'admin') {
      const admin = allUsers.find(u => u.role === "admin" && u.email.toLowerCase() === cleanEmail && u.password === password);
      if (!admin) {
        return res.status(401).json({ error: "Invalid admin email or password. Please verify your credentials or register as an Admin." });
      }

      if (admin.status === "inactive") {
        return res.status(403).json({ error: "Your admin account is currently deactivated. Please contact support." });
      }

      const cleanCode = adminCode ? adminCode.trim() : "";
      if (cleanCode !== "group 5" && cleanCode !== "[ group 5]" && cleanCode !== "[group 5]") {
        return res.status(403).json({ error: "Access Denied: You must enter the correct Admin security code to access the Admin Panel." });
      }

      const { password: _, ...userSafe } = admin;
      return res.json({ user: { ...userSafe, role: "admin" } });
    } else {
      const advertiser = allUsers.find(u => u.role === "advertiser" && u.email.toLowerCase() === cleanEmail && u.password === password);
      if (!advertiser) {
        return res.status(401).json({ error: "Invalid email credentials or password for the Advertiser Panel." });
      }

      if (advertiser.status === "inactive") {
        return res.status(403).json({ error: "Your advertiser account is currently deactivated. Please contact support." });
      }

      const { password: _, ...userSafe } = advertiser;
      return res.json({ user: { ...userSafe, role: "advertiser" } });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login request failed on database lookup." });
  }
});

app.patch("/api/auth/profile", async (req, res) => {
  const { userId, name, companyName, phone } = req.body;
  try {
    const allUsers = await getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    if (name) user.name = name;
    if (companyName !== undefined) user.companyName = companyName;
    if (phone !== undefined) user.phone = phone;

    await saveUser(user);

    // Sync roles or multi accounts sharing identical emails
    if (user.email) {
      const emailToSync = user.email.toLowerCase().trim();
      for (const u of allUsers) {
        if (u.id !== userId && u.email.toLowerCase().trim() === emailToSync) {
          if (name) u.name = name;
          if (phone !== undefined) u.phone = phone;
          if (u.role === "advertiser" && companyName !== undefined) {
            u.companyName = companyName;
          }
          await saveUser(u);
        }
      }
    }

    const { password: _, ...userSafe } = user;
    res.json({ user: userSafe });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Database transaction failed updating profile." });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  try {
    const allUsers = await getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (user.password !== currentPassword) {
      return res.status(400).json({ error: "Current password input is incorrect." });
    }

    user.password = newPassword;
    await saveUser(user);

    // Sync across same-email accounts
    if (user.email) {
      const emailToSync = user.email.toLowerCase().trim();
      for (const u of allUsers) {
        if (u.id !== userId && u.email.toLowerCase().trim() === emailToSync) {
          u.password = newPassword;
          await saveUser(u);
        }
      }
    }

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Database save failed resetting credentials." });
  }
});

// Campaign CRUD Routes
app.get("/api/campaigns", async (req, res) => {
  const { advertiserId } = req.query;
  try {
    const list = await getCampaigns();
    if (advertiserId) {
      const userCampaigns = list.filter(c => c.advertiserId === advertiserId);
      return res.json(userCampaigns);
    }
    res.json(list);
  } catch (err) {
    console.error("Get campaigns error:", err);
    res.status(500).json([]);
  }
});

app.post("/api/campaigns", async (req, res) => {
  const { advertiserId, title, description, imageUrl, targetAudience, budgetType, budgetAmount, startDate, endDate, keywords } = req.body;
  
  if (!advertiserId || !title || !description || !budgetAmount || !startDate || !endDate) {
    return res.status(400).json({ error: "Missing required advertisement campaign parameters." });
  }

  const newCampaign = {
    id: generateId("camp"),
    advertiserId,
    title,
    description,
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80",
    targetAudience: targetAudience || {
      location: "United States",
      ageMin: 18,
      ageMax: 65,
      interests: ["General Interests"]
    },
    budgetType: budgetType || "daily",
    budgetAmount: parseFloat(budgetAmount),
    spendingAmount: 0,
    startDate,
    endDate,
    status: "draft" as const,
    createdAt: new Date().toISOString(),
    keywords: keywords || []
  };

  try {
    await saveCampaign(newCampaign);
    res.status(201).json(newCampaign);
  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(500).json({ error: "Database save failed creating campaign." });
  }
});

app.put("/api/campaigns/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, imageUrl, targetAudience, budgetType, budgetAmount, startDate, endDate, keywords, status } = req.body;

  try {
    const list = await getCampaigns();
    const campaign = list.find(c => c.id === id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    if (title) campaign.title = title;
    if (description) campaign.description = description;
    if (imageUrl) campaign.imageUrl = imageUrl;
    if (targetAudience) campaign.targetAudience = targetAudience;
    if (budgetType) campaign.budgetType = budgetType;
    if (budgetAmount !== undefined) campaign.budgetAmount = parseFloat(budgetAmount);
    if (startDate) campaign.startDate = startDate;
    if (endDate) campaign.endDate = endDate;
    if (keywords) campaign.keywords = keywords;
    
    const oldStatus = campaign.status;
    if (status && ["draft", "pending", "active", "rejected"].includes(status)) {
      campaign.status = status as any;
    }

    await saveCampaign(campaign);

    if (oldStatus !== campaign.status) {
      broadcastCampaignStatusChange(campaign.id, campaign.title, campaign.advertiserId, oldStatus, campaign.status, campaign.rejectReason);
    }

    res.json(campaign);
  } catch (err) {
    console.error("Update campaign error:", err);
    res.status(500).json({ error: "Database error updating campaign." });
  }
});

app.delete("/api/campaigns/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const list = await getCampaigns();
    const index = list.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    await deleteCampaignDb(id);
    res.json({ success: true, message: "Campaign deleted successfully." });
  } catch (err) {
    console.error("Delete campaign error:", err);
    res.status(500).json({ error: "Database error deleting campaign." });
  }
});

// Simulated Checkout Payment System
app.post("/api/campaigns/:id/pay", async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, cardBrand, last4, amount, trxId, senderPhone } = req.body;

  try {
    const allCampaigns = await getCampaigns();
    const campaign = allCampaigns.find(c => c.id === id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const allUsers = await getUsers();
    const advertiser = allUsers.find(u => u.id === campaign.advertiserId);
    
    const payId = generateId("pay");

    const newPayment = {
      id: payId,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      advertiserId: campaign.advertiserId,
      advertiserName: advertiser ? advertiser.name : "Anonymous Advertiser",
      amount: parseFloat(amount) || campaign.budgetAmount,
      paymentMethod: paymentMethod || "Credit Card",
      cardBrand: cardBrand || "Visa",
      last4: last4 || "4242",
      status: "completed" as const,
      transactionDate: new Date().toISOString(),
      trxId: trxId || undefined,
      senderPhone: senderPhone || undefined
    };

    await savePayment(newPayment);

    campaign.paymentId = payId;
    campaign.status = "pending";
    await saveCampaign(campaign);

    res.status(200).json({ success: true, payment: newPayment, campaign });
  } catch (err) {
    console.error("Pay campaign error:", err);
    res.status(500).json({ error: "Database error recording campaign billing status." });
  }
});

// GET processed payment logs for revenue ledger
app.get("/api/revenue", async (req, res) => {
  try {
    const list = await getPayments();
    res.json(list);
  } catch (err) {
    res.status(500).json([]);
  }
});

// Ad Optimization Suggestions (incorporating Gemini Server-Side API)
app.post("/api/campaigns/:id/optimize", async (req, res) => {
  const { id } = req.params;
  try {
    const allCampaigns = await getCampaigns();
    const campaign = allCampaigns.find(c => c.id === id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const baselineFallbacks: Record<string, any> = {
      sustainable: {
        tags: ["bamboo fitness", "reusable mat towels", "biodegradable athletic", "zero-waste styling", "clean lifestyle yoga"],
        times: ["Early Morning (6:00 AM - 8:00 AM)", "Lunch Hour (12:00 PM - 1:00 PM)", "Evening wind-down (7:00 PM - 9:00 PM)"],
        interests: ["Sustainability", "Mental Health", "Mindfulness", "Home Gardening", "Yoga Workshops"],
        ages: { min: 21, max: 48 },
        explanation: "Eco-citizens respond highly to organic colors and natural materials. High placement on Instagram and fitness blogs in suburban areas yields maximum click-through rates."
      },
      tech: {
        tags: ["continuous deployment system", "serverless scaling cloud", "automated container orchestration", "SaaS DevOps tools", "low latency cluster management"],
        times: ["Standard Desk Time (10:00 AM - 4:00 PM)", "Late Night Hack Hours (11:00 PM - 1:00 AM)"],
        interests: ["Tech Startups", "API Development", "Infrastructure Scalability", "Software Architecture", "Productivity Extensions"],
        ages: { min: 24, max: 55 },
        explanation: "Cloud tech decision makers read technical whitepapers and value SLA guarantees. Target technical subreddits and developer platforms to minimize advertising waste."
      },
      casual: {
        tags: [campaign.title.toLowerCase().replace(/\s+/g, '-'), "best purchase ever", "custom subscription pack", "exclusive discount coupon"],
        times: ["Weekend Mornings (9:00 AM - 11:30 AM)", "Evening Leisure Hours (8:00 PM - 11:00 PM)"],
        interests: ["Lifestyle & Culture", "Online Gifting", "Artisanal Foods", "Premium Subscriptions"],
        ages: { min: 18, max: 65 },
        explanation: "General consumer apparel works beautifully with interactive video reels and user-written reviews. Position ads closely around weekend visual journals."
      }
    };

    const textContent = `${campaign.title} ${campaign.description}`.toLowerCase();
    let fallbackKey = "casual";
    if (textContent.includes("yoga") || textContent.includes("towels") || textContent.includes("bamboo") || textContent.includes("eco")) {
      fallbackKey = "sustainable";
    } else if (textContent.includes("infrastructure") || textContent.includes("kubernetes") || textContent.includes("cloud") || textContent.includes("tech")) {
      fallbackKey = "tech";
    }

    const selectedFallback = baselineFallbacks[fallbackKey];

    if (ai) {
      try {
        console.log(`Sending campaign "${campaign.title}" to Gemini API for optimization...`);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Analyze this ad campaign and provide optimal target keywords, age range, interest groups, timing windows, and strategic advice.
Campaign Name: "${campaign.title}"
Details: "${campaign.description}"
Current Location scope: "${campaign.targetAudience.location}"
Stated Budget: $${campaign.budgetAmount} on a ${campaign.budgetType} basis.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedKeywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of 4-6 high-converting SEO keywords or search terms."
                },
                suggestedAges: {
                  type: Type.OBJECT,
                  properties: {
                    min: { type: Type.INTEGER, description: "Minimum age of optimal audience (e.g., 20)" },
                    max: { type: Type.INTEGER, description: "Maximum age of optimal audience (e.g., 50)" }
                  },
                  required: ["min", "max"]
                },
                suggestedInterests: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of 3-5 precise hobbies, behaviors, or target user interests."
                },
                suggestedTimes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "List of 2-3 optimal times or daily windows to run the ads (e.g., '12:00 PM - 2:00 PM')"
                },
                explanation: {
                  type: Type.STRING,
                  description: "A short strategic advice summary on how to structure the campaign for best ROI."
                }
              },
              required: ["suggestedKeywords", "suggestedAges", "suggestedInterests", "suggestedTimes", "explanation"]
            }
          }
        });

        if (response && response.text) {
          const parsedData = JSON.parse(response.text.trim());
          console.log("Successfully retrieved suggestions from Gemini API.");
          return res.json({
            source: "Gemini Real-Time AI Orchestrator",
            suggestedKeywords: parsedData.suggestedKeywords,
            suggestedAges: parsedData.suggestedAges,
            suggestedInterests: parsedData.suggestedInterests,
            suggestedTimes: parsedData.suggestedTimes,
            explanation: parsedData.explanation
          });
        }
      } catch (apiError) {
        console.error("Gemini API stream error, utilizing premium offline analysis fallback:", apiError);
      }
    }

    res.json({
      source: "Offline Pro-Optimization Algorithm",
      suggestedKeywords: selectedFallback.tags,
      suggestedAges: selectedFallback.ages,
      suggestedInterests: selectedFallback.interests,
      suggestedTimes: selectedFallback.times,
      explanation: `[AI Fallback Mode Ready] ${selectedFallback.explanation} Consider setting rules such that your $${campaign.budgetAmount} budget targets ${selectedFallback.ages.min}-${selectedFallback.ages.max} year olds specifically to offset premium bidding weights.`
    });
  } catch (err) {
    console.error("Optimization error:", err);
    res.status(500).json({ error: "Suggestions algorithm processing failed." });
  }
});

// Admin Features: Moderation & Accounts
app.get("/api/admin/users", async (req, res) => {
  try {
    const list = await getUsers();
    res.json(list.map(({ password, ...userSafe }) => userSafe));
  } catch (err) {
    res.status(500).json([]);
  }
});

app.patch("/api/admin/users/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'active' | 'inactive'

  if (!status || !["active", "inactive"].includes(status)) {
    return res.status(400).json({ error: "Invalid status format parameter." });
  }

  try {
    const allUsers = await getUsers();
    const user = allUsers.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    if (user.role === "admin") {
      return res.status(403).json({ error: "Super Admins cannot be deactivated." });
    }

    user.status = status as any;
    await saveUser(user);

    const { password: _, ...userSafe } = user;
    res.json({ success: true, user: userSafe });
  } catch (err) {
    console.error("Change user status error:", err);
    res.status(500).json({ error: "Failed to update user account status." });
  }
});

app.patch("/api/admin/campaigns/:id/moderate", async (req, res) => {
  const { id } = req.params;
  const { status, rejectReason } = req.body; // 'active' | 'rejected'

  if (!status || !["active", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Required status must be either 'active' or 'rejected'." });
  }

  try {
    const allCampaigns = await getCampaigns();
    const campaign = allCampaigns.find(c => c.id === id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found." });
    }

    const oldStatus = campaign.status;
    campaign.status = status;
    if (status === "rejected") {
      campaign.rejectReason = rejectReason || "Violates standard community guidelines and pricing layout rules.";
    } else {
      campaign.rejectReason = undefined;
    }

    await saveCampaign(campaign);

    broadcastCampaignStatusChange(campaign.id, campaign.title, campaign.advertiserId, oldStatus, campaign.status, campaign.rejectReason);

    res.json({ success: true, campaign });
  } catch (err) {
    console.error("Moderate campaign error:", err);
    res.status(500).json({ error: "Failed to moderate campaign." });
  }
});

// Settings Management
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({});
  }
});

app.put("/api/settings", async (req, res) => {
  const { adRules, pricingCpc, optimizationLevel, minDailyBudget } = req.body;
  try {
    const settings = await getPlatformSettings();
    if (adRules) settings.adRules = adRules;
    if (pricingCpc !== undefined) settings.pricingCpc = parseFloat(pricingCpc);
    if (optimizationLevel) settings.optimizationLevel = optimizationLevel;
    if (minDailyBudget !== undefined) settings.minDailyBudget = parseFloat(minDailyBudget);

    await savePlatformSettings(settings);
    res.json({ success: true, settings });
  } catch (err) {
    console.error("Put settings error:", err);
    res.status(500).json({ error: "Settings transaction failed to persist database." });
  }
});

// Complaints / Support Workspace
app.get("/api/complaints", async (req, res) => {
  const { userId } = req.query;
  try {
    const list = await getComplaints();
    if (userId) {
      return res.json(list.filter(c => c.userId === userId));
    }
    res.json(list);
  } catch (err) {
    res.status(500).json([]);
  }
});

app.post("/api/complaints", async (req, res) => {
  const { userId, subject, message } = req.body;
  if (!userId || !subject || !message) {
    return res.status(400).json({ error: "Missing identity or message content fields." });
  }

  try {
    const allUsers = await getUsers();
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: "Inquirer user record missing." });
    }

    const newComplaint = {
      id: generateId("comp"),
      userId,
      userName: user.name,
      userEmail: user.email,
      subject,
      message,
      status: "pending" as const,
      createdAt: new Date().toISOString()
    };

    await saveComplaint(newComplaint);
    res.status(201).json(newComplaint);
  } catch (err) {
    console.error("Submit complaint error:", err);
    res.status(500).json({ error: "Database transaction failed submitting complaint." });
  }
});

app.patch("/api/complaints/:id/resolve", async (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply) {
    return res.status(400).json({ error: "Reply text is required to resolve complaints." });
  }

  try {
    const list = await getComplaints();
    const complaint = list.find(c => c.id === id);
    if (!complaint) {
      return res.status(404).json({ error: "Complaint ticket not found." });
    }

    complaint.reply = reply;
    complaint.status = "resolved";

    await saveComplaint(complaint);
    res.json({ success: true, complaint });
  } catch (err) {
    console.error("Resolve complaint error:", err);
    res.status(500).json({ error: "Failed to persist resolved ticket state." });
  }
});

// System Analytics Aggregator
app.get("/api/admin/analytics", async (req, res) => {
  try {
    const listCampaigns = await getCampaigns();
    const listPayments = await getPayments();
    const listUsers = await getUsers();
    const listComplaints = await getComplaints();

    const activeCampaigns = listCampaigns.filter(c => c.status === "active");
    const pendingCampaigns = listCampaigns.filter(c => c.status === "pending");
    const rejectedCampaigns = listCampaigns.filter(c => c.status === "rejected");
    const totalSpend = listCampaigns.reduce((acc, curr) => acc + (curr.spendingAmount || 0), 0);

    const totalRevenue = listPayments
      .filter(p => p.status === "completed")
      .reduce((acc, curr) => acc + curr.amount, 0);

    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonthIdx = new Date().getMonth();
    
    // Construct dynamic history for the last 5 months
    const monthlyRevenue: { month: string; revenue: number; campaigns: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setMonth(currentMonthIdx - i);
      const mName = monthsList[targetDate.getMonth()];
      const mYear = targetDate.getFullYear();
      
      const monthPayments = listPayments.filter(p => {
        if (p.status !== "completed") return false;
        const pDate = new Date(p.transactionDate);
        return pDate.getMonth() === targetDate.getMonth() && pDate.getFullYear() === mYear;
      });
      
      const revenueSum = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      const fundCampaignsCount = new Set(monthPayments.map(p => p.campaignId)).size;
      
      monthlyRevenue.push({
        month: `${mName}`,
        revenue: revenueSum,
        campaigns: fundCampaignsCount
      });
    }

    const outdoorCount = listCampaigns.filter(c => (c.description || "").toLowerCase().match(/hiking|yoga|jacket|fitness|outdoor|sport/) || (c.keywords && c.keywords.some(k => k.toLowerCase().match(/yoga|sport|hiking|fitness/)))).length;
    const devopsCount = listCampaigns.filter(c => (c.description || "").toLowerCase().match(/kubernetes|cloud|devops|technology|software|tech|data/) || (c.keywords && c.keywords.some(k => k.toLowerCase().match(/cloud|tech|devops/)))).length;
    const foodCount = listCampaigns.filter(c => (c.description || "").toLowerCase().match(/coffee|subscription|food|drink|beverage|restaurant|gourmet/) || (c.keywords && c.keywords.some(k => k.toLowerCase().match(/coffee|food/)))).length;
    const otherCount = listCampaigns.length - (outdoorCount + devopsCount + foodCount);

    const categoryBreakdown = [
      { name: "Outdoor & Fitness", value: outdoorCount },
      { name: "DevOps & Technology", value: devopsCount },
      { name: "Food & Beverage", value: foodCount },
      { name: "General & Other", value: Math.max(0, otherCount) }
    ].filter(cat => cat.value > 0);

    const advertisersList = listUsers.filter(u => u.role === "advertiser");

    res.json({
      totalSpend,
      totalRevenue,
      counts: {
        advertisers: advertisersList.length,
        activeAdvertisers: advertisersList.filter(u => u.status === "active").length,
        campaigns: listCampaigns.length,
        activeCampaigns: activeCampaigns.length,
        pendingCampaigns: pendingCampaigns.length,
        rejectedCampaigns: rejectedCampaigns.length,
        solvedComplaints: listComplaints.filter(c => c.status === "resolved").length,
        pendingComplaints: listComplaints.filter(c => c.status === "pending").length
      },
      monthlyRevenue,
      categoryBreakdown
    });
  } catch (err) {
    console.error("Aggregation analytics error:", err);
    res.status(500).json({ error: "Failed to compile system dashboard metrics." });
  }
});

// ==========================================
// VITE OR STATIC FILE SERVING WORKFLOW
// ==========================================

async function serveApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware client.");
  } else {
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      console.log("Serving static production assets from public dist directory.");
    }
  }

  if (!process.env.VERCEL) {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Express application server fully running at http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  serveApp().catch((err) => {
    console.error("Vite server loader failed to launch:", err);
  });
}

export default app;
