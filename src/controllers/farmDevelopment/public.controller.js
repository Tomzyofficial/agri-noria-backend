/* import {
  getPublicCategories,
  getPublicProvider,
  getPublicProviders,
  getPublicServices,
  getPublicStats,
} from "../../db/farmDevelopment/public.db.js";

const publicFarmDevelopmentController = {};

publicFarmDevelopmentController.getStats = async (_req, res) => {
  const stats = await getPublicStats();
  return res.status(200).json(stats);
};

publicFarmDevelopmentController.getCategories = async (_req, res) => {
  const categories = await getPublicCategories();
  return res.status(200).json({ categories });
};

publicFarmDevelopmentController.getProviders = async (req, res) => {
  const data = await getPublicProviders(req.query);
  return res.status(200).json(data);
};

publicFarmDevelopmentController.getProvider = async (req, res) => {
  const provider = await getPublicProvider(req.params.id);
  if (!provider) {
    return res.status(404).json({ error: "Provider not found" });
  }
  return res.status(200).json(provider);
};

publicFarmDevelopmentController.getServices = async (req, res) => {
  const data = await getPublicServices({
    categorySlug: req.query.category_slug || req.query.category,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });
  return res.status(200).json(data);
};

publicFarmDevelopmentController.createQuote = async (req, res) => {
  const providerId = req.body.provider_id;
  const serviceId = req.body.service_id;

  if (!providerId || !req.body.client_name || !req.body.client_email) {
    return res.status(400).json({
      error: "Missing required fields: provider_id, client_name, client_email",
    });
  }

  const lead = await createLead({
    listingId: serviceId,
    companyId: providerId,
    customerName: req.body.client_name,
    customerEmail: req.body.client_email,
    customerPhone: req.body.client_phone,
    message: req.body.project_description,
    budget: req.body.budget_range,
    location: req.body.location,
    requestedService: req.body.requested_service || "",
    metadata: {
      organization: req.body.client_organization || "",
      landSize: req.body.land_size || null,
      landSizeUnit: req.body.land_size_unit || "",
      timeline: req.body.timeline || "",
      additionalNotes: req.body.additional_notes || "",
    },
  });

  if (!lead) {
    return res.status(500).json({ error: "Failed to create quote request" });
  }

  return res.status(201).json({ lead });
};

export default publicFarmDevelopmentController;
 */
import {
  getProviderById,
  getServices,
  submitBookingRequest,
  //   getCategories,
} from "../../db/farmDevelopment/public.db.js";

const publicFarmDevelopmentController = {};

// Get a single provider by ID with their services and portfolio
publicFarmDevelopmentController.getProviderById = async (req, res) => {
  try {
    const { businessName } = req.params;
    const provider = await getProviderById(businessName);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    return res.status(200).json(provider);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch provider" });
  }
};

// Get services with optional category and search filters
publicFarmDevelopmentController.getServices = async (req, res) => {
  try {
    const { category, search } = req.query;
    const services = await getServices(category, search);
    //  console.log(services);
    return res.status(200).json(services);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch services" });
  }
};

publicFarmDevelopmentController.submitBookingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("req id", id);
    const bookingData = req.body;
    const metadata = {
      client_email: bookingData.client_email,
      client_organization: bookingData.client_organization,
      land_size: bookingData.land_size,
      land_size_unit: bookingData.land_size_unit,
      location: bookingData.location,
      budget_range: bookingData.budget_range,
      timeline: bookingData.timeline,
      //  additional_notes: bookingData.additional_notes,
      //  agreement: bookingData.agreement,
    };

    const result = await submitBookingRequest({
      data: {
        ...bookingData,
        metadata,
        target_id: id,
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to submit booking request" });
  }
};

// Get all categories with service counts
// publicFarmDevelopmentController.getCategories = async (_req, res) => {
//   try {
//     const categories = await getCategories();
//     return res.status(200).json({ categories });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ error: "Failed to fetch categories" });
//   }
// };

export default publicFarmDevelopmentController;
