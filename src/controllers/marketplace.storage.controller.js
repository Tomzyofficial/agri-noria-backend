import { getAllListedStorage, getSingleListedStorageByHref } from "../db/market-place/marketplace.storage.db.js";

const marketplaceStorageController = {};
// Get all the home page marketplace products
marketplaceStorageController.getAllStorage = async (req, res) => {
   try {
      let country;
      const userLocationCookie = req.cookies?.user_location;
      if (userLocationCookie) {
         const locationData = JSON.parse(userLocationCookie);
         country = locationData.country_code;
      }
      const data = await getAllListedStorage(country);
      return res.status(200).json({ result: data });
   } catch {
      return res.status(500).json({ error: "Internal server error. Please try again later." });
   }
};

// Get single storage by href (name)
marketplaceStorageController.getSingleStorageByHref = async (req, res) => {
   const href = req.params.href;
   try {
      const data = await getSingleListedStorageByHref(href);
      if (!data.success) {
         return res.status(404).json(data);
      }
      return res.status(200).json(data);
   } catch {
      res.status(500).json({ error: "Internal server error. Please try again later." });
   }
};

export default marketplaceStorageController;
