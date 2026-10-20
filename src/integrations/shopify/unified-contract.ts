import {z} from "zod";
const id=z.string().uuid();
export const unifiedCommandSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("enable"),requestKey:id,consent:z.literal(true),manualCleanupAcknowledged:z.literal(true).optional()}).strict(),
  z.object({action:z.literal("preview"),requestKey:id,from:z.string(),through:z.string()}).strict(),
  z.object({action:z.literal("import"),requestKey:id,previewId:id,manualCleanupAcknowledged:z.literal(true).optional()}).strict(),
  z.object({action:z.literal("process"),requestKey:id,manualCleanupAcknowledged:z.literal(true).optional()}).strict(),
  z.object({action:z.literal("cleanup"),requestKey:id}).strict(),
  z.object({action:z.literal("automatic"),requestKey:id,enabled:z.boolean()}).strict(),
]);
export const unifiedWorkspaceSchema=z.object({connection:z.object({id,shopGid:z.string(),status:z.enum(["pending","verified","paused","disconnected"]),
  revision:z.number().int().positive().safe(),ready:z.boolean(),unified:z.boolean(),automatic:z.boolean(),pilotOrderGid:z.string().nullable(),pending:z.number().int().nonnegative(),needsAttention:z.number().int().nonnegative()}).strict().nullable()}).strict();
export type UnifiedWorkspace=z.infer<typeof unifiedWorkspaceSchema>&{workerConfigured?:boolean};
export const unifiedImportReceiptSchema=z.object({status:z.literal("queued"),previewId:id,rows:z.array(z.object({orderGid:z.string(),reference:z.string(),
  status:z.enum(["queued","already_queued","already_imported","reference_match","conflict"])}).strict()).max(2000)}).strict();
export type UnifiedImportPreview={previewId:string|null;expiresAt:string|null;complete:boolean;from:string;through:string;
  rows:Array<{orderGid:string;reference:string;amount:string;currency:string;financialStatus:string|null;status:"new"|"already_imported"|"reference_match"|"conflict";orderIds:string[]}>};
export type UnifiedActionState={status:"idle"|"success"|"error";message:string;view?:UnifiedWorkspace;
  preview?:UnifiedImportPreview;receipt?:z.infer<typeof unifiedImportReceiptSchema>;continueProcessing?:boolean};
