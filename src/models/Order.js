import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu"
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: {
    type: String,
    default: ""
  },
  canteenId: {
    type: String,
    default: "foodcourt-34"
  },
  canteenName: {
    type: String,
    default: ""
  },
  counterName: {
    type: String,
    default: ""
  }
});

const orderSchema = new mongoose.Schema({
  tokenNumber: {
    type: String,
    default: null,
    sparse: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  studentEmail: {
    type: String,
    trim: true,
    default: ""
  },
  studentPhone: {
    type: String,
    trim: true,
    default: ""
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Order Status Lifecycle:
  // 1. Pending Approval (waiting for vendor action)
  // 2. Accepted (vendor accepted, token generated)
  // 3. Rejected (vendor declined, no token)
  // 4. Preparing (vendor is cooking/assembling)
  // 5. Ready for Pickup (food ready at counter)
  // 6. Completed (order picked up by student)
  orderStatus: {
    type: String,
    enum: [
      "Pending Approval",
      "Pending",
      "Accepted",
      "Preparing",
      "Ready for Pickup",
      "Ready",
      "Completed",
      "Missed Pickup",
      "Rejected",
      "Cancelled"
    ],
    default: "Pending Approval"
  },
  // Time Slot Selection (Required before placing order)
  pickupSlot: {
    type: String,
    required: true,
    trim: true,
    default: "Immediate (Standard)"
  },
  // Vendor Approval System fields
  vendorApprovalStatus: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending"
  },
  approvedAt: {
    type: Date,
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: ""
  },
  pickupCode: {
    type: String,
    required: true
  },
  missedAt: {
    type: Date,
    default: null
  },
  rescheduleCount: {
    type: Number,
    default: 0
  },
  canteenId: {
    type: String,
    default: "foodcourt-34",
    index: true
  },
  canteenName: {
    type: String,
    default: "Main Campus Cafeteria (Block B)"
  },
  counterName: {
    type: String,
    default: "Counter 1 (Express Delivery)"
  },
  remarks: {
    type: String,
    trim: true,
    default: ""
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: ""
  },
  calledAt: {
    type: Date,
    default: null
  },
  callCount: {
    type: Number,
    default: 0
  },
  estimatedPrepTime: {
    type: Number,
    default: 7
  },
  delayMinutes: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: null,
    min: 1,
    max: 5
  },
  ratedAt: {
    type: Date,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ["Cash", "UPI"],
    default: "Cash"
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid"],
    default: "Pending"
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

orderSchema.index({ tokenNumber: 1 }, { unique: true, sparse: true });
orderSchema.index({ canteenId: 1, orderStatus: 1 });

if (mongoose.models && mongoose.models.Order) {
  delete mongoose.models.Order;
}

export default mongoose.model("Order", orderSchema);
