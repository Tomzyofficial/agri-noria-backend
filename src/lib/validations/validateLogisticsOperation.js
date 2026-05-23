import { z } from "zod";

const vehicleUploadSchema = z.object({
  images: z
    .any()
    .refine((file) => !!file, {
      message: "Vehicle image is required.",
    })
    .refine(
      (file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file?.mimetype),
      {
        message: "Only JPG, PNG, or WEBP images are allowed.",
      },
    )
    .refine((file) => file?.size <= 10 * 1024 * 1024, {
      message: "Image size must not exceed 10MB.",
    }),
  // Matches VARCHAR(255) and is trimmed
  title: z
    .string()
    .min(3, { message: "Title must be at least 3 characters long." })
    .max(255, { message: "Title cannot exceed 255 characters." })
    .trim(),

  // Classification selection
  vehicle_type: z
    .string()
    .min(1, { message: "Vehicle classification type is required." }),

  // Matches UNIQUE VARCHAR(50), auto-transforms to uppercase to match the backend sanitation
  license_plate: z
    .string()
    .min(2, { message: "Invalid license plate length." })
    .max(50, { message: "License plate cannot exceed 50 characters." })
    .trim()
    .toUpperCase(),

  // Matches the cargo_enclosure_type ENUM
  cargo_type: z.enum(["enclosed_box", "open_bed", "refrigerated"], {
    errorMap: () => ({
      message: "Please select a valid cargo enclosure type.",
    }),
  }),

  // Matches INTEGER and CHECK (max_weight_kg > 0)
  max_weight_kg: z.coerce
    .number({ invalid_type_error: "Weight capacity must be a valid number." })
    .int({ message: "Weight capacity must be a whole number (integer)." })
    .positive({ message: "Weight capacity must be greater than 0 kg." }),

  // Matches NUMERIC(6, 2) CHECK (volume_cubic_meters > 0) and is optional
  volume_cubic_meters: z.coerce
    .number({ invalid_type_error: "Volume must be a valid number." })
    .positive({ message: "Volume must be a positive number if provided." })
    .nullable()
    .optional(),

  // Matches VARCHAR(150)
  base_location: z
    .string()
    .min(2, { message: "Base hub location is required." })
    .max(150, { message: "Location text is too long." })
    .trim(),

  // Matches TEXT[] array logic (must have at least one zone)
  operating_regions: z
    .array(z.string().min(1).trim())
    .min(1, { message: "Please add at least one operating transit region." }),

  // Matches pricing_model_type ENUM
  pricing_model: z.enum(["flat_rate", "per_km"], {
    errorMap: () => ({
      message: "Please select a valid pricing structural model.",
    }),
  }),

  // Matches NUMERIC(12, 2) CHECK (rate_amount >= 0)
  rate_amount: z.coerce
    .number({ invalid_type_error: "Rate amount must be a number." })
    .nonnegative({ message: "Rate amount cannot be negative." }),
});

export default vehicleUploadSchema;
