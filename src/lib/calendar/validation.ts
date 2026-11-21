import { z } from 'zod';

/** GET /api/calendar 的月份参数，格式 YYYY-MM。 */
export const calendarQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, '月份格式应为 YYYY-MM')
    .optional(),
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
