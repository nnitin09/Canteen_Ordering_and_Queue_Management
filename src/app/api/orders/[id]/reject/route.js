import { connectToDatabase } from "@/lib/mongodb";
import Order from "@/models/Order";
import mongoose from "mongoose";

export async function POST(request, context) {
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

    const body = await request.json().catch(() => ({}));

    // Vendor authorization check
    if (body.canteenId && body.canteenId !== "all") {
      const orderCanteenId = existingOrder.canteenId || (existingOrder.items && existingOrder.items[0]?.canteenId);
      if (orderCanteenId && orderCanteenId !== body.canteenId) {
        return Response.json(
          { message: "Unauthorized. This order belongs to a different canteen vendor." },
          { status: 403 }
        );
      }
    }

    // Prevent rejecting an already accepted order
    if (existingOrder.vendorApprovalStatus === "Accepted" && !body.adminOverride) {
      return Response.json(
        {
          success: false,
          message: "Cannot reject an order that has already been accepted and assigned a token."
        },
        { status: 400 }
      );
    }

    // Prevent duplicate rejection
    if (existingOrder.vendorApprovalStatus === "Rejected" || existingOrder.orderStatus === "Rejected") {
      return Response.json(
        { success: false, message: "Order has already been rejected.", order: existingOrder },
        { status: 400 }
      );
    }

    const reason = (body.reason || body.rejectionReason || body.cancellationReason || "Declined by kitchen").toString().trim();

    existingOrder.vendorApprovalStatus = "Rejected";
    existingOrder.orderStatus = "Rejected";
    existingOrder.rejectedAt = new Date();
    existingOrder.rejectionReason = reason;
    existingOrder.cancellationReason = reason;
    // tokenNumber remains null!

    await existingOrder.save();

    return Response.json(
      {
        success: true,
        message: "Order has been rejected. Student notified.",
        order: existingOrder
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { success: false, message: "Failed to reject order", error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

