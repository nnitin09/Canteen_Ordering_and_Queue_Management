"use client";

import { useState } from "react";
import { AlertTriangleIcon } from "./Icons";

const DECLINE_REASONS = [
  { id: "stock", label: "🚫 Item(s) Out of Stock" },
  { id: "busy", label: "⏳ Kitchen Overloaded / Long Delay" },
  { id: "closing", label: "🔒 Canteen Closing Soon" },
  { id: "ingredients", label: "🥩 Raw Ingredients Finished" },
  { id: "custom", label: "📝 Other / Custom Reason" }
];

export default function DeclineOrderModal({ isOpen, order, onClose, onConfirmDecline }) {
  const [selectedReason, setSelectedReason] = useState(DECLINE_REASONS[0].label);
  const [customText, setCustomText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalReason =
      selectedReason.includes("Other")
        ? customText.trim() || "Declined by kitchen"
        : selectedReason.replace(/^[^\w\s]+\s*/, ""); // strip leading emoji for clean message

    try {
      setIsSubmitting(true);
      setError("");
      await onConfirmDecline(order._id, finalReason);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to decline order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="decline-modal-backdrop" onClick={onClose}>
      <div
        className="decline-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="decline-modal-header">
          <div className="decline-icon-box">
            <AlertTriangleIcon size={24} />
          </div>
          <div>
            <div className="decline-pill">REJECT / DECLINE ORDER REQUEST</div>
            <h3 className="decline-title">
              {order.tokenNumber ? `Decline Token ${order.tokenNumber}` : `Reject Order #${String(order._id || "").slice(-6).toUpperCase()}`}
            </h3>
            <p className="decline-subtitle">
              Student: <strong>{order.studentName}</strong> • {order.items?.length || 0} item(s) • ₹{order.totalAmount}
              {order.pickupSlot && ` • Slot: ${order.pickupSlot}`}
            </p>
          </div>
        </div>

        {error && <div className="decline-error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="decline-reason-heading">
            Select reason for declining this order:
          </div>

          <div className="decline-reasons-list">
            {DECLINE_REASONS.map((r) => (
              <label
                key={r.id}
                className={`decline-reason-item ${selectedReason === r.label ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="declineReason"
                  checked={selectedReason === r.label}
                  onChange={() => setSelectedReason(r.label)}
                />
                <span className="reason-label-text">{r.label}</span>
              </label>
            ))}
          </div>

          {selectedReason.includes("Other") && (
            <div className="decline-custom-input-wrap">
              <input
                type="text"
                className="form-input"
                placeholder="Type specific reason for student..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                autoFocus
                required
              />
            </div>
          )}

          <div className="decline-notice-box">
            <span>ℹ️</span>
            <p>
              The student will receive an instant notification that their order was cancelled with this reason, allowing them to reorder or choose another canteen.
            </p>
          </div>

          <div className="decline-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Keep Order
            </button>
            <button
              type="submit"
              className="btn btn-danger btn-confirm-decline"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Rejecting..." : "✕ Confirm Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

