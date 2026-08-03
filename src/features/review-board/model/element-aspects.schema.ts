import { z } from 'zod'

export const AspectColorTokenSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
})

export const ElementLayoutAspectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
  rotation: z.number().finite().default(0),
})

export const ElementFlexAspectSchema = z.object({
  direction: z.string().min(1),
  gap: z.string().min(1),
  padding: z.string().min(1),
  align: z.string().min(1).optional(),
})

export const ElementBorderAspectSchema = z.object({
  width: z.string().min(1),
  color: AspectColorTokenSchema,
})

export const ElementTypeAspectSchema = z.object({
  sizeLeading: z.string().min(1),
  family: z.string().min(1),
  weight: z.string().min(1),
})

export const ElementAspectsSchema = z.object({
  layout: ElementLayoutAspectSchema,
  flex: ElementFlexAspectSchema.optional(),
  radius: z.string().min(1).optional(),
  fills: z.array(AspectColorTokenSchema).default([]),
  border: ElementBorderAspectSchema.optional(),
  type: ElementTypeAspectSchema.optional(),
})

export type AspectColorToken = z.infer<typeof AspectColorTokenSchema>
export type ElementAspects = z.infer<typeof ElementAspectsSchema>
