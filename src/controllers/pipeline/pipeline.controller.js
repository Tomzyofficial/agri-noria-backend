import {
   createWallet, getWalletByOwner, depositLockedFunds, depositToClusterWallet, fundPersonalWallet, fundEcosystemWallet, transferToEcosystem, getEcosystemTreasuryTransactions,
   transferClusterToFarmer, getWalletTransactions,
   createFarmerProfile, getFarmerProfileByVendor, getAllFarmerProfiles,
   createCluster, getAllClusters, assignFarmerToCluster, getClusterMembers, removeFarmerFromCluster,
   getTrainingModules, getFarmerTrainingProgress, updateTrainingProgress,
   createInputRequest, updateInputRequestItems, getInputRequestsByFarmer, getPendingInputRequests, getAllInputRequests,
   approveInputFunds, submitInputItems, approveInputItems, getInputRequestsByDistributor, updateInputRequestStatus,
   createPlantingActivity, getPlantingByFarmer,
   getNearestClusters, getEligibleFarmersForCluster, getFarmerCluster,
   createFieldVerification, getVerificationsByCluster,
   getFarmSupervisionByFarmer, upsertFarmSupervision,
   getClusterSupervision, upsertClusterSupervision,
   createHarvestApproval,
   createLogisticsEntry, getLogisticsByCluster,
   createPreHarvestListing, getPreHarvestListingsByCluster, getAllPreHarvestListings,
   createBuyerMatch, getBuyerMatches,
   createSale, getSalesByCluster,
   createRepayment, updateRepayment,
   getPipelineStats,
   getAllDistributors,
   disableBuyerAccount,
   getSalesStats,
   getIntelligenceStats,
   getPlatformWalletTotals,
   getAllLogisticsEntries,
   updateLogisticsStatusDb,
   getWarehouseInventoryStats,
   addWarehouseStock,
   removeWarehouseStock,
   createEcosystemOrder, getEcosystemOrders,
   getEcosystemOrderForPayment, createEcosystemOrderPayment, markEcosystemOrderPaymentProcessing,
   getEcosystemOrderPaymentByReference, recordEcosystemPaystackVerification, confirmEcosystemOrderPayment,
   processEscrowPayment, assignOrderDistributor, getAllEcosystemOrders,
   getEcosystemOrdersByDistributor, markOrderDelivered, updateEcosystemOrderStatus,
   getDistributorStats, confirmInputDelivery,
   getClusterChats, saveClusterChat,
   scheduleClusterTraining, getClusterTrainings, getClusterTrainingById, updateClusterTrainingStatus,
   createForwardContract, getForwardContractsByBuyer, getForwardContractsForSales
} from "../../db/pipeline/pipeline.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";
import { verifyBuyerToken } from "../../sessions/buyer.auth.session.js";
import { initializePaystack, verifyPaystackTransaction } from "../../lib/services/paystack.service.js";
import agoraService from "../../services/agora.service.js";

const createAgoraUid = (role, vendorId) => {
   const idPrefix = String(vendorId).replace(/-/g, "").slice(0, 10);
   const nonce = Math.random().toString(36).slice(2, 8);
   return `${role}_${idPrefix}_${Date.now()}_${nonce}`;
};

const INPUT_RATE_PER_HECTARE = 28000; // ₦28,000 per hectare for input financing

const pipelineController = {};

const ecosystemPaymentCallbackUrl = (orderId) => {
   const base = process.env.FRONTEND_APP_URL || process.env.APP_BASEURL || "http://localhost:3000";
   return `${base.replace(/\/$/, "")}/ecosystem/buyer-partner/orders?order_id=${orderId}`;
};

// ============ FARMER PROFILES ============

pipelineController.createFarmerProfile = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const profile = await createFarmerProfile({ ...req.body, vendor_id: payload.id });

      // Auto-create farmer wallet
      await createWallet(payload.id, "farmer");

      // Removed: Auto-calculate and deposit locked financing based on farm size
      // This is now done during input request validation

      // Disable outer "Normal Farmer" account (in buyers table) if it exists
      if (req.body.migrate_from_outer) {
         await disableBuyerAccount(payload.email);
      }

      return res.status(201).json({ success: true, data: profile });
   } catch (error) {
      console.error("Error creating farmer profile:", error);
      return res.status(500).json({ success: false, error: "Failed to create farmer profile" });
   }
};

pipelineController.getMyFarmerProfile = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      let profile = await getFarmerProfileByVendor(payload.id);
      
      if (!profile) {
         // Fetch basic vendor info if farmer profile doesn't exist yet
         const { default: pool } = await import("../../lib/connect.js");
         const { rows } = await pool.query("SELECT id, fname, lname, email, phone, is_verified as vendor_is_verified, onboarding_status as vendor_onboarding_status, onboarding_level as vendor_onboarding_level FROM vendors WHERE id = $1", [payload.id]);
         if (rows.length > 0) {
            profile = { ...rows[0], is_new: true };
         }
      }

      if (profile) {
         profile.is_verified = profile.vendor_is_verified || profile.is_verified === true || profile.onboarding_status === 'verified' || profile.onboarding_status === 'completed' || profile.vendor_onboarding_status === 'verified' || profile.vendor_onboarding_status === 'completed' || profile.vendor_onboarding_level >= 2;
         profile.onboarding_status = profile.onboarding_status || profile.vendor_onboarding_status || 'unverified';
         profile.onboarding_level = profile.vendor_onboarding_level || profile.onboarding_level || 0;
      }

      return res.status(200).json({ success: true, data: profile });
   } catch (error) {
      console.error("Error fetching farmer profile:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch profile" });
   }
};

pipelineController.enrollInProgram = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { program_id, cluster_id } = req.body;
      const pool = (await import("../../db/pipeline/pipeline.db.js")).default || (await import("../../lib/connect.js")).default;

      if (cluster_id) {
         const { rows: clusterRows } = await pool.query(
            "UPDATE clusters SET program_id = $1, updated_at = now() WHERE id = $2 RETURNING *",
            [program_id, cluster_id]
         );
         if (!clusterRows[0]) return res.status(404).json({ success: false, error: "Cluster not found" });
         return res.status(200).json({ success: true, data: clusterRows[0] });
      }

      const profile = await getFarmerProfileByVendor(payload.id);
      if (!profile) return res.status(404).json({ success: false, error: "Farmer profile not found" });

      // Update the farmer profile in db
      const { rows } = await pool.query(
         "UPDATE farmer_profiles SET program_id = $1, updated_at = now() WHERE id = $2 RETURNING *",
         [program_id, profile.id]
      );

      return res.status(200).json({ success: true, data: rows[0] });
   } catch (error) {
      console.error("Error enrolling in program:", error);
      return res.status(500).json({ success: false, error: "Failed to enroll" });
   }
};

pipelineController.getAllFarmers = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const farmers = await getAllFarmerProfiles(payload.id, payload.role);
      return res.status(200).json({ success: true, data: farmers });
   } catch (error) {
      console.error("Error fetching farmers:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch farmers" });
   }
};

// ============ WALLETS ============

pipelineController.getMyWallet = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      let walletType = req.query.type || "farmer";
      if (walletType === 'institution' && payload.role && payload.role.toLowerCase() !== 'institution') {
         walletType = payload.role.toLowerCase();
      }
      const ownerId = req.query.cluster_id || payload.id;
      let wallet = await getWalletByOwner(ownerId, walletType);

      if (!wallet) {
         wallet = await createWallet(ownerId, walletType);
      }

      const transactions = wallet ? await getWalletTransactions(wallet.id) : [];
      return res.status(200).json({ success: true, data: { wallet, transactions } });
   } catch (error) {
      console.error("Error fetching wallet:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch wallet" });
   }
};

pipelineController.transferFunds = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { cluster_wallet_id, farmer_wallet_id, amount, description } = req.body;
      if (!cluster_wallet_id || !farmer_wallet_id || !amount) {
         return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      await transferClusterToFarmer(cluster_wallet_id, farmer_wallet_id, parseFloat(amount), description || "Cluster payout");
      return res.status(200).json({ success: true, message: "Transfer completed" });
   } catch (error) {
      console.error("Error transferring funds:", error);
      return res.status(500).json({ success: false, error: "Transfer failed" });
   }
};


pipelineController.initializeWalletFunding = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { amount, target } = req.body; // target: 'personal' or 'ecosystem'
      if (!amount || amount <= 0) return res.status(400).json({ success: false, error: "Invalid amount" });

      const amount_kobo = Math.round(amount * 100);

      const initPayload = {
         email: payload.email,
         amount: amount_kobo,
         metadata: {
            vendor_id: payload.id,
            target: target || 'personal',
            role: payload.role?.toLowerCase() || 'institution',
            category: 'wallet_funding'
         },
         callback_url: `${process.env.FRONTEND_APP_URL}/ecosystem/institution/wallet?target=${target || 'personal'}`
      };
      console.log("Initializing Paystack transaction with payload:", initPayload);

      const initResponse = await initializePaystack("/transaction/initialize", {
         body: initPayload
      });

      return res.status(200).json({ success: true, data: initResponse.data });
   } catch (error) {
      console.error("Paystack init error:", error.response?.data || error.message);
      return res.status(500).json({ success: false, error: error.message });
   }
};

pipelineController.verifyWalletFunding = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { reference, target } = req.query;
      if (!reference) return res.status(400).json({ success: false, error: "Missing reference" });

      const verifyRes = await verifyPaystackTransaction(reference);
      
      if (!verifyRes.status || verifyRes.data.status !== "success") {
         console.error("Payment verification failed on Paystack API. Response:", verifyRes);
         return res.status(400).json({ success: false, error: "Payment verification failed" });
      }

      const amountPaid = verifyRes.data.amount / 100;
      let walletData;

      if (target === "ecosystem") {
         walletData = await fundEcosystemWallet(amountPaid, reference, payload.id);
      } else {
         let wallet = await getWalletByOwner(payload.id, payload.role?.toLowerCase() || 'institution');
         if (!wallet) {
            wallet = await createWallet(payload.id, payload.role?.toLowerCase() || 'institution');
         }
         walletData = await fundPersonalWallet(wallet.id, amountPaid, reference);
      }

      console.log(`Wallet funding successful for user ${payload.id}, Amount: ₦${amountPaid}`);
      return res.status(200).json({ success: true, data: walletData, message: "Funding successful" });
   } catch (error) {
      console.error("Wallet funding verification error:", error);
      return res.status(500).json({ success: false, error: "Funding verification failed" });
   }
};

pipelineController.transferToEcosystem = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { amount, description } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
         return res.status(400).json({ success: false, error: "Invalid transfer amount" });
      }

      // Get the user's institutional wallet (or fallback dynamically like getMyWallet)
      let walletType = req.body.wallet_type || payload.role?.toLowerCase() || 'institution';
      if (walletType === 'institution' && payload.role && payload.role.toLowerCase() !== 'institution') {
         walletType = payload.role.toLowerCase();
      }
      
      const wallet = await getWalletByOwner(payload.id, walletType);
      if (!wallet) {
         return res.status(404).json({ success: false, error: "Wallet not found" });
      }
      
      if (parseFloat(wallet.balance) < parseFloat(amount)) {
         return res.status(400).json({ success: false, error: "Insufficient wallet balance" });
      }

      const updatedWallet = await transferToEcosystem(wallet.id, parseFloat(amount), description || "Wallet-to-Ecosystem Transfer");

      return res.status(200).json({ 
         success: true, 
         data: updatedWallet, 
         message: "Successfully transferred funds to Ecosystem Treasury" 
      });
   } catch (error) {
      console.error("Transfer to ecosystem error:", error);
      return res.status(500).json({ success: false, error: error.message || "Transfer failed" });
   }
};

// ============ CLUSTERS ============

pipelineController.createCluster = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const cluster = await createCluster({ ...req.body, supervisor_id: payload.id });

      // Auto-create cluster wallet
      await createWallet(cluster.id, "cluster");

      return res.status(201).json({ success: true, data: cluster });
   } catch (error) {
      console.error("Error creating cluster:", error);
      return res.status(500).json({ success: false, error: "Failed to create cluster" });
   }
};

pipelineController.getClusters = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      let clusters = await getAllClusters();

      // If the user is an aggregator or cluster management role, only return clusters they created (supervise)
      const supervisorRoles = [
         'aggregator', 
         'cluster supervisor', 
         'program director', 
         'regional manager', 
         'cooperative', 
         'producer association'
      ];
      if (supervisorRoles.includes(payload.role?.toLowerCase())) {
         clusters = clusters.filter(c => c.supervisor_id === payload.id);
      }

      return res.status(200).json({ success: true, data: clusters });
   } catch (error) {
      console.error("Error fetching clusters:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch clusters" });
   }
};

pipelineController.getMyCluster = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      console.log("[getMyCluster] vendor_id:", payload.id);

      const profile = await getFarmerProfileByVendor(payload.id);
      console.log("[getMyCluster] profile:", profile ? { id: profile.id, cluster_id: profile.cluster_id } : null);

      const pool = (await import("../../lib/connect.js")).default;
      let clusterId = profile?.cluster_id;

      if (!clusterId && profile?.id) {
         const { rows } = await pool.query(
            "SELECT cluster_id FROM cluster_members WHERE farmer_id = $1 ORDER BY assigned_at DESC LIMIT 1",
            [profile.id]
         );
         console.log("[getMyCluster] cluster_members lookup by profile.id:", rows);
         if (rows.length > 0) clusterId = rows[0].cluster_id;
      }

      if (!clusterId) {
         // Also try looking up by vendor_id directly (some assign flows use vendor_id as farmer_id)
         const { rows } = await pool.query(
            "SELECT cluster_id FROM cluster_members WHERE farmer_id = $1 ORDER BY assigned_at DESC LIMIT 1",
            [payload.id]
         );
         console.log("[getMyCluster] cluster_members lookup by vendor_id:", rows);
         if (rows.length > 0) clusterId = rows[0].cluster_id;
      }

      console.log("[getMyCluster] resolved clusterId:", clusterId);

      if (!clusterId) {
         return res.status(200).json({ success: true, data: null });
      }

      const cluster = await getFarmerCluster(clusterId);
      if (cluster) {
         cluster.supervisor_name = (cluster.supervisor_fname || cluster.supervisor_lname) 
            ? `${cluster.supervisor_fname || ''} ${cluster.supervisor_lname || ''}`.trim() 
            : null;
      }
      console.log("[getMyCluster] returning cluster:", cluster?.name || null);
      return res.status(200).json({ success: true, data: cluster });
   } catch (error) {
      console.error("Error fetching my cluster:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch cluster" });
   }
};

pipelineController.getNearbyClusters = async (req, res) => {
   try {
      const { lat, lng } = req.query;
      if (!lat || !lng) return res.status(400).json({ success: false, error: "Coordinates required" });
      const clusters = await getNearestClusters(parseFloat(lat), parseFloat(lng));
      return res.status(200).json({ success: true, data: clusters });
   } catch (error) {
      console.error("Error discovery clusters:", error);
      return res.status(500).json({ success: false, error: "Failed to find clusters" });
   }
};

pipelineController.getEligibleFarmers = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { program_id, cluster_id } = req.query;
      const farmers = await getEligibleFarmersForCluster(program_id, cluster_id);
      return res.status(200).json({ success: true, data: farmers });
   } catch (error) {
      console.error("Error fetching eligible farmers:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch eligible farmers" });
   }
};

pipelineController.assignFarmer = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      let { cluster_id, farmer_id } = req.body;
      // If farmer_id not provided, resolve from logged-in vendor's farmer profile
      if (!farmer_id) {
         const profile = await getFarmerProfileByVendor(payload.id);
         farmer_id = profile?.id;
      }

      if (!farmer_id) {
         return res.status(400).json({ success: false, error: "No farmer profile found for this account" });
      }

      await assignFarmerToCluster(cluster_id, farmer_id);

      const cluster = await getFarmerCluster(cluster_id);
      return res.status(200).json({ success: true, data: cluster });
   } catch (error) {
      console.error("Error assigning farmer:", error);
      return res.status(500).json({ success: false, error: "Failed to assign farmer" });
   }
};

pipelineController.getClusterMembers = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const members = await getClusterMembers(req.params.id);
      return res.status(200).json({ success: true, data: members });
   } catch (error) {
      console.error("Error fetching cluster members:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch members" });
   }
};

pipelineController.removeFarmer = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { id, farmerId } = req.params;
      await removeFarmerFromCluster(id, farmerId, payload.id);
      return res.status(200).json({ success: true, message: "Farmer removed from cluster" });
   } catch (error) {
      console.error("Error removing farmer:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to remove farmer" });
   }
};

// ============ CLUSTER CHATS ============

pipelineController.getClusterChats = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const chats = await getClusterChats(req.params.id);
      return res.status(200).json({ success: true, data: chats });
   } catch (error) {
      console.error("Error fetching cluster chats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch cluster chats" });
   }
};

pipelineController.sendClusterChat = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { message } = req.body;
      if (!message) return res.status(400).json({ success: false, error: "Message is required" });

      const chat = await saveClusterChat(req.params.id, payload.id, message);

      // Broadcast to connected socket clients in this cluster room
      const io = req.app.get("io");
      if (io) {
         io.to(`cluster_${req.params.id}`).emit("new_message", chat);
      }

      return res.status(201).json({ success: true, data: chat });
   } catch (error) {
      console.error("Error sending cluster chat:", error);
      return res.status(500).json({ success: false, error: "Failed to send cluster chat" });
   }
};

// ============ CLUSTER TRAINING (LIVE SESSIONS) ============

pipelineController.scheduleTraining = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { title, description, scheduled_at } = req.body;
      const { id: clusterId } = req.params;
      
      if (!title || !scheduled_at) {
         return res.status(400).json({ success: false, error: "Title and scheduled_at are required" });
      }

      const training = await scheduleClusterTraining(clusterId, payload.id, title, description, scheduled_at);
      return res.status(201).json({ success: true, data: training });
   } catch (error) {
      console.error("Error scheduling training:", error);
      return res.status(500).json({ success: false, error: "Failed to schedule training" });
   }
};

pipelineController.getClusterLiveTrainings = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const trainings = await getClusterTrainings(req.params.id);
      return res.status(200).json({ success: true, data: trainings });
   } catch (error) {
      console.error("Error fetching trainings:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch trainings" });
   }
};

pipelineController.updateTrainingStatus = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { status } = req.body;
      const training = await updateClusterTrainingStatus(req.params.trainingId, status);
      return res.status(200).json({ success: true, data: training });
   } catch (error) {
      console.error("Error updating training status:", error);
      return res.status(500).json({ success: false, error: "Failed to update training status" });
   }
};

pipelineController.startClusterTraining = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const training = await getClusterTrainingById(req.params.trainingId);
      if (!training) return res.status(404).json({ success: false, error: "Training not found" });

      if (training.supervisor_id !== payload.id) {
         return res.status(403).json({ success: false, error: "Only the supervisor can start this session" });
      }

      await updateClusterTrainingStatus(training.id, "Live");
      
      const uid = createAgoraUid("supervisor", payload.id);
      const agoraToken = agoraService.generateRtcToken(training.agora_channel, uid, "publisher", 7200);

      return res.status(200).json({
         success: true,
         data: { training, agoraToken, channelName: training.agora_channel, appId: agoraService.getAppId(), uid }
      });
   } catch (error) {
      console.error("Error starting cluster training:", error);
      return res.status(500).json({ success: false, error: "Failed to start training" });
   }
};

pipelineController.joinClusterTraining = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const training = await getClusterTrainingById(req.params.trainingId);
      if (!training) return res.status(404).json({ success: false, error: "Training not found" });

      if (training.status !== "Live") {
         return res.status(400).json({ success: false, error: "Training is not currently live" });
      }

      const uid = createAgoraUid("farmer", payload.id);
      const agoraToken = agoraService.generateRtcToken(training.agora_channel, uid, "subscriber", 7200);

      return res.status(200).json({
         success: true,
         data: { training, agoraToken, channelName: training.agora_channel, appId: agoraService.getAppId(), uid }
      });
   } catch (error) {
      console.error("Error joining cluster training:", error);
      return res.status(500).json({ success: false, error: "Failed to join training" });
   }
};

// ============ TRAINING ============

pipelineController.getTrainingProgress = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const profile = await getFarmerProfileByVendor(payload.id);
      if (!profile) return res.status(404).json({ success: false, error: "Farmer profile not found" });

      const progress = await getFarmerTrainingProgress(profile.id);
      const modules = profile.program_id ? await getTrainingModules(profile.program_id) : [];
      return res.status(200).json({ success: true, data: { progress, modules } });
   } catch (error) {
      console.error("Error fetching training:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch training" });
   }
};

pipelineController.updateTraining = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { module_id, status, score } = req.body;
      const profile = await getFarmerProfileByVendor(payload.id);
      if (!profile) return res.status(404).json({ success: false, error: "Farmer profile not found" });

      const result = await updateTrainingProgress(profile.id, module_id, status, score);
      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error updating training:", error);
      return res.status(500).json({ success: false, error: "Failed to update training" });
   }
};

// ============ INPUT REQUESTS ============

pipelineController.createInputRequest = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      if (!req.body) {
         return res.status(400).json({ success: false, error: "Request body is missing" });
      }
      const { cluster_id, is_cluster_request } = req.body;

      let profileId = null;
      let targetClusterId = cluster_id;
      let totalValue = req.body.total_value;

      if (!is_cluster_request) {
         const profile = await getFarmerProfileByVendor(payload.id);
         if (!profile) return res.status(404).json({ success: false, error: "Farmer profile not found" });
         if (!profile.program_id) return res.status(400).json({ success: false, error: "You must be enrolled in a program to request inputs" });

         profileId = profile.id;
         targetClusterId = profile.cluster_id; // Auto-pull from profile

         // Check training completion for individual farmer
         const modules = await getTrainingModules(profile.program_id);
         if (profile.onboarding_status !== 'completed' && profile.onboarding_status !== 'verified') {
            return res.status(403).json({ success: false, error: "Your account must be fully verified and onboarding completed before you can request inputs" });
         }

         const progress = await getFarmerTrainingProgress(profile.id);
         const completedModules = progress.filter(p => p.status === 'completed').length;
         if (modules.length > 0 && completedModules < modules.length) {
            return res.status(400).json({ success: false, error: "You must complete all training modules before requesting inputs" });
         }

         if (!totalValue) {
            totalValue = parseFloat(profile.farm_size_hectares || 0) * 28000;
         }
      } else {
         // Cluster request: Verify the user is the supervisor of this cluster
         const allClusters = await getAllClusters();
         const cluster = allClusters.find(c => c.id === cluster_id);
         if (!cluster) return res.status(404).json({ success: false, error: "Cluster not found" });
         const role = payload.role?.toLowerCase();
         if (cluster.supervisor_id !== payload.id && role !== 'super admin' && role !== 'aggregator') {
            return res.status(403).json({ success: false, error: "Only the cluster supervisor or aggregator can make cluster-wide requests" });
         }
      }

      const request = await createInputRequest({
         ...req.body,
         input_items: req.body.input_items || [],
         farmer_id: profileId,
         cluster_id: targetClusterId,
         total_value: totalValue,
         requester_id: req.body.requester_id || payload.id,
         requester_type: (payload.role?.toLowerCase() === 'aggregator') ? 'aggregator' : (req.body.requester_type || (is_cluster_request ? 'cluster_manager' : 'farmer')),
         training_completed: true
      });
      return res.status(201).json({ success: true, data: request });
   } catch (error) {
      console.error("Error creating input request:", error);
      return res.status(error.status || 500).json({
         success: false,
         error: error.message || "Failed to create input request"
      });
   }
};

pipelineController.getMyInputRequests = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const profile = await getFarmerProfileByVendor(payload.id);
      if (!profile) return res.status(200).json({ success: true, data: [] });

      const requests = await getInputRequestsByFarmer(profile.id);
      return res.status(200).json({ success: true, data: requests });
   } catch (error) {
      console.error("Error fetching input requests:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch requests" });
   }
};

pipelineController.getPendingInputs = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const requests = await getPendingInputRequests(payload.id, payload.role);
      return res.status(200).json({ success: true, data: requests });
   } catch (error) {
      console.error("Error fetching pending inputs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch requests" });
   }
};

pipelineController.getAllInputs = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      // Only finance and super admin can see all inputs
      const role = payload.role?.toLowerCase();
      if (role !== 'finance' && role !== 'super admin') {
         return res.status(403).json({ success: false, error: "Access denied" });
      }

      const requests = await getAllInputRequests();
      return res.status(200).json({ success: true, data: requests });
   } catch (error) {
      console.error("Error fetching all inputs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch requests" });
   }
};

pipelineController.approveFunds = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      // Strict role check: Only Finance can approve
      if (payload.role?.toLowerCase() !== 'finance' && payload.role?.toLowerCase() !== 'super admin' && payload.role?.toLowerCase() !== 'admin') {
         return res.status(403).json({ success: false, error: "Only Finance roles can approve funds" });
      }

      const requestId = req.params.id;
      const pool = (await import("../../lib/connect.js")).default;

      // 1) FETCH REQUEST FIRST without modifying database status
      const { rows: reqRows } = await pool.query("SELECT * FROM input_requests WHERE id = $1", [requestId]);
      const requestData = reqRows[0];
      if (!requestData) {
         return res.status(404).json({ success: false, error: "Input request not found" });
      }
      if (requestData.funds_status === 'approved') {
         return res.status(400).json({ success: false, error: "Funds already authorized for this request" });
      }

      // 2) GET PROGRAM ID from package, farmer profile, or cluster
      let programId = null;
      if (requestData.package_id) {
         const { rows: packageRows } = await pool.query("SELECT program_id FROM input_packages WHERE id = $1", [requestData.package_id]);
         programId = packageRows[0]?.program_id;
      }
      if (!programId && requestData.farmer_id) {
         const { rows: farmerRows } = await pool.query("SELECT program_id FROM farmer_profiles WHERE id = $1", [requestData.farmer_id]);
         programId = farmerRows[0]?.program_id;
      }
      if (!programId && requestData.cluster_id) {
         const { rows: clusterRows } = await pool.query("SELECT program_id FROM clusters WHERE id = $1", [requestData.cluster_id]);
         programId = clusterRows[0]?.program_id;
      }

      if (!programId) return res.status(400).json({ success: false, error: "Invalid programme association. Requester must be enrolled in an active programme." });

      // 3) CHECK PROGRAM WALLET BALANCE BEFORE ANY MUTATION
      const { createProgramWallet, deductProgramWallet, createEscrowWallet } = await import("../../db/escrow/program_escrow.db.js");
      let programWallet = await createProgramWallet(programId, payload.id);
      if (parseFloat(programWallet.balance) < parseFloat(requestData.total_value)) {
         const { rows: progRows } = await pool.query("SELECT created_by, name FROM programs WHERE id = $1", [programId]);
         if (progRows[0]?.created_by) {
            const alertMsg = `Input request approval of NGN ${parseFloat(requestData.total_value).toLocaleString()} for programme '${progRows[0].name}' failed due to depleted programme funds. Current Balance: NGN ${parseFloat(programWallet.balance).toLocaleString()}. Please fund your programme immediately.`;
            await pool.query(
               "INSERT INTO program_notifications (program_id, recipient_id, title, message) VALUES ($1, $2, $3, $4)",
               [programId, progRows[0].created_by, "Programme Funds Depleted", alertMsg]
            );
         }
         return res.status(400).json({ success: false, error: "Insufficient programme funds! An alert notification has been dispatched to the programme sponsor to replenish their funds." });
      }

      // 4) PROGRAM FUNDS ARE SUFFICIENT -> NOW EXECUTE APPROVAL & TRANSFER
      const result = await approveInputFunds(requestId, payload.id);
      await deductProgramWallet(programWallet.id, parseFloat(result.total_value));

      let heldForId = result.is_cluster_request ? result.cluster_id : result.farmer_id;
      const heldForType = result.is_cluster_request ? 'cluster' : 'farmer';
      if (!result.is_cluster_request && result.farmer_id) {
          const { rows: fRows } = await pool.query("SELECT vendor_id FROM farmer_profiles WHERE id = $1", [result.farmer_id]);
          if (fRows[0]?.vendor_id) heldForId = fRows[0].vendor_id;
      }
      await createEscrowWallet(programId, heldForId, heldForType, parseFloat(result.total_value), { "items_delivered": false }, result.id, "input_request");

      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error approving funds:", error);
      return res.status(500).json({ success: false, error: "Failed to approve funds" });
   }
};

pipelineController.submitInputItems = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { items, inputItems, input_items } = req.body;
      const selectedItems = items || inputItems || input_items;
      if (!selectedItems || !Array.isArray(selectedItems)) {
         return res.status(400).json({ success: false, error: "Missing or invalid items array" });
      }

      // Validate selected items cost against locked funds for cluster requests
      const pool = (await import("../../lib/connect.js")).default;
      const { rows: reqData } = await pool.query(
         `SELECT ir.cluster_id, ir.farmer_id, ir.is_cluster_request, ir.requester_type, ir.requester_id,
          (SELECT SUM(fp.farm_size_hectares) FROM farmer_profiles fp 
           JOIN cluster_members cm ON fp.id = cm.farmer_id 
           WHERE cm.cluster_id = ir.cluster_id) as cluster_hectares,
          (SELECT farm_size_hectares FROM farmer_profiles WHERE id = ir.farmer_id) as farmer_hectares
          FROM input_requests ir WHERE ir.id = $1`,
         [req.params.id]
      );

      if (!reqData[0]) {
         return res.status(404).json({ success: false, error: "Request not found" });
      }

      const request = reqData[0];
      const hectares = request.requester_type === 'farmer'
         ? (parseFloat(request.farmer_hectares) || 1)
         : (parseFloat(request.cluster_hectares) || 1);

      // Calculate total cost of selected items
      const INPUT_RATES = {
         "Mechanical": 150000, "Seeds": 45000, "Fertilizer": 65000,
         "Irrigations": 120000, "Pesticides": 35000, "Herbicides": 25000,
      };
      let totalCost = 0;
      selectedItems.forEach(item => {
         totalCost += (INPUT_RATES[item] || 0) * hectares;
      });
      totalCost = Math.min(totalCost, 1000000);

      // Check locked funds for cluster requests
      if (request.is_cluster_request && request.cluster_id) {
         let wallet = await getWalletByOwner(request.cluster_id, "cluster");
         const lockedBalance = wallet ? parseFloat(wallet.locked_balance) : 0;
         if (totalCost > lockedBalance) {
            return res.status(400).json({
               success: false,
               error: `Total input cost (₦${totalCost.toLocaleString()}) exceeds locked funds (₦${lockedBalance.toLocaleString()}). Please select fewer inputs or request additional funding.`
            });
         }
      } else if (request.farmer_id) {
         // Check locked funds for individual farmer requests
         const { rows: farmerData } = await pool.query("SELECT vendor_id FROM farmer_profiles WHERE id = $1", [request.farmer_id]);
         if (farmerData.length > 0) {
            const wallet = await getWalletByOwner(farmerData[0].vendor_id, "farmer");
            const lockedBalance = wallet ? parseFloat(wallet.locked_balance) : 0;
            if (totalCost > lockedBalance) {
               return res.status(400).json({
                  success: false,
                  error: `Total input cost (₦${totalCost.toLocaleString()}) exceeds locked funds (₦${lockedBalance.toLocaleString()}). Please select fewer inputs or request additional funding.`
               });
            }
         }
      }

      const result = await updateInputRequestItems(req.params.id, selectedItems);
      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error submitting items:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to submit items" });
   }
};

pipelineController.approveItems = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      // Strict role check: Only Finance can approve
      if (payload.role?.toLowerCase() !== 'finance' && payload.role?.toLowerCase() !== 'super admin') {
         return res.status(403).json({ success: false, error: "Only Finance roles can approve items" });
      }

      const { distributor_id } = req.body;
      const result = await approveInputItems(req.params.id, payload.id, distributor_id);
      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error approving items:", error);
      return res.status(500).json({ success: false, error: "Failed to approve items" });
   }
};

pipelineController.getDistributorInputs = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      if (payload.role?.toLowerCase() !== 'distributor') {
         return res.status(403).json({ success: false, error: "Access denied. Not a distributor." });
      }

      const requests = await getInputRequestsByDistributor(payload.id);
      return res.status(200).json({ success: true, data: requests });
   } catch (error) {
      console.error("Error fetching distributor inputs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch requests" });
   }
};

pipelineController.updateInputStatus = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { status } = req.body;
      if (!['dispatched', 'delivered'].includes(status)) {
         return res.status(400).json({ success: false, error: "Invalid status" });
      }

      const result = await updateInputRequestStatus(req.params.id, status, payload.id);
      if (!result) return res.status(404).json({ success: false, error: "Request not found or not assigned to you" });

      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error updating input status:", error);
      return res.status(500).json({ success: false, error: "Failed to update status" });
   }
};

pipelineController.confirmDelivery = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const confirmed = await confirmInputDelivery(req.params.id, payload.id);
      return res.status(200).json({ success: true, data: confirmed });
   } catch (error) {
      console.error("Error confirming delivery:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to confirm delivery" });
   }
};

// ============ PLANTING ============

pipelineController.createPlanting = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const profile = await getFarmerProfileByVendor(payload.id);
      if (!profile) return res.status(404).json({ success: false, error: "Farmer profile not found" });

      const activity = await createPlantingActivity({ ...req.body, farmer_id: profile.id });
      return res.status(201).json({ success: true, data: activity });
   } catch (error) {
      console.error("Error creating planting:", error);
      return res.status(500).json({ success: false, error: "Failed to create planting activity" });
   }
};

pipelineController.getMyPlanting = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const profile = await getFarmerProfileByVendor(payload.id);
      if (!profile) return res.status(200).json({ success: true, data: [] });

      const activities = await getPlantingByFarmer(profile.id);
      return res.status(200).json({ success: true, data: activities });
   } catch (error) {
      console.error("Error fetching planting:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch planting" });
   }
};

// ============ VERIFICATIONS ============

pipelineController.createVerification = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const verification = await createFieldVerification({ ...req.body, officer_id: payload.id });
      return res.status(201).json({ success: true, data: verification });
   } catch (error) {
      console.error("Error creating verification:", error);
      return res.status(500).json({ success: false, error: "Failed to create verification" });
   }
};

pipelineController.getClusterVerifications = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const verifications = await getVerificationsByCluster(req.params.id);
      return res.status(200).json({ success: true, data: verifications });
   } catch (error) {
      console.error("Error fetching verifications:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch verifications" });
   }
};

// ============ SUPERVISION ============

pipelineController.getSupervision = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const supervision = await getFarmSupervisionByFarmer(req.params.farmerId);
      return res.status(200).json({ success: true, data: supervision });
   } catch (error) {
      console.error("Error fetching supervision:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch supervision" });
   }
};

pipelineController.updateSupervision = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const supervision = await upsertFarmSupervision({ ...req.body, officer_id: payload.id });
      return res.status(200).json({ success: true, data: supervision });
   } catch (error) {
      console.error("Error updating supervision:", error);
      return res.status(500).json({ success: false, error: "Failed to update supervision" });
   }
};

pipelineController.getClusterSupervision = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const supervision = await getClusterSupervision(req.params.clusterId);
      return res.status(200).json({ success: true, data: supervision });
   } catch (error) {
      console.error("Error fetching cluster supervision:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch cluster supervision" });
   }
};

pipelineController.updateClusterSupervision = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const supervision = await upsertClusterSupervision({ ...req.body, officer_id: payload.id });
      return res.status(200).json({ success: true, data: supervision });
   } catch (error) {
      console.error("Error updating cluster supervision:", error);
      return res.status(500).json({ success: false, error: "Failed to update cluster supervision" });
   }
};

// ============ HARVEST ============

pipelineController.createHarvest = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const approval = await createHarvestApproval(req.body);
      return res.status(201).json({ success: true, data: approval });
   } catch (error) {
      console.error("Error creating harvest approval:", error);
      return res.status(500).json({ success: false, error: "Failed to create harvest approval" });
   }
};

// ============ LOGISTICS ============

pipelineController.createLogistics = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const entry = await createLogisticsEntry(req.body);
      return res.status(201).json({ success: true, data: entry });
   } catch (error) {
      console.error("Error creating logistics:", error);
      return res.status(500).json({ success: false, error: "Failed to create logistics entry" });
   }
};

pipelineController.getClusterLogistics = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const entries = await getLogisticsByCluster(req.params.id);
      return res.status(200).json({ success: true, data: entries });
   } catch (error) {
      console.error("Error fetching logistics:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch logistics" });
   }
};

// ============ BUYER MATCHES ============

pipelineController.createBuyerMatch = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const match = await createBuyerMatch(req.body);
      return res.status(201).json({ success: true, data: match });
   } catch (error) {
      console.error("Error creating buyer match:", error);
      return res.status(500).json({ success: false, error: "Failed to create buyer match" });
   }
};

pipelineController.getBuyerMatches = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const matches = await getBuyerMatches();
      return res.status(200).json({ success: true, data: matches });
   } catch (error) {
      console.error("Error fetching buyer matches:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch matches" });
   }
};

// ============ SALES (with Paystack Escrow) ============

pipelineController.createSale = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const sale = await createSale(req.body);

      // Deposit sales value into cluster wallet (escrow-style via Paystack)
      if (req.body.cluster_id) {
         const clusterWallet = await getWalletByOwner(req.body.cluster_id, "cluster");
         if (clusterWallet) {
            await depositToClusterWallet(clusterWallet.id, parseFloat(req.body.total_sales_value), `Sale settlement - ${sale.id}`, sale.id);
         }
      }

      return res.status(201).json({ success: true, data: sale });
   } catch (error) {
      console.error("Error creating sale:", error);
      return res.status(500).json({ success: false, error: "Failed to create sale" });
   }
};

pipelineController.getClusterSales = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const sales = await getSalesByCluster(req.params.id);
      return res.status(200).json({ success: true, data: sales });
   } catch (error) {
      console.error("Error fetching sales:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch sales" });
   }
};

// ============ REPAYMENTS ============

pipelineController.createRepayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const repayment = await createRepayment(req.body);
      return res.status(201).json({ success: true, data: repayment });
   } catch (error) {
      console.error("Error creating repayment:", error);
      return res.status(500).json({ success: false, error: "Failed to create repayment" });
   }
};

pipelineController.processRepayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { recovered_amount } = req.body;
      const result = await updateRepayment(req.params.id, parseFloat(recovered_amount));
      return res.status(200).json({ success: true, data: result });
   } catch (error) {
      console.error("Error processing repayment:", error);
      return res.status(500).json({ success: false, error: "Failed to process repayment" });
   }
};

// ============ DASHBOARD STATS ============

pipelineController.getStats = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const stats = await getPipelineStats(payload.id, payload.role);
      return res.status(200).json({ success: true, data: stats });
   } catch (error) {
      console.error("Error fetching stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch stats" });
   }
};
pipelineController.getSalesDashboardStats = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const stats = await getSalesStats();
      return res.status(200).json({ success: true, data: stats });
   } catch (error) {
      console.error("Error fetching sales stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch sales stats" });
   }
};

pipelineController.getIntelligenceDashboardStats = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const stats = await getIntelligenceStats();
      return res.status(200).json({ success: true, data: stats });
   } catch (error) {
      console.error("Error fetching intelligence stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch intelligence stats" });
   }
};

pipelineController.getPlatformWalletStats = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const stats = await getPlatformWalletTotals();
      return res.status(200).json({ success: true, data: stats });
   } catch (error) {
      console.error("Error fetching platform wallet stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch stats" });
   }
};

pipelineController.getPlatformWalletTransactions = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      
      const role = payload.role?.toLowerCase();
      if (role !== "finance" && role !== "super admin" && role !== "admin") {
         return res.status(403).json({ success: false, error: "Forbidden: Finance or Admin role required" });
      }

      const transactions = await getEcosystemTreasuryTransactions();
      return res.status(200).json({ success: true, data: transactions });
   } catch (error) {
      console.error("Error fetching ecosystem treasury transactions:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch transactions" });
   }
};

pipelineController.getAllLogistics = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const entries = await getAllLogisticsEntries();
      return res.status(200).json({ success: true, data: entries });
   } catch (error) {
      console.error("Error fetching all logistics:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch logistics" });
   }
};

pipelineController.updateLogisticsStatus = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { id, status } = req.body;
      const entry = await updateLogisticsStatusDb(id, status);
      return res.status(200).json({ success: true, data: entry });
   } catch (error) {
      console.error("Error updating logistics status:", error);
      return res.status(500).json({ success: false, error: "Failed to update status" });
   }
};

pipelineController.getWarehouseInventory = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const inventory = await getWarehouseInventoryStats();
      return res.status(200).json({ success: true, data: inventory });
   } catch (error) {
      console.error("Error fetching warehouse inventory:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch inventory" });
   }
};

pipelineController.addWarehouseStock = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { commodity, quantity, measuring_scale, price_per_unit, warehouse_name } = req.body;
      if (!commodity || !quantity || !warehouse_name || !price_per_unit) {
         return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      const record = await addWarehouseStock(commodity, parseFloat(quantity), measuring_scale || 'Tons', parseFloat(price_per_unit), warehouse_name);
      return res.status(201).json({ success: true, data: record });
   } catch (error) {
      console.error("Error adding warehouse stock:", error);
      return res.status(500).json({ success: false, error: "Failed to add warehouse stock" });
   }
};

pipelineController.removeWarehouseStock = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { id } = req.params;
      const record = await removeWarehouseStock(id);
      return res.status(200).json({ success: true, data: record });
   } catch (error) {
      console.error("Error removing warehouse stock:", error);
      return res.status(500).json({ success: false, error: "Failed to remove warehouse stock" });
   }
};

pipelineController.getDistributors = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const distributors = await getAllDistributors();
      return res.status(200).json({ success: true, data: distributors });
   } catch (error) {
      console.error("Error fetching distributors:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch distributors" });
   }
};

pipelineController.createEcosystemOrder = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { items, total_amount, delivery_address, status, escrow_status } = req.body;
      if (!items || !items.length) {
         return res.status(400).json({ success: false, error: "Order items are required" });
      }

      const order = await createEcosystemOrder(
         payload.id, 
         items, 
         total_amount, 
         delivery_address, 
         status || 'pending', 
         escrow_status || 'none'
      );
      return res.status(201).json({ success: true, data: order });
   } catch (error) {
      console.error("Error creating ecosystem order:", error);
      if (error.message?.includes("price_per_unit") || error.message?.includes("Invalid quantity")) {
         return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Failed to create order" });
   }
};

pipelineController.initializeEcosystemOrderPayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { id } = req.params;
      const { email } = req.body;
      const order = await getEcosystemOrderForPayment(id, payload.id);
      if (!order) return res.status(404).json({ success: false, error: "Order not found" });
      if (order.payment_status === "finance_confirmed") {
         return res.status(400).json({ success: false, error: "Payment already confirmed by finance" });
      }

      const buyerEmail = email || order.email || payload.email;
      if (!buyerEmail) {
         return res.status(400).json({ success: false, error: "Buyer email is required for Paystack payment" });
      }

      const payment = await createEcosystemOrderPayment(order.id, payload.id, order.total_amount, {
         order_id: order.id,
         buyer_id: payload.id,
      });

      const initResponse = await initializePaystack("/transaction/initialize", {
         body: {
            email: buyerEmail,
            amount: Math.round(Number(order.total_amount) * 100),
            metadata: {
               order_id: order.id,
               payment_id: payment.id,
               buyer_id: payload.id,
               category: "buyer_ecosystem_order",
            },
            callback_url: ecosystemPaymentCallbackUrl(order.id),
         },
      });

      const updatedPayment = await markEcosystemOrderPaymentProcessing(
         payment.id,
         initResponse.data.reference,
         {
            ...(payment.metadata || {}),
            paystack_access_code: initResponse.data.access_code,
         }
      );

      return res.status(200).json({
         success: true,
         data: {
            authorization_url: initResponse.data.authorization_url,
            access_code: initResponse.data.access_code,
            reference: initResponse.data.reference,
            payment_id: updatedPayment.id,
         },
      });
   } catch (error) {
      console.error("Error initializing ecosystem order payment:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to initialize payment" });
   }
};

pipelineController.verifyEcosystemOrderPayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const reference = req.query.reference || req.query.ref || req.body?.reference;
      if (!reference) return res.status(400).json({ success: false, error: "Payment reference is required" });

      const payment = await getEcosystemOrderPaymentByReference(reference);
      if (!payment) return res.status(404).json({ success: false, error: "Payment record not found" });
      if (payment.buyer_id !== payload.id) {
         return res.status(403).json({ success: false, error: "Payment does not belong to this buyer" });
      }
      if (payment.status === "finance_confirmed") {
         return res.status(200).json({ success: true, message: "Payment already confirmed by finance", data: payment });
      }
      if (payment.status === "paystack_verified") {
         return res.status(200).json({ success: true, message: "Payment already verified. Waiting for finance confirmation.", data: payment });
      }

      const verifyRes = await verifyPaystackTransaction(reference);
      if (verifyRes.data?.status !== "success") {
         return res.status(400).json({ success: false, error: "Payment verification not successful" });
      }

      const expectedAmountKobo = Math.round(Number(payment.amount) * 100);
      if (verifyRes.data.amount !== expectedAmountKobo) {
         return res.status(400).json({ success: false, error: "Payment amount mismatch" });
      }

      const updatedPayment = await recordEcosystemPaystackVerification(
         payment.id,
         String(verifyRes.data.id),
         {
            ...(payment.metadata || {}),
            paystack: {
               status: verifyRes.data.status,
               paid_at: verifyRes.data.paid_at,
               channel: verifyRes.data.channel,
               currency: verifyRes.data.currency,
            },
         }
      );

      return res.status(200).json({
         success: true,
         message: "Payment verified with Paystack. Waiting for finance confirmation.",
         data: updatedPayment,
      });
   } catch (error) {
      console.error("Error verifying ecosystem order payment:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to verify payment" });
   }
};

pipelineController.confirmEcosystemOrderPayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      if (payload.role?.toLowerCase() !== "finance" && payload.role?.toLowerCase() !== "super admin") {
         return res.status(403).json({ success: false, error: "Only finance can confirm ecosystem order payments" });
      }

      const result = await confirmEcosystemOrderPayment(req.params.id, payload.id, req.body.finance_note || null);
      return res.status(200).json({
         success: true,
         message: "Payment confirmed by finance. Sales can now process the order.",
         data: result,
      });
   } catch (error) {
      console.error("Error confirming ecosystem order payment:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to confirm payment" });
   }
};

pipelineController.getEcosystemOrders = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const orders = await getEcosystemOrders(payload.id);
      return res.status(200).json({ success: true, data: orders });
   } catch (error) {
      console.error("Error fetching ecosystem orders:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch orders" });
   }
};

pipelineController.processEscrowPayment = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { order_id, payment_reference } = req.body;
      await processEscrowPayment(order_id, payment_reference);
      return res.status(200).json({ success: true, message: "Payment held in escrow" });
   } catch (error) {
      console.error("Error processing escrow payment:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to process payment" });
   }
};

pipelineController.assignOrderDistributor = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      // In production, check if payload.role is 'finance' or 'admin'

      const { order_id, distributor_id } = req.body;
      await assignOrderDistributor(order_id, distributor_id);
      return res.status(200).json({ success: true, message: "Order assigned to distributor" });
   } catch (error) {
      console.error("Error assigning order distributor:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to assign distributor" });
   }
};

pipelineController.updateOrderStatus = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const { status } = req.body;
      if (!['pending', 'payment_processing', 'payment_pending_finance', 'ready_for_sales', 'paid', 'assigned', 'processing', 'processed', 'in_progress', 'delivered', 'cancelled'].includes(status)) {
         return res.status(400).json({ success: false, error: "Invalid status" });
      }

      const order = await updateEcosystemOrderStatus(req.params.id, status);
      return res.status(200).json({ success: true, data: order });
   } catch (error) {
      console.error("Error updating ecosystem order status:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to update order status" });
   }
};

pipelineController.getAllEcosystemOrders = async (req, res) => {
   try {
      // Allow admin/finance access
      const orders = await getAllEcosystemOrders();
      return res.status(200).json({ success: true, data: orders });
   } catch (error) {
      console.error("Error fetching all ecosystem orders:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch orders" });
   }
};

pipelineController.getDistributorOrders = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const orders = await getEcosystemOrdersByDistributor(payload.id);
      return res.status(200).json({ success: true, data: orders });
   } catch (error) {
      console.error("Error fetching distributor orders:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch orders" });
   }
};

pipelineController.markOrderAsDelivered = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });
      const { orderId } = req.body;
      await markOrderDelivered(orderId);
      return res.status(200).json({ success: true, message: "Order marked as delivered" });
   } catch (error) {
      console.error("Error marking order as delivered:", error);
      return res.status(500).json({ success: false, error: "Failed to update order" });
   }
};

pipelineController.getDistributorStats = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      if (payload.role?.toLowerCase() !== 'distributor') {
         return res.status(403).json({ success: false, error: "Access denied. Not a distributor." });
      }

      const stats = await getDistributorStats(payload.id);
      return res.status(200).json({ success: true, data: stats });
   } catch (error) {
      console.error("Error fetching distributor stats:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch distributor stats" });
   }
};

pipelineController.createPreHarvestListing = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      if (payload.role?.toLowerCase() !== 'cluster supervisor') {
         return res.status(403).json({ success: false, error: "Access denied" });
      }

      const { cluster_id, program_id, commodity, estimated_yield_tons, offer_price_per_ton, expected_harvest_date } = req.body;
      const data = {
         cluster_id, supervisor_id: payload.id, program_id, commodity,
         estimated_yield_tons, offer_price_per_ton, expected_harvest_date
      };
      const listing = await createPreHarvestListing(data);
      return res.status(201).json({ success: true, data: listing });
   } catch (error) {
      console.error("Error creating pre-harvest listing:", error);
      return res.status(500).json({ success: false, error: "Failed to create listing" });
   }
};

pipelineController.getClusterPreHarvestListings = async (req, res) => {
   try {
      const { id } = req.params;
      const listings = await getPreHarvestListingsByCluster(id);
      return res.status(200).json({ success: true, data: listings });
   } catch (error) {
      console.error("Error fetching cluster pre-harvest listings:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch listings" });
   }
};

pipelineController.getAllPreHarvestOpportunities = async (req, res) => {
   try {
      const listings = await getAllPreHarvestListings();
      return res.status(200).json({ success: true, data: listings });
   } catch (error) {
      console.error("Error fetching all pre-harvest opportunities:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch opportunities" });
   }
};

pipelineController.createForwardContract = async (req, res) => {
   try {
      let payload = await verifyBuyerToken(req);
      if (!payload) {
         const vendorPayload = await verifyVendorToken(req);
         if (!vendorPayload || !['exporter', 'off-taker', 'warehouse buyer', 'processor'].includes(vendorPayload.role?.toLowerCase())) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
         }
         payload = { buyer_id: vendorPayload.id };
      }

      const { pre_harvest_listing_id, quantity_tons, total_price } = req.body;
      const data = {
         buyer_id: payload.buyer_id, pre_harvest_listing_id, quantity_tons, total_price
      };
      const contract = await createForwardContract(data);
      return res.status(201).json({ success: true, data: contract });
   } catch (error) {
      console.error("Error creating forward contract:", error);
      return res.status(500).json({ success: false, error: "Failed to create forward contract" });
   }
};

pipelineController.getBuyerForwardContracts = async (req, res) => {
   try {
      let payload = await verifyBuyerToken(req);
      if (!payload) {
         const vendorPayload = await verifyVendorToken(req);
         if (!vendorPayload || !['exporter', 'off-taker', 'warehouse buyer', 'processor'].includes(vendorPayload.role?.toLowerCase())) {
            return res.status(401).json({ success: false, error: "Unauthorized" });
         }
         payload = { buyer_id: vendorPayload.id };
      }

      const contracts = await getForwardContractsByBuyer(payload.buyer_id);
      return res.status(200).json({ success: true, data: contracts });
   } catch (error) {
      console.error("Error fetching buyer forward contracts:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch forward contracts" });
   }
};

pipelineController.getSalesForwardContracts = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const contracts = await getForwardContractsForSales();
      return res.status(200).json({ success: true, data: contracts });
   } catch (error) {
      console.error("Error fetching sales forward contracts:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch sales forward contracts" });
   }
};

export default pipelineController;
