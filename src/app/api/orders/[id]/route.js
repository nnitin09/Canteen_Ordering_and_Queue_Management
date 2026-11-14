import { connectToDatabase } from "@/lib/mongodb";
import Order from "@/models/Order";
import { generateNextToken } from "@/lib/tokens";
import mongoose from "mongoose";

const VALID_ORDER_STATUSES = [
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
];

const VALID_PAYMENT_STATUSES = ["Pending", "Paid"];

export async function PUT(request, context) {
  try {
    await connectToDatabase();
    const params = await context.params;
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ message: "Invalid order ID" }, { status: 400 });
    }

    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return Response.json({ message: "Order not found" }, { status: 404 });
    }

    const data = await request.json();
    const updateData = {};

    // Vendor Authorization Check: Ensure only the associated canteen vendor can accept/reject
    if (data.canteenId && data.canteenId !== "all") {
      const orderCanteenId = existingOrder.canteenId || (existingOrder.items && existingOrder.items[0]?.canteenId);
      if (orderCanteenId && orderCanteenId !== data.canteenId) {
        return Response.json(
          { message: "Unauthorized. This order belongs to a different canteen vendor." },
          { status: 403 }
        );
      }
    }

    // =========================================================================
    // VENDOR APPROVAL FLOW: ACCEPT ORDER & GENERATE TOKEN
    // =========================================================================
    if (data.action === "accept" || data.orderStatus === "Accepted") {
      // Prevent duplicate acceptance
      if (existingOrder.vendorApprovalStatus === "Accepted" && existingOrder.tokenNumber) {
        return Response.json(
          { message: `Order has already been accepted with Token #${existingOrder.tokenNumber}` },
          { status: 400 }
        );
      }

      // Prevent accepting an already rejected order
      if (existingOrder.vendorApprovalStatus === "Rejected" || existingOrder.orderStatus === "Rejected") {
        return Response.json(
          { message: "Cannot accept an order that has already been rejected." },
          { status: 400 }
        );
      }

      // Generate sequential unique token number
      const tokenNumber = await generateNextToken();

      updateData.tokenNumber = tokenNumber;
      updateData.vendorApprovalStatus = "Accepted";
      updateData.orderStatus = "Accepted";
      updateData.approvedAt = new Date();
    }

    // =========================================================================
    // VENDOR REJECTION FLOW: REJECT ORDER (NO TOKEN GENERATED)
    // =========================================================================
    else if (data.action === "reject" || data.orderStatus === "Rejected") {
      // Prevent rejecting an already accepted order
      if (existingOrder.vendorApprovalStatus === "Accepted" && !data.adminOverride) {
        return Response.json(
          { message: "Cannot reject an order that has already been accepted and assigned a token." },
          { status: 400 }
        );
      }

      // Prevent duplicate rejection
      if (existingOrder.vendorApprovalStatus === "Rejected" || existingOrder.orderStatus === "Rejected") {
        return Response.json(
          { message: "Order has already been rejected." },
          { status: 400 }
        );
      }

      const reason = (data.rejectionReason || data.cancellationReason || "Declined by kitchen").toString().trim();
      updateData.vendorApprovalStatus = "Rejected";
      updateData.orderStatus = "Rejected";
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = reason;
      updateData.cancellationReason = reason;
      // Critical: tokenNumber remains null!
    }

    // =========================================================================
    // REGULAR STATUS TRANSITIONS (Preparing, Ready, Completed, etc.)
    // =========================================================================
    else if (data.orderStatus !== undefined) {
      if (!VALID_ORDER_STATUSES.includes(data.orderStatus)) {
        return Response.json(
          {
            message: `Invalid orderStatus. Allowed values: ${VALID_ORDER_STATUSES.join(", ")}`
          },
          { status: 400 }
        );
      }

      // If moving directly to Preparing without prior acceptance, allocate token now
      if (data.orderStatus === "Preparing" && !existingOrder.tokenNumber) {
        updateData.tokenNumber = await generateNextToken();
        updateData.vendorApprovalStatus = "Accepted";
        updateData.approvedAt = new Date();
      }

      // Cancellation Rule: Student can only cancel if order is in Pending / Pending Approval
      if ((data.orderStatus === "Cancelled" || data.orderStatus === "Rejected") && !data.adminOverride) {
        const canCancel =
          existingOrder.orderStatus === "Pending" ||
          existingOrder.orderStatus === "Pending Approval" ||
          existingOrder.vendorApprovalStatus === "Pending";
        if (!canCancel) {
          return Response.json(
            {
              message: `Order cannot be cancelled because it is already "${existingOrder.orderStatus}". Only orders waiting for kitchen approval can be cancelled.`
            },
            { status: 400 }
          );
        }
      }

      if (data.cancellationReason !== undefined || data.rejectionReason !== undefined) {
        const reason = (data.cancellationReason || data.rejectionReason || "").toString().trim();
        updateData.cancellationReason = reason;
        updateData.rejectionReason = reason;
      }

      // Unpaid Handover Protection Rule
      if (data.orderStatus === "Completed") {
        const finalPaymentStatus = data.paymentStatus || existingOrder.paymentStatus;
        if (finalPaymentStatus !== "Paid" && !data.bypassPaymentCheck) {
          return Response.json(
            {
              message: `Payment Pending (₹${existingOrder.totalAmount}). Order cannot be handed over until payment is marked as Paid.`
            },
            { status: 400 }
          );
        }
      }

      // Secure Pickup Verification Code check
      if (data.orderStatus === "Completed" && data.verifyPickupCode !== undefined && !data.bypassVerification) {
        const inputCode = data.verifyPickupCode.toString().trim();
        const expectedCode = existingOrder.pickupCode ? existingOrder.pickupCode.toString().trim() : "";
        if (expectedCode && inputCode !== expectedCode) {
          return Response.json(
            { message: `Invalid Pickup Code "${inputCode}". Handover cannot be completed.` },
            { status: 400 }
          );
        }
      }

      // Missed Pickup & Auto-Requeue
      if (data.orderStatus === "Missed Pickup") {
        updateData.missedAt = new Date();
      } else if (
        existingOrder.orderStatus === "Missed Pickup" &&
        (data.orderStatus === "Ready" || data.orderStatus === "Ready for Pickup" || data.orderStatus === "Preparing")
      ) {
        updateData.rescheduleCount = (existingOrder.rescheduleCount || 0) + 1;
        updateData.missedAt = null;
      }

      updateData.orderStatus = data.orderStatus;
    }

    // Payment Status update
    if (data.paymentStatus !== undefined) {
      if (!VALID_PAYMENT_STATUSES.includes(data.paymentStatus)) {
        return Response.json(
          {
            message: `Invalid paymentStatus. Allowed values: ${VALID_PAYMENT_STATUSES.join(", ")}`
          },
          { status: 400 }
        );
      }
      updateData.paymentStatus = data.paymentStatus;
    }

    if (data.paymentMethod !== undefined) {
      if (["Cash", "UPI"].includes(data.paymentMethod)) {
        updateData.paymentMethod = data.paymentMethod;
      }
    }

    // Call Out Feature
    if (data.callOut || data.action === "call_out") {
      updateData.calledAt = new Date();
      updateData.callCount = (existingOrder.callCount || 0) + 1;
    }

    if (data.delayMinutes !== undefined) {
      updateData.delayMinutes = parseInt(data.delayMinutes, 10) || 0;
    }

    if (data.estimatedPrepTime !== undefined) {
      updateData.estimatedPrepTime = parseInt(data.estimatedPrepTime, 10) || 5;
    }

    // Rating
    if (data.rating !== undefined) {
      const stars = Math.min(5, Math.max(1, parseInt(data.rating, 10)));
      updateData.rating = stars;
      updateData.ratedAt = new Date();

      if (Array.isArray(existingOrder.items) && existingOrder.items.length > 0) {
        try {
          const Menu = (await import("@/models/Menu")).default;
          for (const it of existingOrder.items) {
            let menuItem = null;
            if (it.menuItemId && mongoose.Types.ObjectId.isValid(it.menuItemId)) {
              menuItem = await Menu.findById(it.menuItemId);
            }
            if (!menuItem && it.name) {
              menuItem = await Menu.findOne({ name: it.name });
            }

            if (menuItem) {
              if (!Array.isArray(menuItem.ratings)) {
                menuItem.ratings = [];
              }
              const orderIdStr = existingOrder._id.toString();
              const existingIdx = menuItem.ratings.findIndex(
                (r) => r.orderId && r.orderId.toString() === orderIdStr
              );

              if (existingIdx >= 0) {
                menuItem.ratings[existingIdx].stars = stars;
                menuItem.ratings[existingIdx].createdAt = new Date();
              } else {
                menuItem.ratings.push({
                  orderId: orderIdStr,
                  studentEmail: existingOrder.studentEmail || "",
                  studentName: existingOrder.studentName || "",
                  stars: stars,
                  createdAt: new Date()
                });
              }

              const baseRating = 4.5;
              const baseWeight = 5;
              const studentRatingsSum = menuItem.ratings.reduce((acc, r) => acc + (r.stars || 5), 0);
              const totalRatingsCount = baseWeight + menuItem.ratings.length;
              const newAvg = (baseRating * baseWeight + studentRatingsSum) / totalRatingsCount;

              menuItem.rating = Math.round(newAvg * 10) / 10;
              menuItem.ratingCount = totalRatingsCount;
              await menuItem.save();
            }
          }
        } catch (ratingErr) {
          console.error("Failed to update menu ratings from order rating:", ratingErr);
        }
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, { new: true });

    return Response.json(updatedOrder, { status: 200 });
  } catch (error) {
    return Response.json(
      { message: "Failed to update order", error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
