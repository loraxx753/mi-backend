import mongoose, { Schema, model, type Model } from 'mongoose';

const analysisRecordSchema = new Schema(
  {
    prompt: { type: String, required: true, index: true },
    layer: { type: Number, required: true, index: true },
    components: { type: [String], required: true },
    componentsKey: { type: String, required: true, index: true },
    source: { type: String, enum: ['MOCK', 'FIXTURE', 'LIVE'], required: true, index: true },
    tokens: { type: [String], required: true },
    attention: { type: [[[Number]]], required: true },
    visualizations: { type: Schema.Types.Mixed, required: false, default: undefined },
    status: { type: String },
    device: { type: String },
  },
  { timestamps: true },
);

analysisRecordSchema.index({ prompt: 1, layer: 1, componentsKey: 1, source: 1 }, { unique: true });

export const AnalysisRecordModel =
  (mongoose.models.AnalysisRecord as Model<any>) || model<any>('AnalysisRecord', analysisRecordSchema as any);
