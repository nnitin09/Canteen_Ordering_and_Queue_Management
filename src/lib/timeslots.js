/**
 * Utility for generating and validating campus canteen pickup time slots.
 * Each slot represents a 15-minute collection window (e.g. "12:15 PM - 12:30 PM").
 */

/**
 * Formats a Date object to "hh:mm A" string (e.g. "12:15 PM")
 */
function formatTime12H(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const minStr = minutes < 10 ? `0${minutes}` : minutes;
  const hourStr = hours < 10 ? `0${hours}` : hours;
  return `${hourStr}:${minStr} ${ampm}`;
}

/**
 * Generates an array of realistic, available pickup time slots starting from
 * ~15 minutes after the current time, rounded up to the next 15-minute mark.
 *
 * @param {string} canteenId - ID of the canteen (optional)
 * @param {Date} [baseDate] - Reference date (defaults to now)
 * @param {number} [slotCount=12] - Number of slots to generate
 * @returns {Array<{ id: string, label: string, start: string, end: string, isEarliest: boolean, badge: string }>}
 */
export function generateTimeSlots(canteenId = "foodcourt-34", baseDate = new Date(), slotCount = 12) {
  const slots = [];
  const startRef = new Date(baseDate.getTime());

  // Add 15 minutes preparation lead time
  startRef.setMinutes(startRef.getMinutes() + 15);

  // Round up to the next 15-minute mark (0, 15, 30, 45)
  const remainder = startRef.getMinutes() % 15;
  if (remainder !== 0) {
    startRef.setMinutes(startRef.getMinutes() + (15 - remainder));
  }
  startRef.setSeconds(0, 0);

  for (let i = 0; i < slotCount; i++) {
    const slotStart = new Date(startRef.getTime() + i * 15 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 15 * 60 * 1000);

    const startFormatted = formatTime12H(slotStart);
    const endFormatted = formatTime12H(slotEnd);
    const label = `${startFormatted} - ${endFormatted}`;

    slots.push({
      id: `slot-${i}`,
      label,
      start: startFormatted,
      end: endFormatted,
      isEarliest: i === 0,
      badge: i === 0 ? "⚡ Earliest Available" : i === 1 ? "Recommended" : ""
    });
  }

  return slots;
}

/**
 * Validates whether a provided string matches a valid pickup time slot format
 */
export function isValidTimeSlot(slot) {
  if (!slot || typeof slot !== "string") return false;
  const trimmed = slot.trim();
  if (trimmed.length < 10) return false;
  // Matches e.g. "12:15 PM - 12:30 PM" or "01:00 PM - 01:15 PM"
  return /\d{1,2}:\d{2}\s*(?:AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)/i.test(trimmed);
}

