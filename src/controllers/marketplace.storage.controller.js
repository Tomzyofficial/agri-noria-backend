import {
  getAllListedStorage,
  getSingleListedStorageById,
  submitBookingRequest,
  incrementStorageBookingClickCount,
  incrementStorageViewCount,
} from "../db/market-place/marketplace.storage.db.js";
import { storageQuoteRequestSchema } from "../lib/validations/validateQuoteReq.js";

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
    return res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

// Get single storage by ID
marketplaceStorageController.getSingleStorageById = async (req, res) => {
  const id = req.params.id;
  try {
    const data = await getSingleListedStorageById(id);
    if (!data.success) {
      return res.status(404).json(data);
    }
    return res.status(200).json(data);
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error. Please try again later." });
  }
};

marketplaceStorageController.trackStorageView = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: "Missing storage id" });
  }

  try {
    const updated = await incrementStorageViewCount(id);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, error: "Storage not found" });
    }
    return res
      .status(200)
      .json({ success: true, view_count: updated.view_count });
  } catch (error) {
    console.error("Error tracking storage view", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

marketplaceStorageController.trackBookingClick = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res
      .status(400)
      .json({ success: false, error: "Missing storage id" });
  }

  try {
    const updated = await incrementStorageBookingClickCount(id);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, error: "Storage not found" });
    }
    return res.status(200).json({
      success: true,
      booking_click_count: updated.booking_click_count,
    });
  } catch (error) {
    console.error("Error tracking booking click", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

marketplaceStorageController.submitBookingRequest = async (req, res) => {
  const { id } = req.params;
  const bookingData = req.body;
  const metadata = {
    commodity: bookingData.commodity,
    quantity: bookingData.quantity,
    unit: bookingData.unit,
    duration: bookingData.duration,
    start_date: bookingData.start_date,
    storage_type: bookingData.storage_type,
    pickup_location: bookingData.pickup_location,
    delivery_location: bookingData.delivery_location,
    transport_date: bookingData.transport_date,
    agreement: bookingData.agreement,
  };

  //   const validateSchema = storageQuoteRequestSchema.safeParse(bookingData);
  //   if (!validateSchema.success) {
  //     const fieldErrors = validateSchema.error.flatten().fieldErrors;
  //     const firstMsg = Object.values(fieldErrors).flat().filter(Boolean)[0];
  //     if (firstMsg) {
  //       return res.status(400).json({ success: false, error: firstMsg });
  //     }
  //   }

  try {
    const booking = await submitBookingRequest({
      data: {
        ...bookingData,
        target_id: id,
        metadata: metadata,
      },
    });
    return res.status(201).json({ success: true, booking });
  } catch (error) {
    console.log("Error submitting booking request:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error. Please try again later.",
    });
  }
};

export default marketplaceStorageController;
