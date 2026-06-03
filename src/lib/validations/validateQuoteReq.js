import z from "zod";

// Storage booking request validation schema
const storageQuoteRequestSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  //  phone: z.string().min(1, "Phone number is required"),
  commodity: z.string().min(1, "Commodity is required"),
  quantity: z.number().positive("Quantity must be a positive number"),
  unit: z.string().min(1, "Unit is required"),
  duration: z.string().min(1, "Duration is required"),
  start_date: z.string().min(1, "Start date is required"),
  storage_type: z.string().min(1, "Storage type is required"),
  agreement: z.literal(true, { message: "You must agree to the terms" }),
});

export { storageQuoteRequestSchema };
