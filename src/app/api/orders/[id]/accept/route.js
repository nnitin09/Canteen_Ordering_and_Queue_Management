import { connectToDatabase } from "@/lib/mongodb";
import Order from "@/models/Order";
import { generateNextToken } from "@/lib/tokens";
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

    // Prevent duplicate acceptance
    if (existingOrder.vendorApprovalStatus === "Accepted" && existingOrder.tokenNumber) {
      return Response.json(
        {
          success: false,
          message: `Order has already been accepted with Token #${existingOrder.tokenNumber}`,
          order: existingOrder
        },
        { status: 400 }
      );
    }

    // Prevent accepting rejected order
    if (existingOrder.vendorApprovalStatus === "Rejected" || existingOrder.orderStatus === "Rejected") {
      return Response.json(
        { success: false, message: "Cannot accept an order that has already been rejected." },
        { status: 400 }
      );
    }

    // Generate next unique token
    const tokenNumber = await generateNextToken();

    existingOrder.tokenNumber = tokenNumber;
    existingOrder.vendorApprovalStatus = "Accepted";
    existingOrder.orderStatus = "Accepted";
    existingOrder.approvedAt = new Date();

    await existingOrder.save();

    return Response.json(
      {
        success: true,
        message: `Order accepted successfully. Token #${tokenNumber} assigned.`,
        tokenNumber,
        order: existingOrder
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { success: false, message: "Failed to accept order", error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

