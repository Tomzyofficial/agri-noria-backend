import { getCategories } from "../../db/farmDevelopment/categories.db.js";

const categoriesController = {};

categoriesController.getCategories = async (req, res) => {
  try {
    const categories = await getCategories();

    if (!categories) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch categories",
      });
    }

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Error in getCategories controller:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
    });
  }
};

export default categoriesController;
