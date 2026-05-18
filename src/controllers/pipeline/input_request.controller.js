import { createDetailedInputRequest, getInputRequestsByFarmer } from "../../db/pipeline/pipeline.db.js";
import { verifyVendorToken } from "../../sessions/vendor.auth.session.js";

const inputRequestController = {};

// Create a new detailed input request
inputRequestController.createRequest = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) {
         return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { input_items, farmer_id, cluster_id, is_cluster_request } = req.body;
      
      if (!input_items || !Array.isArray(input_items) || input_items.length === 0) {
         return res.status(400).json({ success: false, error: "Please select at least one input item" });
      }

      // Determine requester type and ID
      let requester_type = payload.account_type?.toLowerCase();
      let requester_id = payload.id;

      // Handle specific role normalization
      if (requester_type === 'aggregator') requester_type = 'aggregator';
      else if (requester_type === 'cluster supervisor' || requester_type === 'cluster manager') requester_type = 'cluster_manager';
      else if (requester_type === 'farmer') requester_type = 'farmer';
      else {
         return res.status(403).json({ success: false, error: "Only Farmers, Cluster Managers, and Aggregators can request inputs" });
      }

      const requestData = {
         farmer_id: requester_type === 'farmer' ? (farmer_id || payload.id) : farmer_id,
         cluster_id,
         requester_type,
         requester_id,
         input_items,
         is_cluster_request: is_cluster_request || false
      };

      const newRequest = await createDetailedInputRequest(requestData);
      return res.status(201).json({ success: true, data: newRequest });
   } catch (error) {
      console.error("Error creating input request:", error);
      return res.status(500).json({ success: false, error: error.message || "Failed to create input request" });
   }
};

// Get requests for the current user
inputRequestController.getMyRequests = async (req, res) => {
   try {
      const payload = await verifyVendorToken(req);
      if (!payload) return res.status(401).json({ success: false, error: "Unauthorized" });

      const requests = await getInputRequestsByFarmer(payload.id);
      return res.status(200).json({ success: true, data: requests });
   } catch (error) {
      console.error("Error fetching my requests:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch requests" });
   }
};

export default inputRequestController;
