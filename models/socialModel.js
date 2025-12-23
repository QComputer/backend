import mongoose from "mongoose";

const socialSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    relationshipType: {
        type: String,
        enum: ['friend', 'follower', 'following'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'blocked'],
        default: 'accepted'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
socialSchema.index({ userId: 1, targetUserId: 1, relationshipType: 1 });
socialSchema.index({ targetUserId: 1, relationshipType: 1 });

const socialModel = mongoose.models.social || mongoose.model("social", socialSchema);

export default socialModel;