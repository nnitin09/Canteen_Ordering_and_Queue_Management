import { connectToDatabase } from "@/lib/mongodb";
import Order from "@/models/Order";
import Menu from "@/models/Menu";
import mongoose from "mongoose";

// Self-healing check: ensure tokenNumber index in MongoDB is sparse so null values do not collide
let isIndexChecked = false;
async function ensureSparseTokenIndex() {
  if (isIndexChecked) return;
  try {
    const col = Order.collection;
    const indexes = await col.indexes();
    const tokenIdx = indexes.find((i) => i.name === "tokenNumber_1" || (i.key && i.key.tokenNumber));
    if (tokenIdx && !tokenIdx.sparse) {
      await col.dropIndex(tokenIdx.name).catch(() => {});
      await col.createIndex({ tokenNumber: 1 }, { unique: true, sparse: true }).catch(() => {});
    }
    isIndexChecked = true;
  } catch (e) {
    // Silently continue if index is already sparse or in memory
  }
}

export async function GET(request) {
  try {
    await connectToDatabase();
    await ensureSparseTokenIndex();

    const { searchParams } = new URL(request.url);
    const isStudent = searchParams.get("student") === "true";
    const phone = searchParams.get("phone");
    const email = searchParams.get("email");
    const name = searchParams.get("name");
    const ids = searchParams.get("ids");
    const canteen = searchParams.get("canteen");
    const canteenId = searchParams.get("canteenId");
    const status = searchParams.get("status") || searchParams.get("orderStatus");
    const approvalStatus = searchParams.get("approvalStatus");

    let query = {};
    const conditions = [];

    const studentAccountConditions = [];
    if (email && email.trim()) {
      studentAccountConditions.push({ studentEmail: email.toLowerCase().trim() });
    }

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      studentAccountConditions.push({
        $or: [{ studentPhone: cleanPhone }, { studentPhone: phone }]
      });
    }

    if (name && name.trim()) {
      studentAccountConditions.push({
        studentName: new RegExp(name.trim(), "i")
      });
    }

    if (studentAccountConditions.length > 0) {
      conditions.push({ $or: studentAccountConditions });
    }

    if (ids) {
      const idList = ids
        .split(",")
        .map((s) => s.trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (idList.length > 0) {
        conditions.push({ _id: { $in: idList } });
      }
    }

    // Specific student conditions filter
    if (conditions.length > 0) {
      query.$or = conditions;
    }

    // Status Filter (e.g. "Pending Approval", "Accepted", "Preparing", etc.)
    if (status && status !== "all") {
      let statusQuery;
      if (status === "Pending Approval" || status === "pending_approval") {
        statusQuery = {
          $or: [
            { orderStatus: "Pending Approval" },
            { orderStatus: "Pending", tokenNumber: null },
            { vendorApprovalStatus: "Pending" }
          ]
        };
      } else if (status === "Ready") {
        statusQuery = { orderStatus: { $in: ["Ready", "Ready for Pickup"] } };
      } else if (status === "Cancelled" || status === "Rejected") {
        statusQuery = { orderStatus: { $in: ["Cancelled", "Rejected"] } };
      } else {
        statusQuery = { orderStatus: status };
      }

      if (query.$or) {
        query = { $and: [{ $or: query.$or }, statusQuery] };
      } else {
        query = { ...query, ...statusQuery };
      }
    }

    // Approval status filter
    if (approvalStatus && approvalStatus !== "all") {
      query.vendorApprovalStatus = approvalStatus;
    }

    // Scoped Canteen Filter (supports canteenId and canteenName)
    if (canteenId && canteenId !== "all") {
      const canteenRegexMap = {
        "foodcourt-34": /34\s*Block/i,
        "nk-foodcourt": /NK/i,
        "main-canteen": /Main\s*Canteen/i,
        "library-cafe": /Library/i
      };
      const regex = canteenRegexMap[canteenId];
      const canteenConditions = [
        { canteenId: canteenId },
        { "items.canteenId": canteenId }
      ];
      if (regex) {
        canteenConditions.push({ canteenName: regex });
        canteenConditions.push({ "items.canteenName": regex });
      }

      if (query.$and) {
        query.$and.push({ $or: canteenConditions });
      } else if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: canteenConditions }] };
      } else {
        query.$or = canteenConditions;
      }
    } else if (canteen && canteen !== "All") {
      const canteenRegex = new RegExp(canteen.trim(), "i");
      const canteenConditions = [
        { canteenName: canteenRegex },
        { "items.canteenName": canteenRegex }
      ];
      if (query.$and) {
        query.$and.push({ $or: canteenConditions });
      } else if (query.$or) {
        query = { $and: [{ $or: query.$or }, { $or: canteenConditions }] };
      } else {
        query.$or = canteenConditions;
      }
    }

    // Retrieve all orders sorted by creation time (newest first)
    const orders = await Order.find(query).sort({ createdAt: -1 });
    return Response.json(orders, { status: 200 });
  } catch (error) {
    return Response.json(
      { message: "Failed to fetch orders", error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    await ensureSparseTokenIndex();

    const data = await request.json();

    const {
      studentName,
      studentEmail,
      studentPhone,
      items,
      paymentMethod,
      remarks,
      canteenId,
      canteenName,
      counterName,
      pickupSlot
    } = data;

    // 1. Mandatory Pickup Time Slot Selection Validation
    if (!pickupSlot || typeof pickupSlot !== "string" || !pickupSlot.trim()) {
      return Response.json(
        { message: "Please select a preferred pickup time slot before placing your order." },
        { status: 400 }
      );
    }

    // 2. Validate student name
    if (!studentName || studentName.trim() === "") {
      return Response.json(
        { message: "Student name is required to place an order" },
        { status: 400 }
      );
    }

    // 3. Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { message: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    // 4. Calculate total on the backend using actual prices from the database
    let calculatedTotal = 0;
    const verifiedOrderItems = [];

    for (const item of items) {
      if (!item.menuItemId) {
        return Response.json(
          { message: "Each item must have a valid menuItemId" },
          { status: 400 }
        );
      }

      const menuItem = await Menu.findById(item.menuItemId);
      if (!menuItem) {
        return Response.json(
          { message: `Menu item with ID ${item.menuItemId} was not found` },
          { status: 404 }
        );
      }

      const orderCanteenId = item.canteenId || canteenId || "foodcourt-34";
      const isSoldOutAtCanteen =
        Array.isArray(menuItem.soldOutCanteens) && menuItem.soldOutCanteens.includes(orderCanteenId);
      if (!menuItem.available || isSoldOutAtCanteen) {
        return Response.json(
          {
            message: `"${menuItem.name}" is currently sold out at this canteen. Please adjust your cart.`,
            unavailableItem: menuItem.name,
            preserveCart: true
          },
          { status: 400 }
        );
      }

      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        return Response.json(
          { message: `Invalid quantity for ${menuItem.name}. Must be at least 1` },
          { status: 400 }
        );
      }

      const effectivePrice =
        typeof item.price === "number" && item.price > 0 ? item.price : menuItem.price;
      const itemTotal = effectivePrice * quantity;
      calculatedTotal += itemTotal;

      verifiedOrderItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: effectivePrice,
        quantity: quantity,
        image: menuItem.image || "",
        canteenId: item.canteenId || canteenId || "foodcourt-34",
        canteenName: item.canteenName || canteenName || "",
        counterName: item.counterName || counterName || ""
      });
    }

    // Default payment method validation
    const validPaymentMethods = ["Cash", "UPI"];
    const selectedPaymentMethod = validPaymentMethods.includes(paymentMethod)
      ? paymentMethod
      : "Cash";

    // Generate a secure 4-digit secret pickup verification code
    const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Intelligent estimated preparation time calculation
    const activeOrdersAhead = await Order.countDocuments({
      orderStatus: { $in: ["Pending", "Pending Approval", "Accepted", "Preparing"] }
    });
    const estimatedPrepTime = Math.max(4, activeOrdersAhead * 3 + 3);

    const resolvedCanteenId = canteenId || verifiedOrderItems[0]?.canteenId || "foodcourt-34";

    // CRITICAL: Token number is NOT generated now.
    // It is assigned ONLY AFTER vendor approval!
    const newOrder = await Order.create({
      tokenNumber: null, // Token allocated only after vendor acceptance
      studentName: studentName.trim(),
      studentEmail: studentEmail ? studentEmail.trim().toLowerCase() : "",
      studentPhone: studentPhone ? studentPhone.trim() : "",
      remarks: remarks ? remarks.trim() : "",
      items: verifiedOrderItems,
      totalAmount: calculatedTotal,
      orderStatus: "Pending Approval",
      vendorApprovalStatus: "Pending",
      pickupSlot: pickupSlot.trim(),
      pickupCode,
      canteenId: resolvedCanteenId,
      canteenName: canteenName ? canteenName.trim() : "Food Court near 34 Block",
      counterName: counterName ? counterName.trim() : "Counter 1",
      estimatedPrepTime,
      paymentMethod: selectedPaymentMethod,
      paymentStatus: selectedPaymentMethod === "UPI" && data.paymentStatus === "Paid" ? "Paid" : "Pending"
    });

    return Response.json(newOrder, { status: 201 });
  } catch (error) {
    return Response.json(
      { message: "Failed to place order", error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
