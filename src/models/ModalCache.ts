import mongoose, { Schema, Document } from 'mongoose';

export interface IModalCache extends Document {
  snapshotId: string;    
  targetUrl: string;     
  prompt: string;
  layer: number;
  components: string[];
  response: any;         
  createdAt: Date;
}

const ModalCacheSchema = new Schema({
  snapshotId: { type: String, required: true, index: true },
  targetUrl: { type: String, required: true, index: true },
  prompt: { type: String, required: true },
  layer: { type: Number, required: true },
  components: [{ type: String }],
  response: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

ModalCacheSchema.index({ prompt: 1, targetUrl: 1, layer: 1 });

export const ModalCache = mongoose.model<IModalCache>('ModalCache', ModalCacheSchema);