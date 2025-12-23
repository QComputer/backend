import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: function() {
            return !this.groupId; // Required only if not a group message
        }
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'group'
    },
    subject: {
        type: String,
        required: true,
        default: "Message"
    },
    content: {
        type: String,
        required: true,
        maxLength: 1000
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'location', 'order', 'group'],
        default: 'text'
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order'
    },
    isUrgent: {
        type: Boolean,
        default: false
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    delivered: {
        type: Boolean,
        default: false
    },
    // Track which users have read the message (for group messages)
    readByUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }],
    timestamp: {
        type: Date,
        default: Date.now
    },
    edited: {
        type: Boolean,
        default: false
    },
    editedAt: {
        type: Date
    },
    deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false
});

// Index for efficient queries
messageSchema.index({ senderId: 1, recipientId: 1, timestamp: -1 });
messageSchema.index({ groupId: 1, timestamp: -1 });
messageSchema.index({ recipientId: 1, isRead: 1 });
messageSchema.index({ readByUsers: 1 });
messageSchema.index({ timestamp: -1 });

const messageModel = mongoose.models.message || mongoose.model("message", messageSchema);

export default messageModel;