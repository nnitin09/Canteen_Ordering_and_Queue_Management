"use client";

import { useState, useEffect } from "react";
import { generateTimeSlots } from "@/lib/timeslots";
import { ClockIcon, CheckCircleIcon } from "./Icons";

export default function TimeSlotPicker({
  selectedSlot = "",
  onSelectSlot,
  canteen,
  error = "",
  disabled = false
}) {
  const canteenId = typeof canteen === "string" ? canteen : canteen?.id || canteen?.canteenId || "foodcourt-34";
  const canteenName = typeof canteen === "object" ? canteen?.name || "Campus Canteen" : "Campus Canteen";

  // Initialize immediately with local generator for zero latency
  const [slots, setSlots] = useState(() => generateTimeSlots(canteenId, new Date(), 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    // Refresh slots dynamically from API
    fetch(`/api/timeslots?canteenId=${encodeURIComponent(canteenId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data?.success && Array.isArray(data.slots) && data.slots.length > 0) {
          setSlots(data.slots);
        }
      })
      .catch(() => {
        // Fallback to local generation if network drops
        if (isSubscribed) {
          setSlots(generateTimeSlots(canteenId, new Date(), 10));
        }
      })
      .finally(() => {
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [canteenId]);

  return (
    <div className={`timeslot-picker-card ${error ? "has-error" : ""}`}>
      <div className="timeslot-header-row">
        <div className="timeslot-title-wrap">
          <ClockIcon size={17} className="timeslot-icon" />
          <label className="timeslot-main-label" htmlFor="timeslot-grid-group">
            Select Pickup Time Slot <span className="required-star">*</span>
          </label>
        </div>
        {selectedSlot && (
          <span className="timeslot-selected-pill">
            <CheckCircleIcon size={13} /> {selectedSlot}
          </span>
        )}
      </div>

      <p className="timeslot-subhint">
        Choose when you will collect your fresh meal from <strong>{canteenName}</strong>. Orders require kitchen acceptance before preparation.
      </p>

      {error && (
        <div className="timeslot-error-banner" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div
        id="timeslot-grid-group"
        className="timeslot-grid"
        role="radiogroup"
        aria-label="Preferred pickup time slot"
      >
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot.label;
          return (
            <button
              key={slot.id || slot.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              className={`timeslot-chip ${isSelected ? "selected" : ""} ${slot.isEarliest ? "earliest-chip" : ""}`}
              onClick={() => {
                if (onSelectSlot && !disabled) {
                  onSelectSlot(slot.label);
                }
              }}
            >
              <div className="timeslot-chip-top">
                <span className="timeslot-time-text">{slot.label}</span>
                <span className={`timeslot-radio-dot ${isSelected ? "active" : ""}`}>
                  {isSelected && "✓"}
                </span>
              </div>
              {slot.badge && (
                <span className={`timeslot-badge-tag ${slot.isEarliest ? "earliest" : ""}`}>
                  {slot.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

