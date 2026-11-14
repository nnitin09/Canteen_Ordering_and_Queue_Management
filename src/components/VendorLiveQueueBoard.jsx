"use client";

import { useState, useEffect, useRef } from "react";
import {
  BellIcon,
  ChefIcon,
  ClockIcon,
  RefreshIcon,
  VolumeIcon,
  ShieldCheckIcon,
  CheckCircleIcon
} from "./Icons";

export default function VendorLiveQueueBoard({
  orders = [],
  selectedCanteen,
  onVendorAction,
  onRefresh,
  loading = false
}) {
  const [currentTime, setCurrentTime] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [flashingTokenId, setFlashingTokenId] = useState(null);
  const [callNotice, setCallNotice] = useState("");

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fullscreen event listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Announce Token: sends callOut trigger to student's notification bell!
  const handleCallToken = async (order) => {
    setFlashingTokenId(order._id);
    setTimeout(() => setFlashingTokenId(null), 3000);
    setCallNotice(`📢 Call Out notification sent to student for Token ${order.tokenNumber}!`);
    setTimeout(() => setCallNotice(""), 3500);

    try {
      await fetch(`/api/orders/${order._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callOut: true })
      });
      if (onRefresh) onRefresh();
    } catch {}
  };

  // Filter orders by canteen & stages
  const canteenOrders = orders.filter((o) => {
    if (!selectedCanteen?.id) return true;
    return o.canteenId === selectedCanteen.id || !o.canteenId;
  });

  const readyOrders = canteenOrders.filter((o) => (o.orderStatus === "Ready" || o.orderStatus === "Ready for Pickup") && Boolean(o.tokenNumber));
  const preparingOrders = canteenOrders.filter((o) => o.orderStatus === "Preparing" && Boolean(o.tokenNumber));
  const pendingOrders = canteenOrders.filter((o) => (o.orderStatus === "Pending" || o.orderStatus === "Accepted") && Boolean(o.tokenNumber));
  const completedOrders = canteenOrders
    .filter((o) => o.orderStatus === "Completed" && Boolean(o.tokenNumber))
    .slice(0, 12);

  const getTimeElapsed = (dateString) => {
    if (!dateString) return "";
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  return (
    <div className="vendor-kiosk-wrapper">
      {/* High-Tech TV Kiosk Board Header */}
      <div className="vendor-kiosk-board-header">
        <div className="kiosk-header-left">
          <div className="kiosk-badge-row">
            <span className="kiosk-live-pill">
              <span className="terminal-live-dot" style={{ background: "#ffffff", boxShadow: "none" }}></span>
              LIVE COUNTER BOARD
            </span>
            <span className="kiosk-counter-pill">
              {selectedCanteen?.counter || "Counter 1"}
            </span>
          </div>
          <h2 className="kiosk-title">
            {selectedCanteen?.name || "Campus Food Court"}
          </h2>
        </div>

        {/* Live Clock & Controls */}
        <div className="kiosk-controls-right">
          <div className="kiosk-time-display">
            <ClockIcon size={16} />
            <span>{currentTime || "12:00:00 PM"}</span>
          </div>

          <button
            type="button"
            className={`btn-kiosk-toggle ${isFullscreen ? "active" : ""}`}
            onClick={toggleFullscreen}
            title="Toggle TV / Fullscreen Display Mode"
          >
            <span>{isFullscreen ? "✕ Exit Fullscreen" : "⛶ TV Fullscreen"}</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              className="btn-kiosk-toggle"
              onClick={onRefresh}
              disabled={loading}
              title="Sync latest queue status"
            >
              <RefreshIcon size={14} className={loading ? "spin-refresh" : ""} />
              <span>{loading ? "Syncing..." : "Sync"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Call-Out Flash Toast Notice */}
      {callNotice && (
        <div className="alert alert-success" style={{ margin: 0, fontWeight: "700" }}>
          <span>{callNotice}</span>
        </div>
      )}

      {/* 3 Prominent Kiosk Swimlanes Grid */}
      <div className="vendor-kiosk-lanes-grid">
        {/* Lane 1: READY FOR PICKUP (Glowing Green) */}
        <div className="kiosk-lane lane-ready">
          <div className="kiosk-lane-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <BellIcon size={18} />
              <span>Ready for Pickup</span>
            </div>
            <span className="kiosk-lane-badge">{readyOrders.length}</span>
          </div>

          <div className="kiosk-lane-body">
            {readyOrders.length === 0 ? (
              <div className="empty-column-state">
                <span style={{ fontSize: "2rem", display: "block", marginBottom: "6px" }}>🔔</span>
                <p style={{ margin: 0, fontWeight: "600" }}>No orders waiting for pickup</p>
                <small>Food ready in kitchen will arrive here</small>
              </div>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order._id}
                  className={`kiosk-card ready-card ${flashingTokenId === order._id ? "flashing" : ""}`}
                >
                  <div className="kiosk-card-top">
                    <div>
                      <div className="kiosk-token-huge">{order.tokenNumber}</div>
                      <span className="kiosk-card-time">
                        Ready {getTimeElapsed(order.updatedAt || order.createdAt)}
                      </span>
                    </div>
                    <span className="pickup-callout">
                      <span className="pickup-pulse-dot"></span>
                      <span>COUNTER 1</span>
                    </span>
                  </div>

                  <div className="kiosk-student-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>👤 {order.studentName}</span>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: "800",
                        padding: "2px 7px",
                        borderRadius: "6px",
                        color: order.paymentStatus === "Paid" ? "#16a34a" : "#dc2626",
                        background: order.paymentStatus === "Paid" ? "#dcfce7" : "#fee2e2"
                      }}
                    >
                      {order.paymentStatus === "Paid" ? "✓ Paid" : `🔴 Unpaid (₹${order.totalAmount})`}
                    </span>
                  </div>

                  <div className="kiosk-items-box">
                    {order.items?.map((it, idx) => (
                      <div key={idx} className="kiosk-item-row">
                        <span>{it.name}</span>
                        <strong>× {it.quantity}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Kiosk Action Buttons */}
                  <div className="kiosk-action-btn-row">
                    <button
                      type="button"
                      className="btn-kiosk-call"
                      onClick={() => handleCallToken(order)}
                      title="Announce token via sound and speaker voice"
                    >
                      📢 Call Out
                    </button>
                    {onVendorAction && (
                      <button
                        type="button"
                        className="btn-kiosk-advance"
                        style={{
                          background: order.paymentStatus !== "Paid" ? "#dc2626" : "#0284c7"
                        }}
                        onClick={() => onVendorAction(order._id, "Completed")}
                        title={
                          order.paymentStatus !== "Paid"
                            ? `Payment Pending (₹${order.totalAmount}). Click to collect payment and verify handover.`
                            : "Mark order collected and handed over"
                        }
                      >
                        <ShieldCheckIcon size={14} />
                        <span>
                          {order.paymentStatus !== "Paid"
                            ? `Collect ₹${order.totalAmount}`
                            : "Handover"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lane 2: NOW PREPARING (Cooking on Stove) */}
        <div className="kiosk-lane lane-preparing">
          <div className="kiosk-lane-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ChefIcon size={18} />
              <span>Now Cooking in Kitchen</span>
            </div>
            <span className="kiosk-lane-badge">{preparingOrders.length}</span>
          </div>

          <div className="kiosk-lane-body">
            {preparingOrders.length === 0 ? (
              <div className="empty-column-state">
                <span style={{ fontSize: "2rem", display: "block", marginBottom: "6px" }}>👨‍🍳</span>
                <p style={{ margin: 0, fontWeight: "600" }}>No orders currently on stove</p>
                <small>Accept incoming orders to start cooking</small>
              </div>
            ) : (
              preparingOrders.map((order) => (
                <div key={order._id} className="kiosk-card preparing-card">
                  <div className="kiosk-card-top">
                    <div>
                      <div className="kiosk-token-huge">{order.tokenNumber}</div>
                      <span className="kiosk-card-time">
                        Started {getTimeElapsed(order.updatedAt || order.createdAt)}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#0284c7", background: "#e0f2fe", padding: "2px 8px", borderRadius: "6px" }}>
                      Cooking 🔥
                    </span>
                  </div>

                  <div className="kiosk-student-row">
                    👤 {order.studentName}
                  </div>

                  <div className="kiosk-items-box">
                    {order.items?.map((it, idx) => (
                      <div key={idx} className="kiosk-item-row">
                        <span>{it.name}</span>
                        <strong>× {it.quantity}</strong>
                      </div>
                    ))}
                  </div>

                  {order.remarks && (
                    <div style={{ fontSize: "0.76rem", color: "#b45309", background: "#fef3c7", padding: "3px 8px", borderRadius: "6px", border: "1px dashed #f59e0b" }}>
                      📝 <strong>Note:</strong> {order.remarks}
                    </div>
                  )}

                  {onVendorAction && (
                    <div className="kiosk-action-btn-row">
                      <button
                        type="button"
                        className="btn-kiosk-call"
                        style={{ background: "#0284c7" }}
                        onClick={() => onVendorAction(order._id, "Ready")}
                      >
                        <BellIcon size={14} /> Mark Ready for Counter
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lane 3: INCOMING & NEXT IN LINE */}
        <div className="kiosk-lane lane-pending">
          <div className="kiosk-lane-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ClockIcon size={18} />
              <span>Next in Line (Waiting)</span>
            </div>
            <span className="kiosk-lane-badge">{pendingOrders.length}</span>
          </div>

          <div className="kiosk-lane-body">
            {pendingOrders.length === 0 ? (
              <div className="empty-column-state">
                <span style={{ fontSize: "2rem", display: "block", marginBottom: "6px" }}>⏳</span>
                <p style={{ margin: 0, fontWeight: "600" }}>Kitchen queue is clear!</p>
                <small>New orders will appear here</small>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div key={order._id} className="kiosk-card pending-card">
                  <div className="kiosk-card-top">
                    <div>
                      <div className="kiosk-token-huge">{order.tokenNumber}</div>
                      <span className="kiosk-card-time">
                        Placed {getTimeElapsed(order.createdAt)}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#d97706", background: "#fef3c7", padding: "2px 8px", borderRadius: "6px" }}>
                      In Line ⏳
                    </span>
                  </div>

                  <div className="kiosk-student-row">
                    👤 {order.studentName}
                  </div>

                  <div className="kiosk-items-box">
                    {order.items?.map((it, idx) => (
                      <div key={idx} className="kiosk-item-row">
                        <span>{it.name}</span>
                        <strong>× {it.quantity}</strong>
                      </div>
                    ))}
                  </div>

                  {onVendorAction && (
                    <div className="kiosk-action-btn-row">
                      <button
                        type="button"
                        className="btn-kiosk-start"
                        onClick={() => onVendorAction(order._id, "Preparing")}
                      >
                        <ChefIcon size={14} /> Start Cooking Now
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Pickups Ticker Strip */}
      <div className="kiosk-pickups-strip">
        <span className="pickups-strip-label">
          <CheckCircleIcon size={16} /> Recent Pickups:
        </span>
        <div className="pickups-chips-container">
          {completedOrders.length === 0 ? (
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>No pickups completed yet</span>
          ) : (
            completedOrders.map((co) => (
              <div key={co._id} className="pickup-token-chip">
                <span>{co.tokenNumber}</span>
                <span className="chip-time">
                  {new Date(co.updatedAt || co.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

