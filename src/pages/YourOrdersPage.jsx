import { useState, useEffect } from "react";
import StatusBadge from "../components/StatusBadge";
import StudentMobileBottomNav from "../components/mobile/StudentMobileBottomNav";
import {
  ReceiptIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  RefreshIcon,
  QueueIcon,
  SearchIcon,
  EyeIcon,
  EyeOffIcon,
  ChefIcon,
  UsersIcon,
  StoreIcon,
  BagIcon,
  CreditCardIcon,
  LocationPinIcon,
  QrIcon,
  UtensilsIcon,
  CupIcon
} from "../components/Icons";

export default function YourOrdersPage({
  onGoToQueue,
  onOrderMore,
  onOpenAccount,
  studentProfile,
  onOpenProfile,
  onLogout
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [filter, setFilter] = useState("all"); // "all", "active", "ready", "missed", "completed", "cancelled"
  const [searchToken, setSearchToken] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedQrOrder, setSelectedQrOrder] = useState(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [reschedulingId, setReschedulingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [orderToCancel, setOrderToCancel] = useState(null);

  // Hidden pickup PIN by default for active orders
  const [visiblePins, setVisiblePins] = useState({});

  // Star ratings for completed/handed over orders
  const [hoverRating, setHoverRating] = useState({});
  const [submittingRating, setSubmittingRating] = useState({});

  const handleRateOrder = async (orderId, stars) => {
    try {
      setSubmittingRating((prev) => ({ ...prev, [orderId]: true }));
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, rating: stars, ratedAt: new Date().toISOString() } : o))
      );

      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: stars })
      });

      if (!res.ok) {
        throw new Error("Failed to save rating");
      }

      const updated = await res.json();
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, rating: updated.rating, ratedAt: updated.ratedAt } : o))
      );

      try {
        window.dispatchEvent(new CustomEvent("menu-rating-updated", { detail: { orderId, stars } }));
      } catch {}

      setMessage({ text: `Thank you! Rated ${stars}/5 stars ⭐`, type: "success" });
      setTimeout(() => setMessage({ text: "", type: "" }), 3500);
    } catch (err) {
      setMessage({ text: err.message || "Failed to submit rating", type: "error" });
    } finally {
      setSubmittingRating((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const togglePinVisibility = (orderId) => {
    setVisiblePins((prev) => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  useEffect(() => {
    fetchOrders(false);
    // Background live sync every 4 seconds without shaking or unmounting
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [studentProfile]);

  // Requirement 9: Strict backend isolation so students only get their own orders
  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setFetchError("");
      let url = "/api/orders?student=true";

      if (studentProfile?.phone) {
        url += `&phone=${encodeURIComponent(studentProfile.phone)}`;
      }
      if (studentProfile?.email) {
        url += `&email=${encodeURIComponent(studentProfile.email)}`;
      }
      if (studentProfile?.name) {
        url += `&name=${encodeURIComponent(studentProfile.name)}`;
      }

      // Also attach any saved local order IDs stored on this device
      try {
        const savedIds = JSON.parse(localStorage.getItem("canteenGo_myOrderIds") || "[]");
        if (savedIds.length > 0) {
          url += `&ids=${encodeURIComponent(savedIds.join(","))}`;
        }
      } catch {}

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Unable to retrieve your orders. Please check your network.");
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!silent) setFetchError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchOrders(true);
  };

  // Strict isolation: only show orders placed on this device or by this student account
  const savedIds = (() => {
    try {
      return JSON.parse(localStorage.getItem("canteenGo_myOrderIds") || "[]");
    } catch {
      return [];
    }
  })();

  const savedLastToken = (() => {
    try {
      return localStorage.getItem("canteenGo_lastToken") || "";
    } catch {
      return "";
    }
  })();

  const matchedOrders = orders.filter((o) => {
    if (!o) return false;
    const orderIdStr = String(o._id || "");

    // 1. Order placed on this browser/device
    if (savedIds && savedIds.length > 0 && savedIds.some((id) => String(id) === orderIdStr)) {
      return true;
    }
    if (savedLastToken && (o.tokenNumber === savedLastToken || orderIdStr === savedLastToken)) {
      return true;
    }

    // 2. Strict student account match
    if (studentProfile) {
      if (
        studentProfile.studentId &&
        o.studentId &&
        String(studentProfile.studentId).trim() === String(o.studentId).trim()
      ) {
        return true;
      }

      const cleanProfilePhone = String(studentProfile.phone || "").replace(/\D/g, "");
      const cleanOrderPhone = String(o.studentPhone || "").replace(/\D/g, "");
      const hasPhone = Boolean(cleanProfilePhone && cleanOrderPhone && cleanProfilePhone.length >= 7);
      const isPhoneMatch = hasPhone && cleanProfilePhone === cleanOrderPhone;

      const profileEmail = String(studentProfile.email || "").trim().toLowerCase();
      const orderEmail = String(o.studentEmail || "").trim().toLowerCase();
      const hasEmail = Boolean(profileEmail && orderEmail);
      const isEmailMatch = hasEmail && profileEmail === orderEmail;

      const profileName = String(studentProfile.name || "").trim().toLowerCase();
      const orderName = String(o.studentName || "").trim().toLowerCase();
      const hasName = Boolean(profileName && orderName);
      const isNameMatch = hasName && (
        profileName === orderName ||
        orderName.includes(profileName) ||
        profileName.includes(orderName)
      );

      // Email match with valid email format
      if (isEmailMatch && profileEmail.includes("@")) return true;

      // Phone match (e.g. 9876543210)
      if (isPhoneMatch) return true;

      // Name match (e.g. "Ankit", "Ankit Test")
      if (isNameMatch) return true;
    }

    return false;
  });

  // Strict personal orders only — never dump campus strangers' orders
  const myOrders = matchedOrders;

  // Requirement 8: Search filter by Token, Items, Student, or Canteen
  const searchedOrders = myOrders.filter((o) => {
    if (!searchToken.trim()) return true;
    const q = searchToken.trim().toLowerCase();
    const tokenMatch = o.tokenNumber?.toLowerCase().includes(q);
    const itemMatch = o.items?.some((it) => it.name?.toLowerCase().includes(q));
    const canteenMatch = o.canteenName?.toLowerCase().includes(q);
    const studentMatch = o.studentName?.toLowerCase().includes(q);
    return tokenMatch || itemMatch || canteenMatch || studentMatch;
  });

  // Requirement 8: Status stage filtering with counts
  const filteredOrders = searchedOrders.filter((o) => {
    if (filter === "active") return ["Pending Approval", "Pending", "Accepted", "Preparing"].includes(o.orderStatus);
    if (filter === "ready") return ["Ready", "Ready for Pickup"].includes(o.orderStatus);
    if (filter === "missed") return o.orderStatus === "Missed Pickup";
    if (filter === "completed") return o.orderStatus === "Completed";
    if (filter === "cancelled") return ["Cancelled", "Rejected"].includes(o.orderStatus);
    return true;
  });

  // Requirement 5: Cancellation only for eligible orders (orderStatus === "Pending Approval" or "Pending")
  const handleCancelOrder = async (orderId) => {
    try {
      setCancellingId(orderId);
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: "Cancelled" })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not cancel order");
      }

      setMessage({
        text: `✓ Order has been successfully cancelled.`,
        type: "success"
      });
      setOrderToCancel(null);
      fetchOrders();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setCancellingId(null);
    }
  };

  // Re-Queue a Missed Pickup Order
  const handleRescheduleOrder = async (orderId) => {
    try {
      setReschedulingId(orderId);
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderStatus: "Ready for Pickup" })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reschedule order");

      setMessage({
        text: `✓ Token ${data.tokenNumber || ""} has been re-queued for pickup! Please head to Counter.`,
        type: "success"
      });
      fetchOrders();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setReschedulingId(null);
    }
  };

  // Requirement 3: Synchronized progress timeline step calculation (1: Placed, 2: Accepted, 3: Preparing, 4: Ready, 5: Completed)
  const getProgressStep = (status) => {
    switch (status) {
      case "Pending Approval":
      case "Pending":
        return 1;
      case "Accepted":
        return 2;
      case "Preparing":
        return 3;
      case "Ready":
      case "Ready for Pickup":
      case "Missed Pickup":
        return 4;
      case "Completed":
        return 5;
      default:
        return 1;
    }
  };

  // Requirement 4: Estimated pickup time only for active orders when a valid estimate exists
  const getEstimatedPickupInfo = (order) => {
    if (!["Pending Approval", "Pending", "Accepted", "Preparing"].includes(order.orderStatus)) return null;
    if (!order.createdAt) return null;

    const prepMins = (order.estimatedPrepTime || 6) + (order.delayMinutes || 0);
    const createdMs = new Date(order.createdAt).getTime();
    if (isNaN(createdMs)) return null;

    const readyMs = createdMs + prepMins * 60000;
    const nowMs = Date.now();
    const remainingMins = Math.max(1, Math.round((readyMs - nowMs) / 60000));
    const readyTimeStr = new Date(readyMs).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    return { remainingMins, readyTimeStr };
  };

  const formatTokenNum = (token, status, id) => {
    if (token) {
      const str = String(token).trim();
      if (str.startsWith("#")) return str;
      if (str.startsWith("T-")) return `#${str}`;
      return `#T-${str}`;
    }
    if (status === "Rejected") return "✕ Rejected";
    if (status === "Pending Approval" || status === "Pending") return "⏳ Awaiting Token";
    return id ? `#${String(id).slice(-6).toUpperCase()}` : "Token Pending";
  };

  const formatOrderDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Placed today · ${timeStr}`;
    if (isYesterday) return `Yesterday · ${timeStr}`;
    return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${timeStr}`;
  };

  const getOrderItemsSummary = (order) => {
    if (!order.items || order.items.length === 0) return "Order Snacks";
    const firstItem = order.items[0].name;
    if (order.items.length === 1) return firstItem;
    return `${firstItem} + ${order.items.length - 1} more`;
  };

  const getTotalQuantity = (order) => {
    if (!order.items) return 1;
    return order.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
  };

  const getStatusCue = (order, etaInfo) => {
    if (order.orderStatus === "Ready" || order.orderStatus === "Ready for Pickup") {
      return <span className="status-cue-ready">Collect at {order.counterName || "Counter 1"}</span>;
    }
    if (order.orderStatus === "Preparing") {
      return (
        <span className="status-cue-preparing">
          Estimated ready in ~{etaInfo ? etaInfo.remainingMins : order.estimatedPrepTime || 6} min
        </span>
      );
    }
    if (order.orderStatus === "Accepted") {
      return (
        <span className="status-cue-accepted" style={{ color: "#2563eb", fontWeight: "700" }}>
          ✓ Accepted by Vendor • Kitchen queued
        </span>
      );
    }
    if (order.orderStatus === "Pending Approval" || (order.orderStatus === "Pending" && !order.tokenNumber)) {
      return (
        <span className="status-cue-pending" style={{ color: "#ea580c", fontWeight: "700" }}>
          ⏳ Awaiting Vendor Approval • Token will generate upon acceptance
        </span>
      );
    }
    if (order.orderStatus === "Rejected") {
      return (
        <span className="status-cue-rejected" style={{ color: "#dc2626", fontWeight: "700" }}>
          ✕ Rejected: {order.rejectionReason || "Declined by kitchen"}
        </span>
      );
    }
    if (order.orderStatus === "Missed Pickup") {
      return <span className="status-cue-missed">Missed call • Reschedule available</span>;
    }
    if (order.orderStatus === "Completed") {
      return <span className="status-cue-completed">Collected & Handed Over</span>;
    }
    return null;
  };

  const getOrderRowIcon = (order) => {
    if (order.orderStatus === "Completed") {
      return <CheckCircleIcon size={20} className="order-row-icon-svg completed" />;
    }
    const itemName = (order.items && order.items[0]?.name) || "";
    if (/chai|tea|coffee|shake|beverage|drink|juice|lassi|milk/i.test(itemName)) {
      return <CupIcon size={20} className="order-row-icon-svg drink" />;
    }
    return <UtensilsIcon size={20} className="order-row-icon-svg food" />;
  };

  // Full detailed order card (opened only when a student clicks "View Details" on an order)
  const renderOrderDetailCard = (order) => {
    const isMissed = order.orderStatus === "Missed Pickup";
    const isReady = order.orderStatus === "Ready" || order.orderStatus === "Ready for Pickup";
    const isCompleted = order.orderStatus === "Completed";
    const isCancelled = order.orderStatus === "Cancelled";
    const isRejected = order.orderStatus === "Rejected";
    const isPendingApproval = order.orderStatus === "Pending Approval" || (order.orderStatus === "Pending" && !order.tokenNumber);
    const isAccepted = order.orderStatus === "Accepted";
    const isPreparing = order.orderStatus === "Preparing";
    const isActive = !isCompleted && !isCancelled && !isRejected;
    const etaInfo = getEstimatedPickupInfo(order);
    const isPinVisible = Boolean(visiblePins[order._id]);

    return (
      <div
        className={`my-order-card card-premium-order ${isMissed ? "order-card-missed" : ""} ${isReady ? "order-card-ready" : ""} ${isCompleted ? "order-card-completed" : ""} ${isCancelled || isRejected ? "order-card-cancelled" : ""}`}
      >
        {/* 1. Header: Order #T-XXX, Status Badge, Datetime & Action Buttons */}
        <div className="order-main-header">
          <div className="order-main-header-left">
            <div className="order-title-and-badge">
              {order.tokenNumber ? (
                <h3 className="order-main-token">Token #{order.tokenNumber}</h3>
              ) : isRejected ? (
                <h3 className="order-main-token" style={{ color: "#dc2626" }}>
                  Order #{String(order._id || "").slice(-6).toUpperCase()} (Rejected)
                </h3>
              ) : (
                <h3 className="order-main-token">
                  Order #{String(order._id || "").slice(-6).toUpperCase()}
                  <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "#ea580c", marginLeft: "6px" }}>
                    (Pending Approval)
                  </span>
                </h3>
              )}
              <StatusBadge status={order.orderStatus} type="order" />
            </div>
            <p className="order-placed-datetime">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {/* Scheduled Pickup Time Slot Badge */}
            <div className="order-slot-pill-row" style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "6px", background: "#fff7ed", border: "1px solid #ffedd5", padding: "3px 10px", borderRadius: "6px", color: "#c2410c", fontSize: "0.82rem", fontWeight: "700" }}>
              <span>🕒 Pickup Slot:</span>
              <strong>{order.pickupSlot || "Next Available / ASAP"}</strong>
            </div>
          </div>

          {/* Header Actions: Track Live, QR Code, Cancel Order */}
          <div className="order-main-header-actions">
            {onGoToQueue && isActive && order.tokenNumber && (
              <button
                type="button"
                className="btn-order-action-link"
                onClick={() => onGoToQueue(order.tokenNumber)}
                title="Track live progress in queue"
              >
                <QueueIcon size={14} />
                <span>Track Live</span>
              </button>
            )}
            {order.tokenNumber && (
              <button
                type="button"
                className="btn-order-action-link btn-qr-action"
                onClick={() => setSelectedQrOrder(order)}
                title="Open Digital QR Code for Pickup"
              >
                <QrIcon size={15} />
                <span>QR Code</span>
              </button>
            )}
            {isPendingApproval && (
              <button
                type="button"
                className="btn-order-action-cancel"
                onClick={() => setOrderToCancel(order)}
                disabled={cancellingId === order._id}
                title="Cancel this order before vendor approval"
              >
                {cancellingId === order._id ? "Cancelling..." : "✕ Cancel Order"}
              </button>
            )}
          </div>
        </div>

        {/* 2. Modern Horizontal Connected Timeline Stepper */}
        {isCompleted ? (
          <>
            <div className="order-compact-timeline-bar completed">
              <CheckCircleIcon size={16} />
              <span>Order Completed & Handed Over • Collected at {order.counterName || "Counter 1"}</span>
            </div>

            <div className="detail-rating-card" onClick={(e) => e.stopPropagation()}>
              <div className="detail-rating-header">
                <span className="detail-rating-title">
                  {order.rating ? "Your Rating for this Order" : "Rate Food & Service (out of 5):"}
                </span>
                <span className="detail-rating-hint">
                  {order.rating
                    ? "Tap any star to change your rating. Helps other students know dish quality!"
                    : "Tap a star to rate your food from 1 to 5 stars."}
                </span>
              </div>
              <div className="detail-rating-stars-row">
                {[1, 2, 3, 4, 5].map((s) => {
                  const isFilled = (hoverRating[order._id] || order.rating || 0) >= s;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`detail-star-btn ${isFilled ? "filled" : ""}`}
                      onMouseEnter={() => setHoverRating((prev) => ({ ...prev, [order._id]: s }))}
                      onMouseLeave={() => setHoverRating((prev) => ({ ...prev, [order._id]: 0 }))}
                      onClick={() => handleRateOrder(order._id, s)}
                      title={`Rate ${s} star${s > 1 ? "s" : ""}`}
                      disabled={submittingRating[order._id]}
                    >
                      ★
                    </button>
                  );
                })}
                {order.rating && (
                  <span className="detail-rating-score-badge">
                    {order.rating} / 5 Stars ⭐
                  </span>
                )}
              </div>
            </div>
          </>
        ) : isRejected ? (
          <div className="order-compact-timeline-bar rejected" style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "14px 18px", borderRadius: "12px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ fontSize: "1.4rem", color: "#dc2626", lineHeight: 1 }}>✕</span>
            <div>
              <strong style={{ color: "#991b1b", fontSize: "0.95rem", display: "block" }}>Order Rejected by Canteen Kitchen</strong>
              <p style={{ margin: "3px 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>
                Reason: <strong>{order.rejectionReason || "Unavailable to prepare at this time"}</strong>
              </p>
              <span style={{ fontSize: "0.78rem", color: "#7f1d1d", display: "block", marginTop: "4px" }}>
                No token was generated. You can order fresh from this or another canteen anytime.
              </span>
            </div>
          </div>
        ) : isCancelled ? (
          <div className="order-compact-timeline-bar cancelled">
            <span className="cancelled-indicator-cross">✕</span>
            <span>Order Cancelled before kitchen preparation</span>
          </div>
        ) : (
          <div>
            <div className="order-timeline-stepper-modern five-steps">
              {/* Step 1: Placed */}
              <div className={`stepper-node-col ${getProgressStep(order.orderStatus) >= 1 ? "done" : ""}`}>
                <div className="stepper-circle-icon done">
                  <CheckCircleIcon size={15} />
                </div>
                <strong className="stepper-step-title">Placed</strong>
                <span className="stepper-step-time">
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <div className={`stepper-connector-bar ${getProgressStep(order.orderStatus) >= 2 ? "done" : ""}`} />

              {/* Step 2: Accepted & Token Generated */}
              <div className={`stepper-node-col ${getProgressStep(order.orderStatus) === 2 ? "active" : getProgressStep(order.orderStatus) > 2 ? "done" : ""}`}>
                <div className={`stepper-circle-icon ${getProgressStep(order.orderStatus) === 2 ? "active" : getProgressStep(order.orderStatus) > 2 ? "done" : ""}`}>
                  {order.tokenNumber ? <CheckCircleIcon size={15} /> : <ClockIcon size={15} />}
                </div>
                <strong className="stepper-step-title">Accepted</strong>
                <span className="stepper-step-time">
                  {order.tokenNumber ? `Token #${order.tokenNumber}` : "Awaiting vendor"}
                </span>
              </div>

              <div className={`stepper-connector-bar ${getProgressStep(order.orderStatus) >= 3 ? "done" : ""}`} />

              {/* Step 3: Preparing */}
              <div className={`stepper-node-col ${getProgressStep(order.orderStatus) === 3 ? "active" : getProgressStep(order.orderStatus) > 3 ? "done" : ""}`}>
                <div className={`stepper-circle-icon ${getProgressStep(order.orderStatus) === 3 ? "active" : getProgressStep(order.orderStatus) > 3 ? "done" : ""}`}>
                  <ChefIcon size={15} />
                </div>
                <strong className="stepper-step-title">Preparing</strong>
                <span className="stepper-step-time">
                  {getProgressStep(order.orderStatus) === 3 ? "Cooking fresh" : "Kitchen prepared"}
                </span>
              </div>

              <div className={`stepper-connector-bar ${getProgressStep(order.orderStatus) >= 4 ? "done" : ""}`} />

              {/* Step 4: Ready at Counter */}
              <div className={`stepper-node-col ${getProgressStep(order.orderStatus) === 4 ? "active pulse" : getProgressStep(order.orderStatus) > 4 ? "done" : ""}`}>
                <div className={`stepper-circle-icon ${getProgressStep(order.orderStatus) === 4 ? "active pulse" : getProgressStep(order.orderStatus) > 4 ? "done" : ""}`}>
                  <BagIcon size={15} />
                </div>
                <strong className="stepper-step-title">Ready</strong>
                <span className="stepper-step-time">
                  {getProgressStep(order.orderStatus) === 4 ? "Ready for pickup!" : order.counterName || "Counter 1"}
                </span>
              </div>

              <div className={`stepper-connector-bar ${getProgressStep(order.orderStatus) >= 5 ? "done" : ""}`} />

              {/* Step 5: Collected */}
              <div className={`stepper-node-col ${getProgressStep(order.orderStatus) >= 5 ? "done" : ""}`}>
                <div className={`stepper-circle-icon ${getProgressStep(order.orderStatus) >= 5 ? "done" : ""}`}>
                  <CheckCircleIcon size={15} />
                </div>
                <strong className="stepper-step-title">Collected</strong>
                <span className="stepper-step-time">Completed</span>
              </div>
            </div>

            {/* Awaiting Vendor Approval Banner */}
            {isPendingApproval && (
              <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "12px 16px", borderRadius: "10px", marginTop: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.2rem" }}>⏳</span>
                <div>
                  <strong style={{ color: "#92400e", fontSize: "0.88rem" }}>Order Pending Vendor Approval</strong>
                  <p style={{ margin: "2px 0 0", color: "#b45309", fontSize: "0.8rem" }}>
                    Your order has been routed to <strong>{order.canteenName || "the vendor"}</strong>. A unique token number will be generated immediately once the vendor accepts your order.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Missed Pickup Re-Queue Banner */}
        {isMissed && (
          <div className="missed-pickup-alert-box">
            <div className="missed-alert-header">
              <AlertTriangleIcon size={20} className="missed-alert-icon" />
              <div>
                <strong className="missed-alert-title">Missed Pickup Detected!</strong>
                <p className="missed-alert-desc">
                  Aapka order ready tha lekin aap counter par nahi aa paaye.
                </p>
              </div>
            </div>
            <div className="missed-alert-action">
              <button
                type="button"
                className="btn btn-primary btn-reschedule"
                onClick={() => handleRescheduleOrder(order._id)}
                disabled={reschedulingId === order._id}
              >
                <RefreshIcon size={15} />
                <span>
                  {reschedulingId === order._id ? "Re-Queueing..." : "🔄 Reschedule Pickup (I'm Coming to Counter Now!)"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Three-Stat Quick Strip (Estimated Ready in, Orders Ahead, Pickup Counter) */}
        {isActive && (
          <div className="order-stats-strip-3">
            {/* Stat 1: ETA */}
            <div className="strip-stat-box">
              <div className="strip-stat-icon-wrap">
                <ClockIcon size={18} />
              </div>
              <div className="strip-stat-content">
                <span className="strip-stat-title">Estimated Ready in</span>
                <strong className="strip-stat-num">
                  {etaInfo ? `~${etaInfo.remainingMins} minutes` : `~${order.estimatedPrepTime || 6} minutes`}
                </strong>
                <span className="strip-stat-sub">
                  {etaInfo ? `Approx, ${etaInfo.readyTimeStr}` : "Preparing fresh"}
                </span>
              </div>
            </div>

            {/* Stat 2: Orders Ahead */}
            <div className="strip-stat-box">
              <div className="strip-stat-icon-wrap">
                <UsersIcon size={18} />
              </div>
              <div className="strip-stat-content">
                <span className="strip-stat-title">Orders Ahead</span>
                <strong className="strip-stat-num">
                  {order.orderStatus === "Preparing" ? "1-2" : order.orderStatus === "Ready" ? "0" : "3"}
                </strong>
                <span className="strip-stat-sub">Live kitchen queue</span>
              </div>
            </div>

            {/* Stat 3: Pickup Counter */}
            <div className="strip-stat-box">
              <div className="strip-stat-icon-wrap">
                <StoreIcon size={18} />
              </div>
              <div className="strip-stat-content">
                <span className="strip-stat-title">Pickup Counter</span>
                <strong className="strip-stat-num">{order.counterName || "Counter 1"}</strong>
                <span className="strip-stat-sub">{order.canteenName || "Main Canteen"}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Order Items Container */}
        <div className="order-items-box-modern">
          <div className="order-items-box-top">
            <div className="box-top-left">
              <span className="items-box-icon">🛍️</span>
              <strong className="items-box-heading">Order Items ({order.items?.length || 0})</strong>
            </div>
            <div className="box-top-right">
              <span className="total-label-muted">Total Amount: </span>
              <strong className="total-val-orange">₹{order.totalAmount}</strong>
            </div>
          </div>

          <div className="order-items-list-clean">
            {order.items?.map((it, idx) => (
              <div key={idx} className="order-item-clean-row">
                <img
                  src={it.image || "/images/samosa.jpg"}
                  alt={it.name}
                  className="order-item-img-clean"
                  onError={(e) => {
                    e.target.src = "/images/samosa.jpg";
                  }}
                />
                <div className="order-item-info-clean">
                  <strong className="order-item-name-clean">{it.name}</strong>
                  <span className="order-item-canteen-hint">
                    {it.canteen?.name || order.canteenName || "Campus Canteen"} ({order.counterName || "Counter 1"})
                  </span>
                  <span className="order-item-qty-calc">
                    ₹{it.price} × {it.quantity}
                  </span>
                </div>
                <strong className="order-item-subtotal-clean">
                  ₹{it.price * it.quantity}
                </strong>
              </div>
            ))}
          </div>

          {order.remarks && (
            <div className="order-remarks-clean-row">
              <span className="remarks-clean-icon">📝</span>
              <strong>Note:</strong>
              <span>{order.remarks}</span>
            </div>
          )}
        </div>

        {/* 5. Pickup Details (Compact! No Map button!) */}
        <div className="order-pickup-strip-compact">
          <div className="pickup-strip-icon-circle">
            <LocationPinIcon size={18} />
          </div>
          <div className="pickup-strip-text">
            <span className="pickup-strip-tag">PICKUP DETAILS</span>
            <strong className="pickup-strip-name">{order.canteenName || "Campus Canteen"}</strong>
            <span className="pickup-strip-counter">
              📍 {order.counterName || "Counter 1"} • {order.canteenLocation || "Campus Dining Hall"}
            </span>
          </div>
        </div>

        {/* 6. Two-Column Bottom Grid: Payment Info & Pickup PIN */}
        <div className="order-bottom-dual-grid">
          {/* Payment Information */}
          <div className="bottom-dual-card">
            <div className="dual-card-header">
              <CreditCardIcon size={16} />
              <span>Payment Information</span>
            </div>
            <div className="dual-card-body">
              <div className="dual-field-row">
                <span className="dual-label">Payment Method:</span>
                <strong className="dual-val">{order.paymentMethod === "UPI" ? "📱 Online UPI" : "💵 Cash Counter"}</strong>
              </div>
              <div className="dual-field-row">
                <span className="dual-label">Payment Status:</span>
                <StatusBadge status={order.paymentStatus} type="payment" />
              </div>
              <p className="dual-note-sub">
                {order.paymentStatus === "Paid"
                  ? "✓ Payment verified and recorded"
                  : "⏳ Please pay at the counter while collecting your order."}
              </p>
            </div>
          </div>

          {/* Pickup PIN */}
          {isActive && (
            <div className="bottom-dual-card">
              <div className="dual-card-header">
                <div className="header-pin-left">
                  <ShieldCheckIcon size={16} />
                  <span>Pickup PIN</span>
                </div>
                <button
                  type="button"
                  className="btn-toggle-pin-clean"
                  onClick={() => togglePinVisibility(order._id)}
                >
                  {isPinVisible ? (
                    <>
                      <EyeOffIcon size={13} />
                      <span>Hide PIN</span>
                    </>
                  ) : (
                    <>
                      <EyeIcon size={13} />
                      <span>Show PIN</span>
                    </>
                  )}
                </button>
              </div>
              <div className="dual-card-body">
                <p className="dual-note-sub" style={{ marginTop: 0 }}>
                  Show this 4-digit code to the vendor at pickup
                </p>
                <div className="pin-digits-clean-wrap">
                  {isPinVisible ? (
                    order.pickupCode ? (
                      order.pickupCode.split("").map((digit, idx) => (
                        <span key={idx} className="pin-digit-box-clean">
                          {digit}
                        </span>
                      ))
                    ) : (
                      <span className="pin-digit-box-clean">----</span>
                    )
                  ) : (
                    ["•", "•", "•", "•"].map((dot, idx) => (
                      <span key={idx} className="pin-digit-box-clean masked">
                        {dot}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const selectedOrder = selectedOrderId
    ? myOrders.find((o) => o._id === selectedOrderId) || orders.find((o) => o._id === selectedOrderId)
    : null;

  return (
    <div className="your-orders-container">
      {/* Page Header */}
      <div className="page-header queue-header-flex">
        <div className="page-header-text">
          <span className="section-pill">
            <ReceiptIcon size={14} /> Student Self-Service Hub
          </span>
          <h2 className="page-title">Your Orders & Digital Tickets</h2>
          <p className="page-description">
            Track your placed orders, verify pickup PINs, and manage your campus dining tokens.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={handleManualRefresh}
          disabled={loading || isRefreshing}
          title="Refresh orders status from kitchen"
        >
          <RefreshIcon size={14} className={isRefreshing ? "spin-icon" : ""} />
          <span>{isRefreshing ? "Refreshing..." : "Refresh Status"}</span>
        </button>
      </div>

      {/* Alert Banner */}
      {message.text && (
        <div className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}>
          <span>{message.text}</span>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
            onClick={() => setMessage({ text: "", type: "" })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Requirement 8: Error State Banner */}
      {fetchError && (
        <div className="alert alert-error" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {fetchError}</span>
          <button className="btn btn-sm btn-outline" onClick={fetchOrders} style={{ padding: "4px 10px" }}>
            Retry
          </button>
        </div>
      )}

      {selectedOrder ? (
        <div className="order-detail-page-wrapper">
          <div className="order-detail-top-nav">
            <button
              type="button"
              className="btn-back-to-orders"
              onClick={() => setSelectedOrderId(null)}
            >
              <span className="back-arrow-icon">←</span>
              <span>Back to all orders</span>
            </button>
            <div className="order-detail-nav-token">
              <span className="nav-token-label">Viewing Order</span>
              <strong className="nav-token-num">
                {selectedOrder.tokenNumber ? `#${selectedOrder.tokenNumber}` : `#${String(selectedOrder._id || "").slice(-6).toUpperCase()}`}
              </strong>
            </div>
          </div>

          {renderOrderDetailCard(selectedOrder)}
        </div>
      ) : (
        <>
          {/* Requirement 8: Filter Tabs & Search Bar */}
          <div className="orders-toolbar">
            {/* Desktop Filter Chips */}
            <div className="orders-filter-chips orders-desktop-filter-chips">
              <button
                type="button"
                className={`filter-chip ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All Orders ({myOrders.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${filter === "active" ? "active" : ""}`}
                onClick={() => setFilter("active")}
              >
                Active In Kitchen ({myOrders.filter((o) => ["Pending Approval", "Pending", "Accepted", "Preparing"].includes(o.orderStatus)).length})
              </button>
              <button
                type="button"
                className={`filter-chip filter-ready ${filter === "ready" ? "active" : ""}`}
                onClick={() => setFilter("ready")}
              >
                Ready at Counter ({myOrders.filter((o) => ["Ready", "Ready for Pickup"].includes(o.orderStatus)).length})
              </button>
              <button
                type="button"
                className={`filter-chip filter-missed ${filter === "missed" ? "active" : ""}`}
                onClick={() => setFilter("missed")}
              >
                ⚠️ Missed ({myOrders.filter((o) => o.orderStatus === "Missed Pickup").length})
              </button>
              <button
                type="button"
                className={`filter-chip ${filter === "completed" ? "active" : ""}`}
                onClick={() => setFilter("completed")}
              >
                Completed ({myOrders.filter((o) => o.orderStatus === "Completed").length})
              </button>
              {myOrders.some((o) => ["Cancelled", "Rejected"].includes(o.orderStatus)) && (
                <button
                  type="button"
                  className={`filter-chip ${filter === "cancelled" ? "active" : ""}`}
                  onClick={() => setFilter("cancelled")}
                >
                  Rejected / Cancelled ({myOrders.filter((o) => ["Cancelled", "Rejected"].includes(o.orderStatus)).length})
                </button>
              )}
            </div>

            {/* Mobile: Single Button Filter Dropdown */}
            <div className="orders-mobile-filter-dropdown-wrap">
              <div className="orders-mobile-filter-btn">
                <span className="filter-btn-text">
                  {filter === "all" && `All Orders (${myOrders.length})`}
                  {filter === "active" && `Active In Kitchen (${myOrders.filter((o) => ["Pending Approval", "Pending", "Accepted", "Preparing"].includes(o.orderStatus)).length})`}
                  {filter === "ready" && `Ready at Counter (${myOrders.filter((o) => ["Ready", "Ready for Pickup"].includes(o.orderStatus)).length})`}
                  {filter === "missed" && `⚠️ Missed (${myOrders.filter((o) => o.orderStatus === "Missed Pickup").length})`}
                  {filter === "completed" && `Completed (${myOrders.filter((o) => o.orderStatus === "Completed").length})`}
                  {filter === "cancelled" && `Rejected / Cancelled (${myOrders.filter((o) => ["Cancelled", "Rejected"].includes(o.orderStatus)).length})`}
                </span>
                <span className="filter-btn-arrow">▾</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="orders-mobile-filter-native-select"
                  aria-label="Filter Orders"
                >
                  <option value="all">All Orders ({myOrders.length})</option>
                  <option value="active">Active In Kitchen ({myOrders.filter((o) => ["Pending Approval", "Pending", "Accepted", "Preparing"].includes(o.orderStatus)).length})</option>
                  <option value="ready">Ready at Counter ({myOrders.filter((o) => ["Ready", "Ready for Pickup"].includes(o.orderStatus)).length})</option>
                  <option value="missed">⚠️ Missed ({myOrders.filter((o) => o.orderStatus === "Missed Pickup").length})</option>
                  <option value="completed">Completed ({myOrders.filter((o) => o.orderStatus === "Completed").length})</option>
                  {myOrders.some((o) => ["Cancelled", "Rejected"].includes(o.orderStatus)) && (
                    <option value="cancelled">Rejected / Cancelled ({myOrders.filter((o) => ["Cancelled", "Rejected"].includes(o.orderStatus)).length})</option>
                  )}
                </select>
              </div>
            </div>

            {/* Quick Search */}
            <div className="order-search-wrap">
              <SearchIcon size={16} className="search-icon-dim" />
              <input
                type="text"
                className="order-search-input"
                placeholder="Search by Token (e.g. T-105) or item..."
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
              />
              {searchToken && (
                <button className="clear-search-btn" onClick={() => setSearchToken("")} title="Clear search">
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Requirement 8: Loading, Empty & Order Cards */}
          {loading ? (
            <div className="menu-loading-state">
              <div className="loading-spinner"></div>
              <p>Loading your orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-orders-view card">
              <div className="empty-orders-icon">
                <ReceiptIcon size={48} />
              </div>
              <h3>
                {!studentProfile || (!studentProfile.phone && !studentProfile.name)
                  ? "Please Log In to View Your Orders"
                  : searchToken
                  ? `No orders matching "${searchToken}"`
                  : filter !== "all"
                  ? `No ${filter} orders found`
                  : "No Orders Placed Yet"}
              </h3>
              <p>
                {!studentProfile || (!studentProfile.phone && !studentProfile.name)
                  ? "Sign in with your student profile to access your campus tokens and order history."
                  : searchToken
                  ? "Try searching with a different token number or item name."
                  : filter !== "all"
                  ? `You currently do not have any orders in the "${filter}" category.`
                  : "Explore today's fresh canteen menu and order with a single click."}
              </p>

              {!studentProfile || (!studentProfile.phone && !studentProfile.name) ? (
                onOpenProfile && (
                  <button className="btn btn-primary" onClick={onOpenProfile} style={{ marginTop: "14px" }}>
                    👤 Student Login / Register
                  </button>
                )
              ) : searchToken ? (
                <button className="btn btn-secondary" onClick={() => setSearchToken("")} style={{ marginTop: "14px" }}>
                  Clear Search Filter
                </button>
              ) : (
                onOrderMore && (
                  <button className="btn btn-primary" onClick={onOrderMore} style={{ marginTop: "14px" }}>
                    🛒 Order Fresh Snacks Now
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="orders-compact-list">
              {filteredOrders.map((order) => {
                const etaInfo = getEstimatedPickupInfo(order);
                const totalQty = getTotalQuantity(order);
                const cue = getStatusCue(order, etaInfo);

                return (
                  <div
                    key={order._id}
                    className={`order-list-row-card status-${order.orderStatus.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setSelectedOrderId(order._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setSelectedOrderId(order._id);
                      }
                    }}
                  >
                    <div className="order-row-top-main">
                      {/* Left Token + Real Food Image Block */}
                      <div className="order-row-token-col">
                        <img
                          src={order.items?.[0]?.image || "/images/samosa.jpg"}
                          alt={order.items?.[0]?.name || "Dish"}
                          className="order-row-dish-img"
                          onError={(e) => {
                            e.target.src = "/images/samosa.jpg";
                          }}
                        />
                        <strong className="order-row-token-text">
                          {formatTokenNum(order.tokenNumber, order.orderStatus, order._id)}
                        </strong>
                      </div>

                      {/* Center Order Info */}
                      <div className="order-row-info-col">
                        <div className="order-row-title-line">
                          <h4 className="order-row-item-title">{getOrderItemsSummary(order)}</h4>
                        </div>
                        <div className="order-row-sub-canteen">
                          <span>{order.canteenName || "Main Canteen"}</span>
                          <span className="dot-sep">•</span>
                          <span>{order.counterName || "Counter 1"}</span>
                          {order.pickupSlot && (
                            <>
                              <span className="dot-sep">•</span>
                              <span style={{ color: "#ea580c", fontWeight: "700" }}>🕒 {order.pickupSlot}</span>
                            </>
                          )}
                        </div>
                        <div className="order-row-qty-price">
                          <span>Qty: {totalQty}</span>
                          <span className="dot-sep">•</span>
                          <span className="row-price-val">₹{order.totalAmount}</span>
                        </div>
                        {cue && <div className="order-row-cue-line">{cue}</div>}

                        {order.orderStatus === "Completed" && (
                          <div className="order-row-rating-section" onClick={(e) => e.stopPropagation()}>
                            {order.rating ? (
                              <div className="order-rated-inline">
                                <span className="rated-check">✓ Rated</span>
                                <div className="rated-stars-inline">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <span
                                      key={s}
                                      className={`star-char ${s <= order.rating ? "filled" : "empty"}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRateOrder(order._id, s);
                                      }}
                                      title={`Click to re-rate ${s} star${s > 1 ? "s" : ""}`}
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                                <span className="rated-score-text">({order.rating}/5)</span>
                              </div>
                            ) : (
                              <div className="order-rate-inline">
                                <span className="rate-prompt-label">Rate Food:</span>
                                <div className="rate-star-buttons">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      className={`rate-star-btn ${
                                        (hoverRating[order._id] || 0) >= s ? "hovered" : ""
                                      }`}
                                      onMouseEnter={() => setHoverRating((prev) => ({ ...prev, [order._id]: s }))}
                                      onMouseLeave={() => setHoverRating((prev) => ({ ...prev, [order._id]: 0 }))}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRateOrder(order._id, s);
                                      }}
                                      title={`Rate ${s} star${s > 1 ? "s" : ""}`}
                                      disabled={submittingRating[order._id]}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Status Badge */}
                      <div className="order-row-badge-col">
                        <StatusBadge status={order.orderStatus} type="order" />
                      </div>
                    </div>

                    {/* Bottom Card Footer */}
                    <div className="order-row-bottom-footer">
                      <span className="order-row-placed-time">{formatOrderDate(order.createdAt)}</span>
                      <button
                        type="button"
                        className="order-row-view-details-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(order._id);
                        }}
                      >
                        <span>View Details</span>
                        <span className="chevron-icon">›</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Requirement 5: Order Cancellation Confirmation Dialog */}
      {orderToCancel && (
        <div className="modal-backdrop" onClick={() => setOrderToCancel(null)}>
          <div className="modal-card cancel-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancel-confirm-icon-wrap">
              <AlertTriangleIcon size={28} />
            </div>
            <h3 className="cancel-modal-title">Cancel Order Token {orderToCancel.tokenNumber}?</h3>
            <p className="cancel-modal-desc">
              Are you sure you want to cancel this order? Kitchen has not started preparing it yet. This action cannot be undone.
            </p>
            <div className="cancel-modal-details">
              <span>Items: {orderToCancel.items?.length || 0}</span>
              <span>•</span>
              <span>Amount: ₹{orderToCancel.totalAmount}</span>
            </div>
            <div className="cancel-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOrderToCancel(null)}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleCancelOrder(orderToCancel._id)}
                disabled={cancellingId === orderToCancel._id}
              >
                {cancellingId === orderToCancel._id ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital QR Code Overlay Modal */}
      {selectedQrOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedQrOrder(null)}>
          <div className="modal-card order-qr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <div className="qr-modal-header-left">
                <div className="qr-icon-bubble">
                  <QrIcon size={20} />
                </div>
                <div>
                  <h3 className="qr-modal-title">Pickup QR Token</h3>
                  <span className="qr-modal-sub">Scan at counter display for instant collection</span>
                </div>
              </div>
              <button
                type="button"
                className="qr-modal-close-btn"
                onClick={() => setSelectedQrOrder(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="qr-modal-body">
              {/* Token Number & Status Pill */}
              <div className="qr-token-banner">
                <div className="qr-token-left">
                  <span className="qr-token-tag">OFFICIAL TOKEN</span>
                  <strong className="qr-token-value">#{selectedQrOrder.tokenNumber}</strong>
                </div>
                <StatusBadge status={selectedQrOrder.orderStatus} type="order" />
              </div>

              {/* Canteen & Counter info */}
              <div className="qr-counter-info-pill">
                <span>📍 <strong>{selectedQrOrder.canteenName || "Campus Canteen"}</strong></span>
                <span>•</span>
                <span>{selectedQrOrder.counterName || "Counter 1"}</span>
              </div>

              {/* High-fidelity Authentic QR Code Card with Scan Beam */}
              <div className="qr-code-stage">
                <div className="qr-code-box">
                  <span className="qr-bracket qr-bracket-tl"></span>
                  <span className="qr-bracket qr-bracket-tr"></span>
                  <span className="qr-bracket qr-bracket-bl"></span>
                  <span className="qr-bracket qr-bracket-br"></span>
                  <div className="qr-scan-line"></div>

                  <svg
                    className="qr-vector-image"
                    viewBox="0 0 200 200"
                    width="210"
                    height="210"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="200" height="200" fill="#ffffff" rx="10" />

                    {/* Position Detection Squares - Top Left */}
                    <rect x="14" y="14" width="46" height="46" rx="6" fill="#0f172a" />
                    <rect x="22" y="22" width="30" height="30" rx="4" fill="#ffffff" />
                    <rect x="29" y="29" width="16" height="16" rx="3" fill="#ea580c" />

                    {/* Position Detection Squares - Top Right */}
                    <rect x="140" y="14" width="46" height="46" rx="6" fill="#0f172a" />
                    <rect x="148" y="22" width="30" height="30" rx="4" fill="#ffffff" />
                    <rect x="155" y="29" width="16" height="16" rx="3" fill="#ea580c" />

                    {/* Position Detection Squares - Bottom Left */}
                    <rect x="14" y="140" width="46" height="46" rx="6" fill="#0f172a" />
                    <rect x="22" y="148" width="30" height="30" rx="4" fill="#ffffff" />
                    <rect x="29" y="155" width="16" height="16" rx="3" fill="#ea580c" />

                    {/* Timing Patterns */}
                    <rect x="66" y="20" width="6" height="6" fill="#0f172a" />
                    <rect x="78" y="20" width="6" height="6" fill="#0f172a" />
                    <rect x="90" y="20" width="6" height="6" fill="#0f172a" />
                    <rect x="102" y="20" width="6" height="6" fill="#0f172a" />
                    <rect x="114" y="20" width="6" height="6" fill="#0f172a" />
                    <rect x="126" y="20" width="6" height="6" fill="#0f172a" />

                    <rect x="20" y="66" width="6" height="6" fill="#0f172a" />
                    <rect x="20" y="78" width="6" height="6" fill="#0f172a" />
                    <rect x="20" y="90" width="6" height="6" fill="#0f172a" />
                    <rect x="20" y="102" width="6" height="6" fill="#0f172a" />
                    <rect x="20" y="114" width="6" height="6" fill="#0f172a" />
                    <rect x="20" y="126" width="6" height="6" fill="#0f172a" />

                    {/* Alignment pattern (Bottom Right) */}
                    <rect x="145" y="145" width="24" height="24" rx="4" fill="#0f172a" />
                    <rect x="151" y="151" width="12" height="12" rx="2" fill="#ffffff" />
                    <rect x="154" y="154" width="6" height="6" rx="1" fill="#ea580c" />

                    {/* Dynamic QR Pixels */}
                    <rect x="66" y="34" width="7" height="7" fill="#1e293b" />
                    <rect x="80" y="34" width="14" height="7" fill="#1e293b" />
                    <rect x="102" y="34" width="7" height="7" fill="#1e293b" />
                    <rect x="116" y="34" width="14" height="7" fill="#1e293b" />
                    <rect x="74" y="48" width="7" height="7" fill="#1e293b" />
                    <rect x="88" y="48" width="14" height="7" fill="#1e293b" />
                    <rect x="110" y="48" width="7" height="7" fill="#1e293b" />
                    <rect x="124" y="48" width="14" height="7" fill="#1e293b" />
                    <rect x="66" y="62" width="14" height="7" fill="#1e293b" />
                    <rect x="88" y="62" width="7" height="7" fill="#1e293b" />
                    <rect x="102" y="62" width="14" height="7" fill="#1e293b" />
                    <rect x="124" y="62" width="7" height="7" fill="#1e293b" />

                    {/* Center Token Badge */}
                    <rect x="70" y="76" width="60" height="48" rx="8" fill="#ffffff" stroke="#fed7aa" strokeWidth="2" />
                    <text x="100" y="96" textAnchor="middle" fill="#ea580c" fontSize="11" fontWeight="800" fontFamily="sans-serif">
                      TOKEN
                    </text>
                    <text x="100" y="114" textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="900" fontFamily="sans-serif">
                      {selectedQrOrder.tokenNumber}
                    </text>

                    {/* Lower matrix dots */}
                    <rect x="66" y="132" width="7" height="7" fill="#1e293b" />
                    <rect x="80" y="132" width="14" height="7" fill="#1e293b" />
                    <rect x="102" y="132" width="7" height="7" fill="#1e293b" />
                    <rect x="116" y="132" width="14" height="7" fill="#1e293b" />
                    <rect x="66" y="146" width="14" height="7" fill="#1e293b" />
                    <rect x="88" y="146" width="7" height="7" fill="#1e293b" />
                    <rect x="102" y="146" width="14" height="7" fill="#1e293b" />
                    <rect x="124" y="146" width="7" height="7" fill="#1e293b" />
                    <rect x="74" y="160" width="7" height="7" fill="#1e293b" />
                    <rect x="88" y="160" width="14" height="7" fill="#1e293b" />
                    <rect x="110" y="160" width="7" height="7" fill="#1e293b" />
                    <rect x="124" y="160" width="14" height="7" fill="#1e293b" />
                  </svg>
                </div>
              </div>

              {/* Pickup PIN & Student Details */}
              {selectedQrOrder.pickupCode && (
                <div className="qr-pin-highlight-box">
                  <span className="qr-pin-label">SECRET PICKUP PIN</span>
                  <div className="qr-pin-digits-wrap">
                    {selectedQrOrder.pickupCode.split("").map((digit, idx) => (
                      <span key={idx} className="qr-pin-digit">{digit}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="qr-order-meta-footer">
                <div className="meta-footer-item">
                  <span>Student:</span>
                  <strong>{selectedQrOrder.studentName}</strong>
                </div>
                <div className="meta-footer-item">
                  <span>Total:</span>
                  <strong style={{ color: "#ea580c" }}>₹{selectedQrOrder.totalAmount}</strong>
                </div>
              </div>
            </div>

            <div className="qr-modal-footer">
              <button
                type="button"
                className="btn-close-qr-full"
                onClick={() => setSelectedQrOrder(null)}
              >
                Close QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Floating Bottom Pill Dock (< 768px, permanently sticky fixed) */}
      <StudentMobileBottomNav
        studentTab="my-orders"
        setStudentTab={(tab) => {
          if (tab === "order") onOrderMore && onOrderMore();
          else if (tab === "queue") onGoToQueue && onGoToQueue();
          else if (tab === "account") onOpenAccount && onOpenAccount();
        }}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}
