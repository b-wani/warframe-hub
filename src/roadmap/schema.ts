import { z } from "zod";

export const nodeKindSchema = z.enum(["quest", "junction", "preparation"]);

export const preparationItemSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const roadmapNodeSchema = z.strictObject({
  id: z.string().min(1),
  kind: nodeKindSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  prerequisites: z.array(z.string().min(1)),
  preparations: z.array(preparationItemSchema),
  cautions: z.array(z.string().min(1)),
  spoiler: z.boolean(),
  sourceIds: z.array(z.string().min(1)).min(1),
  basedOnPatch: z.string().min(1),
});

export const sourceSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  collectedAt: z.iso.date(),
  status: z.enum(["alive", "dead"]),
});

export type NodeKind = z.infer<typeof nodeKindSchema>;
export type PreparationItem = z.infer<typeof preparationItemSchema>;
export type RoadmapNode = z.infer<typeof roadmapNodeSchema>;
export type Source = z.infer<typeof sourceSchema>;

export type Roadmap = {
  nodes: RoadmapNode[];
  sources: Source[];
};
