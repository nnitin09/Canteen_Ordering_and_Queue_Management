import { useState, useEffect } from "react";

export default function OrderSuccessOverlay({
  isOpen,
  isSubmitting,
  order,
  onClose,
  onGoToYourOrders,
  onTrackOrder
}) {
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    document.body.classList.add("order-modal-open");

    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("order-modal-open");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isSubmitting) {
      setLoadingStep(0);
      return;
    }

    const t1 = setTimeout(() => setLoadingStep(1), 500);
    const t2 = setTimeout(() => setLoadingStep(2), 1100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSubmitting]);

  if (!isOpen) return null;

  const counterDisplay = order?.counterName
    ? (order.counterName.includes("(") ? order.counterName : `${order.counterName} (Fast Dispatch)`)
    : "Counter 1 (Fast Dispatch)";

  const waitDisplay = order?.estimatedPrepTime
    ? `~ ${order.estimatedPrepTime} min`
    : "~ 8 min";

  const statusDisplay =
    order?.orderStatus || (order?.tokenNumber ? "Accepted" : "Pending Approval");

  return (
    <div
      className="order-overlay-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="order-overlay-card confirm-modal-card">
        {/* PHASE 1: SUBMITTING / PLACING ORDER RADAR ANIMATION */}
        {isSubmitting && (
          <div className="placing-order-box">
            <div className="radar-spinner-container">
              <div className="radar-wave wave-1"></div>
              <div className="radar-wave wave-2"></div>
              <div className="radar-wave wave-3"></div>
              <div className="radar-center-icon">
                <img
                  src="/images/canteengo-logo.png"
                  alt="canteenGo"
                  className="radar-food-img"
                />
              </div>
            </div>

            <h3 className="placing-title">Placing Your Canteen Order</h3>

            <div className="placing-steps-wrap">
              <div className={`step-item ${loadingStep >= 0 ? "active" : ""}`}>
                <span className="step-dot"></span>
                <span>Connecting to canteen kitchen...</span>
              </div>
              <div className={`step-item ${loadingStep >= 1 ? "active" : ""}`}>
                <span className="step-dot"></span>
                <span>Verifying menu prices in MongoDB...</span>
              </div>
              <div className={`step-item ${loadingStep >= 2 ? "active" : ""}`}>
                <span className="step-dot"></span>
                <span>Allocating your safe pickup token...</span>
              </div>
            </div>

            <div className="order-progress-track">
              <div
                className="order-progress-fill"
                style={{
                  width: loadingStep === 0 ? "35%" : loadingStep === 1 ? "75%" : "98%"
                }}
              ></div>
            </div>

            <span className="placing-subhint">
              Generating your live queue pass • Please hold on
            </span>
          </div>
        )}

        {/* PHASE 2: ORDER CONFIRMED MODAL CARD */}
        {!isSubmitting && order && (
          <div className="confirm-card-content">
            {/* Top Right Close Button */}
            <button
              type="button"
              className="confirm-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Confetti & Green Success Checkmark */}
            <div className="confirm-icon-wrapper">
              <svg
                className="confirm-confetti-svg"
                viewBox="0 0 100 100"
                fill="none"
              >
                {/* top green dash */}
                <line x1="50" y1="6" x2="50" y2="15" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
                {/* top right yellow dash */}
                <line x1="72" y1="16" x2="79" y2="23" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
                {/* right orange dash */}
                <line x1="86" y1="48" x2="93" y2="50" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
                {/* bottom right purple dash */}
                <line x1="75" y1="75" x2="82" y2="82" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
                {/* bottom left purple dash */}
                <line x1="25" y1="76" x2="31" y2="70" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
                {/* left yellow curved shape */}
                <path d="M 10 49 Q 15 46 17 50 Q 15 54 10 49 Z" fill="#eab308" />
                {/* top left green dash */}
                <line x1="22" y1="22" x2="28" y2="28" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
                {/* top left yellow oval */}
                <ellipse cx="36" cy="11" rx="4.5" ry="2.2" transform="rotate(-30 36 11)" fill="#eab308" />
              </svg>

              <div className="confirm-green-circle">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>

            {/* Headings */}
            <h2 className="confirm-title">
              {order.tokenNumber ? "Order Confirmed!" : "Order Placed • Waiting for Approval"}
            </h2>
            <p className="confirm-subtitle">
              {order.tokenNumber
                ? "Your order has been placed and assigned a pickup token."
                : "Sent to canteen vendor. Token will be issued upon acceptance."}
            </p>

            {/* Token & Estimated Wait 2-column Box */}
            <div className="confirm-token-wait-banner">
              <div className="confirm-token-col">
                <div className="confirm-banner-icon-wrap">
                  <svg
                    width="32"
                    height="24"
                    viewBox="0 0 24 18"
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V5z"></path>
                    <line x1="12" y1="3" x2="12" y2="15" strokeDasharray="2 2"></line>
                  </svg>
                </div>
                <div className="confirm-col-text">
                  <span className="confirm-col-label">
                    {order.tokenNumber ? "Token No." : "Token Status"}
                  </span>
                  <span
                    className="confirm-token-val"
                    style={!order.tokenNumber ? { fontSize: "0.95rem", color: "#c2410c" } : undefined}
                  >
                    {order.tokenNumber || "⏳ Pending Approval"}
                  </span>
                </div>
              </div>

              <div className="confirm-banner-divider"></div>

              <div className="confirm-wait-col">
                <div className="confirm-banner-icon-wrap">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div className="confirm-col-text">
                  <span className="confirm-col-label">Pickup Slot</span>
                  <span className="confirm-wait-val" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                    {order.pickupSlot || waitDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Details List */}
            <div className="confirm-details-section">
              <div className="confirm-details-header">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#78350f"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span className="confirm-details-title">Order Details</span>
              </div>

              <div className="confirm-items-list">
                {order.items?.map((item, idx) => {
                  const lineTotal = (item.price || 0) * (item.quantity || 1);
                  return (
                    <div key={idx} className="confirm-item-row">
                      <span className="confirm-item-name">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="confirm-item-price">₹{lineTotal}</span>
                    </div>
                  );
                })}
              </div>

              <div className="confirm-total-divider"></div>

              <div className="confirm-total-row">
                <span className="confirm-total-label">Total</span>
                <span className="confirm-total-amount">₹{order.totalAmount}</span>
              </div>
            </div>

            {/* Pickup Time Slot Row */}
            <div className="confirm-meta-row slot-highlight-row" style={{ background: "#fff7ed", padding: "10px 14px", borderRadius: "10px", border: "1px solid #fed7aa", marginBottom: "8px" }}>
              <div className="confirm-meta-label-wrap">
                <span style={{ fontSize: "1.1rem" }}>🕒</span>
                <span className="confirm-meta-text" style={{ color: "#9a3412", fontWeight: 700 }}>Pickup Time Slot</span>
              </div>
              <span className="confirm-counter-badge" style={{ background: "#ea580c", color: "#ffffff", borderColor: "#ea580c", fontWeight: 800 }}>
                {order.pickupSlot || "Next Available Window"}
              </span>
            </div>

            {/* Pickup Counter Row */}
            <div className="confirm-meta-row">
              <div className="confirm-meta-label-wrap">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="#f97316"
                  stroke="#ea580c"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3" fill="#ffffff"></circle>
                </svg>
                <span className="confirm-meta-text">Pickup Counter</span>
              </div>
              <span className="confirm-counter-badge">{counterDisplay}</span>
            </div>

            {/* Order Status Row */}
            <div className="confirm-meta-row confirm-status-row">
              <div className="confirm-meta-label-wrap">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
                  <line x1="6" y1="17" x2="18" y2="17" />
                </svg>
                <span className="confirm-meta-text">Order Status</span>
              </div>
              <span className="confirm-status-badge">
                <span className="confirm-status-dot"></span>
                <span>{statusDisplay}</span>
              </span>
            </div>

            {/* Bottom Action Buttons */}
            <div className="confirm-actions-row">
              <button
                type="button"
                className="confirm-btn-secondary"
                onClick={() => {
                  onClose();
                  if (onGoToYourOrders) onGoToYourOrders();
                }}
              >
                View My Orders
              </button>

              <button
                type="button"
                className="confirm-btn-primary"
                onClick={() => {
                  onClose();
                  if (onTrackOrder) {
                    onTrackOrder();
                  } else if (onGoToYourOrders) {
                    onGoToYourOrders();
                  }
                }}
              >
                Track Order →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
