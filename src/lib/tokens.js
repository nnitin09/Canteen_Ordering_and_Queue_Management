import Order from "@/models/Order";

/**
 * Safely generates the next sequential unique token number (e.g. "T-101", "T-102")
 * by finding the highest assigned token in the database.
 * Only called when a vendor ACCEPTS an order.
 */
export async function generateNextToken() {
  // Find the most recent order that has an assigned token number
  const lastOrderWithToken = await Order.findOne({
    tokenNumber: { $exists: true, $ne: null, $nin: ["", null] }
  }).sort({ createdAt: -1 });

  let nextNumber = 101;
  if (lastOrderWithToken && lastOrderWithToken.tokenNumber) {
    const match = lastOrderWithToken.tokenNumber.match(/\d+/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  // Ensure uniqueness in case of gaps or race conditions
  let candidateToken = `T-${nextNumber}`;
  let exists = await Order.findOne({ tokenNumber: candidateToken });
  while (exists) {
    nextNumber += 1;
    candidateToken = `T-${nextNumber}`;
    exists = await Order.findOne({ tokenNumber: candidateToken });
  }

  return candidateToken;
}

