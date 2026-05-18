import {
   getAllMarketplaceProducts,
   getSingleMarketplaceProduct,
   getReviews,
   submitReview,
} from "../db/market-place/marketplace.db.js";
import { getBoostedMarketplaceCatalog } from "../modules/ads/services/ads.public.service.js";

const marketplaceController = {};
marketplaceController.getBoostedCatalog = async (req, res) => {
   try {
      let country = req.query.country;
      const q = req.query.q;
      if (!country) {
         const userLocationCookie = req.cookies?.user_location;
         if (userLocationCookie) {
            const locationData = JSON.parse(userLocationCookie);
            country = locationData.country_code;
         }
      }
      if (!country) {
         return res.status(400).json({ success: false, error: "country is required (query or user_location cookie)" });
      }
      const rows = await getBoostedMarketplaceCatalog({ country, q });
      return res.json({ success: true, result: rows });
   } catch (error) {
      console.error("Error in getBoostedCatalog:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch catalog" });
   }
};

// Get all the home page marketplace products
marketplaceController.getAllMarketProducts = async (req, res) => {
   try {
      let country;
      const userLocationCookie = req.cookies?.user_location;
      if (userLocationCookie) {
         const locationData = JSON.parse(userLocationCookie);
         country = locationData.country_code;
      }
      const data = await getAllMarketplaceProducts(country);
      return res.json({ result: data });
   } catch (error) {
      console.error("Error in getAllMarketProducts:", error);
      return res.status(500).json({ error: "Failed to fetch marketplace data" });
   }
};

// Get single marketplace product the details
marketplaceController.getSingleProduct = async (req, res) => {
   const id = req.params.id;
   try {
      const data = await getSingleMarketplaceProduct(id);
      return res.json(data.product);
   } catch {
      res.status(500).json({ error: "Failed to fetch marketplace data" });
   }
};

// Get product reviews
marketplaceController.getProductReviews = async (req, res) => {
   try {
      const { id } = req.params;
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const pageSize = Math.min(parseInt(req.query.pageSize || "2", 10), 50);

      const { reviews, summary } = await getReviews({
         listingId: id,
         page,
         pageSize,
      });

      res.status(200).json({
         success: true,
         reviews,
         summary,
         page,
         pageSize,
      });
   } catch {
      res.status(500).json({ success: false, error: "Failed to fetch reviews" });
   }
};

// Submit or update a review for a specific product listing
marketplaceController.submitReview = async (req, res) => {
   const { id } = req.params;
   const { rating, feedback, buyerId } = req.body;
   try {
      const data = await submitReview(id, rating, feedback, buyerId);
      res.json(data);
   } catch (error) {
      res.status(500).json({ error: error.message || "Internal server error. Please try again later." });
   }
};

export default marketplaceController;
