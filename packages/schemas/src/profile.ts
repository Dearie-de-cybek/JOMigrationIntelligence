import { z } from 'zod';

const opt = (max = 200) => z.string().trim().max(max).optional();
const band = z.coerce.number().min(0).max(9).multipleOf(0.5);

export const profileSchema = z.object({
  personal: z
    .object({
      fullName: z.string().trim().min(2).max(200),
      phone: opt(30),
      dateOfBirth: z.coerce.date().optional(),
      countryOfResidence: opt(),
      nationality: opt(),
      relationshipStatus: opt(),
    })
    .optional(),
  education: z
    .array(
      z.object({
        qualification: z.string().trim().min(1).max(200),
        fieldOfStudy: opt(),
        institution: opt(),
        country: opt(),
        graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
      }),
    )
    .max(10)
    .optional(),
  employment: z
    .array(
      z.object({
        jobTitle: z.string().trim().min(1).max(200),
        occupation: opt(),
        employer: opt(),
        country: opt(),
        employmentType: opt(50),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      }),
    )
    .max(20)
    .optional(),
  languageTests: z
    .array(
      z.object({
        testType: z.string().trim().min(1).max(50),
        testDate: z.coerce.date().optional(),
        listening: band.optional(),
        reading: band.optional(),
        writing: band.optional(),
        speaking: band.optional(),
        overall: band.optional(),
      }),
    )
    .max(5)
    .optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;
