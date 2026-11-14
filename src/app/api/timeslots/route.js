import { generateTimeSlots } from "@/lib/timeslots";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const canteenId = searchParams.get("canteenId") || "foodcourt-34";

    const slots = generateTimeSlots(canteenId, new Date(), 12);

    return Response.json(
      {
        success: true,
        canteenId,
        slots
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { success: false, message: "Failed to generate time slots", error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

