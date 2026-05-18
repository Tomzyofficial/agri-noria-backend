import { marketplaceDb } from "../../db/marketplace/marketplace.db.js";

// ============ STAGE 12: BUYER/OFFTAKER MATCHING ============

export const createMarketplaceListing = async (req, res) => {
   try {
      const { id: vendorId, account_type: role } = req.user;

      // Only aggregators can create listings
      if (role !== "aggregator") {
         return res.status(403).json({ error: "Only aggregators can create marketplace listings" });
      }

      const { commodity, quantity, unit, estimatedQuality, harvestDate, location, availableFrom, availableUntil } =
         req.body;

      if (!commodity || !quantity || !unit) {
         return res.status(400).json({ error: "Missing required fields" });
      }

      const listing = await marketplaceDb.createListing(vendorId, {
         commodity,
         quantity,
         unit,
         estimatedQuality,
         harvestDate,
         location,
         availableFrom,
         availableUntil,
      });

      res.status(201).json({
         success: true,
         message: "Marketplace listing created successfully",
         listing,
      });
   } catch (err) {
      console.error("Create listing error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const getMarketplaceListings = async (req, res) => {
   try {
      const { status, commodity, aggregator_id } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (commodity) filters.commodity = commodity;
      if (aggregator_id) filters.aggregator_id = aggregator_id;

      const listings = await marketplaceDb.getListings(filters);

      res.status(200).json({
         success: true,
         count: listings.length,
         listings,
      });
   } catch (err) {
      console.error("Get listings error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const submitBuyerOffer = async (req, res) => {
   try {
      const { id: buyerId, account_type: role } = req.user;

      if (role !== "buyer") {
         return res.status(403).json({ error: "Only buyers can submit offers" });
      }

      const { listing_id, offered_price, quantity_offered, terms } = req.body;

      if (!listing_id || !offered_price) {
         return res.status(400).json({ error: "Missing required fields" });
      }

      const offer = await marketplaceDb.createOffer(listing_id, buyerId, offered_price, quantity_offered, terms);

      res.status(201).json({
         success: true,
         message: "Offer submitted successfully",
         offer,
      });
   } catch (err) {
      console.error("Submit offer error:", err);
      res.status(500).json({ error: err.message });
   }
};

export const getListingOffers = async (req, res) => {
   try {
      const { listing_id } = req.params;
      const offers = await marketplaceDb.getOffers(listing_id);

      res.status(200).json({
         success: true,
         count: offers.length,
         offers,
      });
   } catch (err) {
      console.error("Get offers error:", err);
      res.status(500).json({ error: err.message });
   }
};

export default {
   createMarketplaceListing,
   getMarketplaceListings,
   submitBuyerOffer,
   getListingOffers,
};
