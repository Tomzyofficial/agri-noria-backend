import { z } from "zod";

export const createJobSchema = z
  .object({
    title: z.string().trim().min(3, "Job title must be at least 3 characters"),
    category: z.string().min(1, "Please select a job category"),
    customCategory: z.string().optional(),
    employmentType: z.string().min(1, "Please select an employment type"),
    openings: z.coerce.number().min(1, "Openings must be at least 1"),
    state: z.string().trim().min(2, "State is required"),
    city: z.string().trim().min(2, "City is required"),
    country: z.string().trim().min(2, "Country is required"),
    deadline: z.string().min(1, "Application deadline is required"),
    locationType: z.string().min(1, "Please select a location type"),
    salaryType: z.string().min(1, "Please select a salary type"),
    salaryMin: z.coerce
      .number()
      .nonnegative("Minimum salary cannot be negative")
      .optional(),
    salaryMax: z.coerce
      .number()
      .nonnegative("Maximum salary cannot be negative")
      .optional(),
    experienceLevel: z.string().min(1, "Please select an experience level"),
    educationLevel: z.string().min(1, "Please select an education level"),
    description: z.string().trim().min(30, "Job description is too short"),
    responsibilities: z
      .string()
      .trim()
      .min(20, "Responsibilities are required"),
    requirements: z.string().trim().min(20, "Job requirement is too short"),
    benefits: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category === "other" && !data.customCategory?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customCategory"],
        message: "Please specify the custom category",
      });
    }

    if (data.salaryMin && data.salaryMax && data.salaryMin > data.salaryMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMax"],
        message: "Maximum salary must be greater than minimum salary",
      });
    }

    const deadline = new Date(data.deadline);

    if (deadline <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deadline"],
        message: "Application deadline must be in the future",
      });
    }
  });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const validateJobApplication = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  email: z.email("Please enter a valid email address"),
  phone: z.string().trim().min(7, "Please enter a valid phone number"),
  country: z.string().min(1, "Please select a country"),
  state: z.string().min(1, "Please select a state"),
  city: z.string().trim().min(2, "Please enter your city or address"),
  experience_level: z
    .enum(["beginner", "intermediate", "advanced"])
    .optional()
    .or(z.literal("")),
  education_level: z
    .enum(["high_school", "diploma", "bachelor", "master", "phd"])
    .optional()
    .or(z.literal("")),
  cover_letter: z
    .string()
    .max(5000, "Cover letter is too long")
    .optional()
    .or(z.literal("")),
  linkedin_url: z
    .union([z.literal(""), z.url("Please enter a valid LinkedIn URL")])
    .optional(),
  cv_file: z
    .any()
    .refine((file) => !!file, "Please upload your CV")
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      "File size must be less than 10MB",
    )
    .refine(
      (file) => ACCEPTED_FILE_TYPES.includes(file.mimetype),
      "Only PDF file is allowed",
    ),
});
