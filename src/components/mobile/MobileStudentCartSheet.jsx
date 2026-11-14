"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import TimeSlotPicker from "../TimeSlotPicker";
import {
  CartIcon,
  PlusIcon,
  MinusIcon,
  CashIcon,
  QrIcon,
  ClockIcon,
  CheckCircleIcon,
  ReceiptIcon,
  UserIcon,
  PhoneIcon,
  EditIcon
} from "../Icons";
import { getItemEstimateTime, isCanteenOpenNow } from "@/data/canteens";

/**
 * MobileStudentCartSheet
 * Flow:
 * - step 0 ("Your Cart"): Editable items (+ / - stepper, remove, change canteen) + Proceed to Checkout button
 * - step 1 ("Confirm Your Items"): Step 1 review, strictly NON-EDITABLE items list (user requested) + Confirm & Proceed
 * - step 2 ("Details & Payment"): Name pre-fill/edit for token callout + cooking note + UPI/Cash selector
 * - step 3 ("Pay / Confirm"): Redesigned mobile UPI screen or Cash counter guidance card
 * - step "ordering": Sizzling kitchen radar animation with dynamic checklist & progress fill
 * - step "placed": Order placed card with huge token badge, pickup counter, prep time, live track buttons
 */
export default function MobileStudentCartSheet({
  isOpen,
  onClose,
  cart = [],
  cartTotal = 0,
  onIncrease,
  onDecrease,
  onRemove,
  studentName = "",
  setStudentName,
  studentPhone = "",
  setStudentPhone,
  studentProfile,
  remarks = "",
  setRemarks,
  paymentMethod = "Cash",
  setPaymentMethod,
  onSubmit,
  onPlaceOrder,
  submitting = false,
  selectedCanteen,
  currentCanteen,
  isCartCanteenClosed = false,
  cartClosedCanteens = [],
  onOpenCanteenModal,
  liveStatsMap = {},
  canteensList = [],
  menuItems = [],
  onChangeCanteen,
  onBrowseMenu
}) {
  const router = useRouter();
  const sheetRef = useRef(null);

  const activeCanteenName =
    selectedCanteen?.name || currentCanteen?.name || "34 Block Food Court";

  // Steps: 0 ("Your Cart") | 1 (Confirm Items - Non-editable) | 2 (Details & Pay) | 3 (Payment) | "ordering" | "placed"
  const [step, setStep] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [placedOrder, setPlacedOrder] = useState(null);

  // UPI State
  const [upiSecondsRemaining, setUpiSecondsRemaining] = useState(299);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [upiPaymentState, setUpiPaymentState] = useState("idle"); // "idle" | "processing" | "success"

  // Local name fallback if setStudentName is not passed
  const [localName, setLocalName] = useState(() => studentName || studentProfile?.name || "");
  const [nameError, setNameError] = useState("");

  // Local phone state with edit option
  const [localPhone, setLocalPhone] = useState(() => studentPhone || studentProfile?.phone || "");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [selectedPickupSlot, setSelectedPickupSlot] = useState("");
  const [slotError, setSlotError] = useState("");

  // Sync name & phone from prop/profile
  useEffect(() => {
    if (studentName) setLocalName(studentName);
    else if (studentProfile?.name) setLocalName(studentProfile.name);
  }, [studentName, studentProfile]);

  useEffect(() => {
    if (studentPhone) setLocalPhone(studentPhone);
    else if (studentProfile?.phone) setLocalPhone(studentProfile.phone);
  }, [studentPhone, studentProfile]);

  // Touch / Pointer Drag-down & Smooth Exit Animation States
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isClosingRef = useRef(false);

  // Close sheet with smooth slide-down animation
  const handleCloseWithAnimation = useCallback(() => {
    if (step === "ordering" || isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    setDragOffset(0);

    setTimeout(() => {
      setIsClosing(false);
      isClosingRef.current = false;
      if (onClose) onClose();
    }, 280);
  }, [step, onClose]);

  // Pointer drag handling for handle zone
  const handlePointerDown = (e) => {
    if (step === "ordering" || isClosingRef.current) return;
    if (e.button && e.button !== 0) return;
    const startY = e.clientY;
    dragStartYRef.current = startY;
    currentDragYRef.current = startY;
    setIsDragging(true);

    const onPointerMove = (moveEvt) => {
      currentDragYRef.current = moveEvt.clientY;
      const deltaY = moveEvt.clientY - startY;
      if (deltaY > 0) {
        setDragOffset(deltaY);
      } else {
        setDragOffset(deltaY * 0.15);
      }
    };

    const onPointerUp = (upEvt) => {
      setIsDragging(false);
      const deltaY = upEvt.clientY - startY;
      if (deltaY > 55) {
        handleCloseWithAnimation();
      } else {
        setDragOffset(0);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Touch event fallback
  const handleTouchStart = (e) => {
    if (step === "ordering" || isClosingRef.current) return;
    const startY = e.touches[0].clientY;
    dragStartYRef.current = startY;
    currentDragYRef.current = startY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || step === "ordering" || isClosingRef.current) return;
    const currentY = e.touches[0].clientY;
    currentDragYRef.current = currentY;
    const deltaY = currentY - dragStartYRef.current;
    if (deltaY > 0) {
      setDragOffset(deltaY);
    } else {
      setDragOffset(deltaY * 0.15);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || step === "ordering" || isClosingRef.current) return;
    setIsDragging(false);
    const deltaY = currentDragYRef.current - dragStartYRef.current;
    if (deltaY > 55) {
      handleCloseWithAnimation();
    } else {
      setDragOffset(0);
    }
  };

  // Reset steps on open/close
  useEffect(() => {
    if (!isOpen) {
      if (step === "placed") {
        setStep(0);
        setPlacedOrder(null);
      }
      setUpiPaymentState("idle");
      setUpiSecondsRemaining(299);
      setIsClosing(false);
      setDragOffset(0);
      setIsDragging(false);
      isClosingRef.current = false;
      return;
    }

    setIsClosing(false);
    setDragOffset(0);
    setIsDragging(false);
    isClosingRef.current = false;

    if (cart.length === 0 && step !== "placed") {
      setStep(0);
    }
  }, [isOpen, cart.length]);

  // Countdown timer for UPI in Step 3
  useEffect(() => {
    if (!isOpen || step !== 3 || paymentMethod !== "UPI") return;
    const timer = setInterval(() => {
      setUpiSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, step, paymentMethod]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalItemsCount = cart.reduce((sum, it) => sum + (it.quantity || 1), 0);

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleCopyVpa = () => {
    try {
      navigator.clipboard.writeText("canteengo@okaxis");
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2000);
    } catch {}
  };

  // Cart -> Step 1 (Non-editable confirmation)
  const handleProceedToStep1 = () => {
    if (cart.length === 0) return;
    if (isCartCanteenClosed) {
      alert("Selected canteen is currently closed. Please change your canteen before proceeding.");
      return;
    }
    setStep(1);
  };

  // Step 1 -> Step 2
  const handleProceedToStep2 = () => {
    setStep(2);
  };

  // Step 2 -> Step 3
  const handleProceedToStep3 = () => {
    const trimmed = (localName || "").trim();
    if (!trimmed) {
      setNameError("Please enter your name for token callout.");
      return;
    }
    setNameError("");

    const cleanPhone = (localPhone || "").replace(/\D/g, "");
    if (cleanPhone && cleanPhone.length !== 10) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setPhoneError("");

    // Validate preferred pickup time slot (Mandatory)
    if (!selectedPickupSlot || !selectedPickupSlot.trim()) {
      setSlotError("Please select a preferred pickup time slot before proceeding.");
      return;
    }
    setSlotError("");

    if (setStudentName) setStudentName(trimmed);
    if (setStudentPhone) setStudentPhone(cleanPhone);
    try {
      if (cleanPhone) localStorage.setItem("canteenGo_studentPhone", cleanPhone);
    } catch {}

    setStep(3);
  };

  // Real ordering stages across 4 seconds
  const ORDERING_STAGES = [
    {
      icon: "📡",
      title: `Sending Order to ${activeCanteenName}...`,
      subtitle: "Connecting directly with live kitchen terminal",
      progress: "33%"
    },
    {
      icon: "🕒",
      title: `Scheduling Pickup (${selectedPickupSlot || "Time Slot"})...`,
      subtitle: "Registering your requested collection window",
      progress: "66%"
    },
    {
      icon: "📋",
      title: "Order Sent for Vendor Approval!",
      subtitle: "Awaiting canteen confirmation • Token will issue on acceptance",
      progress: "100%"
    }
  ];

  // Step 3 -> Execute Order -> Ordering Animation (4 seconds) -> Placed Card
  const handleExecuteOrder = async (isPaidOnline = false) => {
    setStep("ordering");
    setLoadingStep(0);

    const animStartTime = Date.now();
    const t1 = setTimeout(() => setLoadingStep(1), 1000);
    const t2 = setTimeout(() => setLoadingStep(2), 2000);
    const t3 = setTimeout(() => setLoadingStep(3), 3000);

    const currentActiveName = (localName || studentName || studentProfile?.name || "Student").trim();
    const cleanPhone = (localPhone || studentPhone || studentProfile?.phone || "").replace(/\D/g, "");

    try {
      let createdOrder = null;

      if (onPlaceOrder) {
        createdOrder = await onPlaceOrder(isPaidOnline, {
          studentName: currentActiveName,
          studentPhone: cleanPhone,
          remarks: (remarks || "").trim(),
          paymentMethod: isPaidOnline ? "UPI" : paymentMethod,
          pickupSlot: selectedPickupSlot.trim()
        });
      } else {
        const distinctCanteens = Array.from(
          new Set(cart.map((i) => i.canteen?.name || selectedCanteen?.name || "Food Court near 34 Block"))
        );
        const canteenSummary = distinctCanteens.join(", ");
        const firstValidCanteen = cart.find((i) => i.canteen?.id && i.canteen?.id !== "all")?.canteen ||
          (selectedCanteen?.id !== "all" ? selectedCanteen : null);

        const orderPayload = {
          studentName: currentActiveName,
          studentEmail: studentProfile?.email || "",
          studentPhone: cleanPhone,
          paymentMethod: isPaidOnline ? "UPI" : "Cash",
          remarks: remarks ? remarks.trim() : "",
          pickupSlot: selectedPickupSlot.trim(),
          canteenId: firstValidCanteen?.id || "foodcourt-34",
          canteenName: canteenSummary && !canteenSummary.includes("All Canteens") ? canteenSummary : (firstValidCanteen?.name || "Food Court near 34 Block"),
          counterName: firstValidCanteen?.counter || "Counter 1 (Fast Dispatch)",
          items: cart.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            canteenId: item.canteen?.id || "foodcourt-34",
            canteenName: item.canteen?.name || "Food Court near 34 Block",
            counterName: item.canteen?.counter || "Counter 1"
          }))
        };

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to place order");

        if (isPaidOnline) {
          await fetch(`/api/orders/${data._id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentStatus: "Paid" })
          });
          data.paymentStatus = "Paid";
        }
        createdOrder = data;
      }

      if (createdOrder) {
        try {
          localStorage.setItem("canteenGo_lastToken", createdOrder.tokenNumber);
          const myIds = JSON.parse(localStorage.getItem("canteenGo_myOrderIds") || "[]");
          if (!myIds.includes(createdOrder._id)) {
            myIds.unshift(createdOrder._id);
            localStorage.setItem("canteenGo_myOrderIds", JSON.stringify(myIds));
          }
          localStorage.removeItem("canteenGo_studentCart");
        } catch {}
      }

      // Exact 4-second animation display guarantee before transitioning to Placed Card
      const elapsed = Date.now() - animStartTime;
      const remainingTime = Math.max(0, 4000 - elapsed);

      setTimeout(() => {
        setPlacedOrder(createdOrder || {
          tokenNumber: "T-" + Math.floor(100 + Math.random() * 900),
          canteenName: selectedCanteen?.name || "Campus Food Court",
          counterName: "Counter 1 (Fast Dispatch)",
          totalAmount: cartTotal,
          items: cart,
          estimatedPrepTime: 8
        });
        setStep("placed");
      }, remainingTime);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      alert(err.message || "Failed to place order. Please try again.");
      setStep(paymentMethod === "UPI" ? 3 : 2);
    }
  };

  const handleSimulateUpi = () => {
    setUpiPaymentState("processing");
    setTimeout(() => {
      setUpiPaymentState("success");
      setTimeout(() => {
        handleExecuteOrder(true);
      }, 500);
    }, 1100);
  };

  return (
    <div
      className={`mobile-cart-backdrop ${isClosing ? "backdrop-closing" : ""}`}
      onClick={step === "ordering" ? undefined : handleCloseWithAnimation}
    >
      <div
        className={`mobile-cart-sheet ${isClosing ? "sheet-closing" : ""} ${isDragging ? "sheet-dragging" : ""}`}
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isClosing
            ? "translateY(100%)"
            : dragOffset > 0
            ? `translateY(${dragOffset}px)`
            : undefined,
          transition: isDragging
            ? "none"
            : "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease"
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Order Cart"
      >
        {/* Top Interactive Drag Handle Bar (Pull down anywhere or tap to slide down & close) */}
        <div
          className="sheet-drag-handle-zone"
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleCloseWithAnimation}
          role="button"
          tabIndex={0}
          aria-label="Pull down or tap to close cart"
          title="Drag down or tap to close"
        >
          <div className="sheet-drag-handle" />
        </div>

        {/* 3-Step Checkout Progress Indicator (Visible in Steps 1, 2, 3) */}
        {(step === 1 || step === 2 || step === 3) && cart.length > 0 && (
          <div className="mobile-checkout-step-tracker">
            <div
              className={`checkout-step-node ${step === 1 ? "active" : "completed"}`}
              onClick={() => step > 1 && setStep(1)}
              role="button"
              tabIndex={0}
            >
              <span className="step-circle">{step > 1 ? "✓" : "1"}</span>
              <span className="step-label">Items</span>
            </div>

            <div className={`checkout-step-line ${step >= 2 ? "active" : ""}`} />

            <div
              className={`checkout-step-node ${step === 2 ? "active" : step > 2 ? "completed" : ""}`}
              onClick={() => step > 2 && setStep(2)}
              role="button"
              tabIndex={0}
            >
              <span className="step-circle">{step > 2 ? "✓" : "2"}</span>
              <span className="step-label">Details & Pay</span>
            </div>

            <div className={`checkout-step-line ${step === 3 ? "active" : ""}`} />

            <div className={`checkout-step-node ${step === 3 ? "active" : ""}`}>
              <span className="step-circle">3</span>
              <span className="step-label">{paymentMethod === "UPI" ? "UPI QR" : "Cash Pay"}</span>
            </div>
          </div>
        )}

        {/* Main Sheet Body */}
        <div className="mobile-cart-body">
          {/* =========================================================================
              VIEW A: EMPTY CART
              ========================================================================= */}
          {cart.length === 0 && step !== "placed" && (
            <div className="mobile-empty-cart">
              <div className="mobile-empty-cart-icon">
                <CartIcon size={46} />
              </div>
              <h4>Your Cart is Empty</h4>
              <p>Add fresh snacks, delicious meals, or beverages from the menu.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  handleCloseWithAnimation();
                  if (onBrowseMenu) onBrowseMenu();
                  else router.push("/order");
                }}
                style={{ marginTop: "14px", borderRadius: "12px", padding: "10px 20px" }}
              >
                Browse Canteen Menu →
              </button>
            </div>
          )}

          {/* =========================================================================
              INITIAL VIEW: "YOUR CART" (EDITABLE ITEMS, STEPPER & REMOVE)
              ========================================================================= */}
          {step === 0 && cart.length > 0 && (
            <div className="checkout-step-panel step-cart-panel">
              {/* Header */}
              <div className="mobile-cart-header" style={{ padding: "0 0 12px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div className="mobile-cart-header-title">
                  <CartIcon size={20} className="mobile-cart-icon" />
                  <h3>Your Cart</h3>
                  <span className="mobile-cart-count-pill">{totalItemsCount}</span>
                </div>
                <button type="button" className="mobile-cart-close-btn" onClick={handleCloseWithAnimation} aria-label="Close cart">
                  ✕
                </button>
              </div>

              {/* Items List (EDITABLE with +/- and remove) */}
              <div className="mobile-cart-items-list" style={{ marginTop: "12px" }}>
                {cart.map((item) => {
                  const estTime = getItemEstimateTime(item, item.canteen || selectedCanteen, liveStatsMap);
                  const isClosed = !isCanteenOpenNow(item.canteen || selectedCanteen).isOpen;
                  const itemCanteenName =
                    item.canteen?.name || selectedCanteen?.name || currentCanteen?.name || "Campus Canteen";

                  return (
                    <div key={item.menuItemId} className="mobile-cart-item-row">
                      <img
                        src={item.image || "/images/samosa.jpg"}
                        alt={item.name}
                        className="mobile-cart-item-img"
                        onError={(e) => {
                          e.target.src = "/images/samosa.jpg";
                        }}
                      />

                      <div className="mobile-cart-item-info">
                        <div className="mobile-cart-item-name-row">
                          <strong className="mobile-cart-item-name">{item.name}</strong>
                          {estTime && (
                            <span className="mobile-cart-prep-time">
                              <ClockIcon size={11} /> {estTime}
                            </span>
                          )}
                        </div>

                        {/* Canteen Selector Link */}
                        <button
                          type="button"
                          className="mobile-cart-item-canteen-link"
                          onClick={() => {
                            if (onOpenCanteenModal) {
                              onOpenCanteenModal({
                                menuItemId: item.menuItemId,
                                name: item.name,
                                basePrice: item.basePrice || item.price,
                                price: item.price,
                                image: item.image,
                                quantity: item.quantity,
                                canteen: item.canteen || currentCanteen || selectedCanteen,
                                isFromCart: true
                              });
                            }
                          }}
                          title="Click to compare & change canteen"
                        >
                          <span className="mobile-canteen-link-text"><u>{itemCanteenName}</u></span>
                          {isClosed && <span className="cart-item-closed-badge">🔴 Closed</span>}
                        </button>

                        <div className="mobile-cart-item-meta">
                          <span className="mobile-cart-item-price">
                            ₹{item.price}
                            <span className="cart-item-qty-mult"> × {item.quantity} = </span>
                            <strong>₹{item.price * item.quantity}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Stepper (+ / -) */}
                      <div className="mobile-cart-stepper">
                        <button
                          type="button"
                          className="mobile-stepper-btn"
                          onClick={() => onDecrease(item.menuItemId)}
                          aria-label="Decrease quantity"
                        >
                          <MinusIcon size={12} />
                        </button>
                        <span className="mobile-stepper-qty">{item.quantity}</span>
                        <button
                          type="button"
                          className="mobile-stepper-btn"
                          onClick={() => onIncrease(item.menuItemId)}
                          aria-label="Increase quantity"
                        >
                          <PlusIcon size={12} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="mobile-item-remove-btn"
                        onClick={() => onRemove(item.menuItemId)}
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Bill Details */}
              <div className="mobile-cart-summary-box">
                <div className="summary-line">
                  <span>Items Subtotal</span>
                  <span>₹{cartTotal}</span>
                </div>
                <div className="summary-line">
                  <span>Canteen Convenience Fee</span>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>FREE (₹0)</span>
                </div>
                <div className="summary-line highlight">
                  <span>To Pay</span>
                  <span className="summary-total-price">₹{cartTotal}</span>
                </div>
              </div>

              {/* Canteen Closed Alert */}
              {isCartCanteenClosed && (
                <div className="mobile-canteen-closed-banner">
                  ⚠️ Selected Canteen is currently closed. You cannot place orders right now.
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              STEP 1: ITEM CONFIRMATION (STRICTLY NON-EDITABLE AS REQUESTED)
              ========================================================================= */}
          {step === 1 && cart.length > 0 && (
            <div className="checkout-step-panel step-1-panel">
              {/* Step 1 Navigation & Title */}
              <div className="checkout-nav-header">
                <button type="button" className="btn-checkout-back" onClick={() => setStep(0)}>
                  ← Edit Cart
                </button>
                <button type="button" className="mobile-cart-close-btn" onClick={handleCloseWithAnimation} aria-label="Close cart">
                  ✕
                </button>
              </div>

              <div className="checkout-section-header">
                <div>
                  <h3 className="checkout-step-title">Step 1: Confirm Your Items</h3>
                  <span className="checkout-step-sub">
                    {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} in cart • Final review before details
                  </span>
                </div>
              </div>

              {/* Canteen Location Pill */}
              <div className="checkout-canteen-pill">
                <span className="canteen-pin-dot">📍</span>
                <span className="canteen-pill-name">{activeCanteenName}</span>
                <span className="canteen-pill-counter">Counter 1</span>
              </div>

              {/* Items List (STRICTLY NON-EDITABLE - No +/- buttons, No delete icon) */}
              <div className="mobile-confirm-items-list">
                {cart.map((item) => {
                  const estTime = getItemEstimateTime(item, item.canteen || selectedCanteen, liveStatsMap);
                  const itemCanteenName =
                    item.canteen?.name || selectedCanteen?.name || currentCanteen?.name || "Campus Canteen";

                  return (
                    <div key={item.menuItemId} className="mobile-confirm-item-row">
                      <img
                        src={item.image || "/images/samosa.jpg"}
                        alt={item.name}
                        className="mobile-confirm-item-img"
                        onError={(e) => {
                          e.target.src = "/images/samosa.jpg";
                        }}
                      />

                      <div className="mobile-confirm-item-info">
                        <div className="mobile-confirm-name-row">
                          <strong className="mobile-confirm-item-name">{item.name}</strong>
                          {estTime && (
                            <span className="mobile-cart-prep-time">
                              <ClockIcon size={11} /> {estTime}
                            </span>
                          )}
                        </div>

                        <span className="mobile-confirm-canteen-tag">{itemCanteenName}</span>

                        <div className="mobile-confirm-calc-row">
                          <span className="mobile-confirm-unit-price">
                            ₹{item.price} × {item.quantity} = <strong>₹{item.price * item.quantity}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Clean Non-Editable Quantity Pill */}
                      <div className="mobile-confirm-qty-wrap">
                        <span className="mobile-confirm-qty-badge">Qty: {item.quantity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bill Details */}
              <div className="mobile-cart-summary-box">
                <div className="summary-line">
                  <span>Items Subtotal</span>
                  <span>₹{cartTotal}</span>
                </div>
                <div className="summary-line">
                  <span>Canteen Convenience Fee</span>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>FREE (₹0)</span>
                </div>
                <div className="summary-line highlight">
                  <span>To Pay</span>
                  <span className="summary-total-price">₹{cartTotal}</span>
                </div>
              </div>

              {/* Edit notice */}
              <div className="mobile-confirm-edit-hint">
                <span>Need to add or change items?</span>
                <button type="button" className="btn-link-edit-cart" onClick={() => setStep(0)}>
                  ← Edit in Cart
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 2: YOUR NAME & MODE OF PAYMENT
              ========================================================================= */}
          {step === 2 && cart.length > 0 && (
            <div className="checkout-step-panel step-2-panel">
              {/* Back to Step 1 & Header */}
              <div className="checkout-nav-header">
                <button type="button" className="btn-checkout-back" onClick={() => setStep(1)}>
                  ← Back to Items
                </button>
                <button type="button" className="mobile-cart-close-btn" onClick={handleCloseWithAnimation} aria-label="Close cart">
                  ✕
                </button>
              </div>

              <h3 className="checkout-step-title">Step 2: Student Details & Payment</h3>
              <p className="checkout-step-sub">Enter pickup name and choose your preferred payment mode</p>

              {/* Section 1: Your Name */}
              <div className="checkout-form-card">
                <label className="checkout-input-label" htmlFor="checkoutStudentName">
                  <UserIcon size={16} className="input-icon-label" />
                  <span>Your Name (For Token Callout):</span>
                </label>
                <input
                  id="checkoutStudentName"
                  type="text"
                  className={`form-input checkout-name-input ${nameError ? "input-error" : ""}`}
                  placeholder="e.g. Ankit Verma"
                  value={localName}
                  onChange={(e) => {
                    setLocalName(e.target.value);
                    if (setStudentName) setStudentName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  autoFocus
                />
                {nameError ? (
                  <span className="checkout-field-error">{nameError}</span>
                ) : (
                  <span className="checkout-field-hint">
                    This name will be announced at the counter when food is ready.
                  </span>
                )}
              </div>

              {/* Section 1B: Mobile Number (With Edit Option) */}
              <div className="checkout-form-card mobile-phone-step-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label className="checkout-input-label" htmlFor="checkoutMobileNumber" style={{ margin: 0 }}>
                    <PhoneIcon size={16} className="input-icon-label" />
                    <span>Mobile Number:</span>
                  </label>
                  {isEditingPhone ? (
                    <button
                      type="button"
                      className="btn-edit-phone-pill save"
                      onClick={() => {
                        const clean = (localPhone || "").replace(/\D/g, "");
                        if (clean && clean.length !== 10) {
                          setPhoneError("Enter a valid 10-digit number");
                        } else {
                          setPhoneError("");
                          setIsEditingPhone(false);
                          if (setStudentPhone) setStudentPhone(clean);
                          try {
                            if (clean) localStorage.setItem("canteenGo_studentPhone", clean);
                          } catch {}
                        }
                      }}
                    >
                      ✓ Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-edit-phone-pill"
                      onClick={() => setIsEditingPhone(true)}
                    >
                      <EditIcon size={12} /> Edit
                    </button>
                  )}
                </div>

                {isEditingPhone ? (
                  <div className="mobile-phone-input-wrap">
                    <span className="phone-country-badge">🇮🇳 +91</span>
                    <input
                      id="checkoutMobileNumber"
                      type="tel"
                      className={`form-input checkout-phone-input ${phoneError ? "input-error" : ""}`}
                      placeholder="98765 43210"
                      maxLength={10}
                      value={localPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setLocalPhone(val);
                        if (phoneError) setPhoneError("");
                      }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div
                    className="mobile-phone-display-pill"
                    onClick={() => setIsEditingPhone(true)}
                    title="Tap to edit mobile number"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="phone-country-badge-sm">🇮🇳 +91</span>
                      <strong className="phone-number-text">
                        {localPhone ? `${localPhone.slice(0, 5)} ${localPhone.slice(5)}` : "Add mobile number"}
                      </strong>
                    </div>
                    <span className="phone-tap-edit">✎ Tap to edit</span>
                  </div>
                )}

                {phoneError ? (
                  <span className="checkout-field-error">{phoneError}</span>
                ) : (
                  <span className="checkout-field-hint">
                    Token ready & pickup SMS alerts will be sent to this number.
                  </span>
                )}
              </div>

              {/* Section 1C: Pickup Time Slot Selection */}
              <div className="checkout-form-card" style={{ padding: "12px" }}>
                <TimeSlotPicker
                  selectedSlot={selectedPickupSlot}
                  onSelectSlot={(slot) => {
                    setSelectedPickupSlot(slot);
                    if (slotError) setSlotError("");
                  }}
                  canteen={selectedCanteen || currentCanteen}
                  error={slotError}
                />
              </div>

              {/* Section 2: Cooking Note (Optional) */}
              <div className="checkout-form-card">
                <label className="checkout-input-label" htmlFor="checkoutCookingNote">
                  <span>📝 Cooking Note (Optional):</span>
                </label>
                <input
                  id="checkoutCookingNote"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Extra spicy, bina pyaz, pack separately..."
                  value={remarks}
                  onChange={(e) => setRemarks && setRemarks(e.target.value)}
                  maxLength={140}
                />
              </div>

              {/* Section 3: Select Mode of Payment */}
              <div className="checkout-payment-section">
                <label className="checkout-input-label">Select Mode of Payment:</label>

                {/* Option A: UPI QR Code */}
                <div
                  className={`checkout-mode-card ${paymentMethod === "UPI" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod && setPaymentMethod("UPI")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="mode-card-radio">
                    <span className={`radio-dot ${paymentMethod === "UPI" ? "active" : ""}`} />
                  </div>
                  <div className="mode-card-icon-wrap upi">
                    <QrIcon size={24} />
                  </div>
                  <div className="mode-card-content">
                    <div className="mode-card-title-row">
                      <strong>UPI QR Code</strong>
                      <span className="mode-badge-green">Instant Allocation</span>
                    </div>
                    <span className="mode-card-desc">GPay, PhonePe, Paytm, BHIM & All UPI Apps</span>
                  </div>
                </div>

                {/* Option B: Cash on Counter */}
                <div
                  className={`checkout-mode-card ${paymentMethod === "Cash" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod && setPaymentMethod("Cash")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="mode-card-radio">
                    <span className={`radio-dot ${paymentMethod === "Cash" ? "active" : ""}`} />
                  </div>
                  <div className="mode-card-icon-wrap cash">
                    <CashIcon size={24} />
                  </div>
                  <div className="mode-card-content">
                    <div className="mode-card-title-row">
                      <strong>Cash on Counter</strong>
                      <span className="mode-badge-orange">Pay at Pickup</span>
                    </div>
                    <span className="mode-card-desc">Pay exact cash at counter when food is ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 3: PAYMENT / FINAL CONFIRMATION
              ========================================================================= */}
          {step === 3 && cart.length > 0 && (
            <div className="checkout-step-panel step-3-panel">
              {/* Back to Step 2 & Header */}
              <div className="checkout-nav-header">
                <button type="button" className="btn-checkout-back" onClick={() => setStep(2)}>
                  ← Back to Details
                </button>
                <button type="button" className="mobile-cart-close-btn" onClick={handleCloseWithAnimation} aria-label="Close cart">
                  ✕
                </button>
              </div>

              {/* 3A: IF UPI PAYMENT SELECTED */}
              {paymentMethod === "UPI" && (
                <div className="mobile-redesigned-upi-view">
                  {/* Brand & Verified Badge */}
                  <div className="mobile-upi-brand-bar">
                    <div className="upi-logo-wrap">
                      <img src="/images/canteengo-logo.png" alt="canteenGo" className="upi-logo-img" />
                    </div>
                    <div>
                      <div className="upi-brand-name">
                        canteen<span>Go</span> Pay
                      </div>
                      <div className="upi-merchant-status">
                        <span className="verified-shield">✓</span> Verified Canteen Merchant
                      </div>
                    </div>
                  </div>

                  {/* Payable Amount Banner */}
                  <div className="mobile-upi-amount-card">
                    <span className="upi-amount-label">Payable Amount</span>
                    <strong className="upi-amount-value">₹{cartTotal}</strong>
                    <span className="upi-amount-sub">Instant Token Allocation • College Express</span>
                  </div>

                  {/* QR Code Card with Corner Brackets & Live Laser Beam */}
                  <div className="mobile-upi-qr-card">
                    <span className="qr-corner qr-corner-tl" />
                    <span className="qr-corner qr-corner-tr" />
                    <span className="qr-corner qr-corner-bl" />
                    <span className="qr-corner qr-corner-br" />

                    <div className="qr-scan-beam" />

                    {/* High-Fidelity SVG QR Matrix */}
                    <svg
                      className="upi-qr-graphic"
                      viewBox="0 0 200 200"
                      width="180"
                      height="180"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect width="200" height="200" fill="#ffffff" rx="12" />
                      <rect x="14" y="14" width="46" height="46" rx="6" fill="#0f172a" />
                      <rect x="22" y="22" width="30" height="30" rx="4" fill="#ffffff" />
                      <rect x="29" y="29" width="16" height="16" rx="3" fill="#ea580c" />

                      <rect x="140" y="14" width="46" height="46" rx="6" fill="#0f172a" />
                      <rect x="148" y="22" width="30" height="30" rx="4" fill="#ffffff" />
                      <rect x="155" y="29" width="16" height="16" rx="3" fill="#ea580c" />

                      <rect x="14" y="140" width="46" height="46" rx="6" fill="#0f172a" />
                      <rect x="22" y="148" width="30" height="30" rx="4" fill="#ffffff" />
                      <rect x="29" y="155" width="16" height="16" rx="3" fill="#ea580c" />

                      <rect x="66" y="20" width="6" height="6" fill="#0f172a" />
                      <rect x="78" y="20" width="6" height="6" fill="#0f172a" />
                      <rect x="90" y="20" width="6" height="6" fill="#0f172a" />
                      <rect x="102" y="20" width="6" height="6" fill="#0f172a" />
                      <rect x="114" y="20" width="6" height="6" fill="#0f172a" />
                      <rect x="126" y="20" width="6" height="6" fill="#0f172a" />

                      <rect x="66" y="34" width="7" height="7" fill="#1e293b" />
                      <rect x="80" y="34" width="14" height="7" fill="#1e293b" />
                      <rect x="102" y="34" width="7" height="7" fill="#1e293b" />
                      <rect x="116" y="34" width="14" height="7" fill="#1e293b" />
                      <rect x="66" y="48" width="14" height="7" fill="#1e293b" />
                      <rect x="87" y="48" width="7" height="7" fill="#1e293b" />
                      <rect x="108" y="48" width="14" height="7" fill="#1e293b" />

                      <rect x="34" y="66" width="7" height="7" fill="#1e293b" />
                      <rect x="48" y="66" width="14" height="7" fill="#1e293b" />
                      <rect x="83" y="66" width="14" height="7" fill="#1e293b" />
                      <rect x="118" y="66" width="14" height="7" fill="#1e293b" />

                      <rect x="34" y="80" width="14" height="7" fill="#1e293b" />
                      <rect x="55" y="80" width="7" height="7" fill="#1e293b" />
                      <rect x="111" y="80" width="14" height="7" fill="#1e293b" />
                      <rect x="132" y="80" width="7" height="7" fill="#1e293b" />

                      <rect x="34" y="94" width="7" height="14" fill="#1e293b" />
                      <rect x="48" y="94" width="14" height="7" fill="#1e293b" />
                      <rect x="125" y="94" width="7" height="7" fill="#1e293b" />

                      <rect x="34" y="122" width="14" height="7" fill="#1e293b" />
                      <rect x="76" y="122" width="14" height="7" fill="#1e293b" />
                      <rect x="111" y="122" width="14" height="7" fill="#1e293b" />

                      <rect x="66" y="150" width="14" height="7" fill="#1e293b" />
                      <rect x="108" y="150" width="14" height="7" fill="#1e293b" />

                      <circle cx="100" cy="100" r="18" fill="#ffffff" />
                      <circle cx="100" cy="100" r="15" fill="#ea580c" />
                      <text
                        x="100"
                        y="105"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        fontFamily="'Outfit', sans-serif"
                      >
                        Go
                      </text>
                    </svg>

                    {/* Expiry Pill */}
                    <div className="upi-expiry-badge">
                      <span className="pulse-dot-orange" />
                      <span>QR active for: <strong>{formatTimer(upiSecondsRemaining)}</strong></span>
                    </div>
                  </div>

                  {/* Supported UPI Apps */}
                  <div className="mobile-upi-apps-row">
                    <span className="upi-apps-tag">SCAN WITH:</span>
                    <div className="upi-app-chips">
                      <span className="app-chip chip-gpay">GPay</span>
                      <span className="app-chip chip-phonepe">PhonePe</span>
                      <span className="app-chip chip-paytm">Paytm</span>
                      <span className="app-chip chip-bhim">BHIM</span>
                    </div>
                  </div>

                  {/* Copy UPI ID Box */}
                  <div className="mobile-upi-copy-strip">
                    <div className="vpa-details">
                      <span className="vpa-label">UPI ID</span>
                      <strong className="vpa-text">canteengo@okaxis</strong>
                    </div>
                    <button type="button" className="btn-copy-vpa" onClick={handleCopyVpa}>
                      {copiedVpa ? "✓ Copied" : "Copy ID"}
                    </button>
                  </div>

                  {/* Simulate UPI Button */}
                  <div className="mobile-upi-action-wrap">
                    {upiPaymentState === "idle" && (
                      <button type="button" className="btn btn-simulate-upi" onClick={handleSimulateUpi}>
                        <CheckCircleIcon size={18} />
                        <span>Simulate Successful UPI Payment</span>
                      </button>
                    )}

                    {upiPaymentState === "processing" && (
                      <button type="button" className="btn btn-simulate-upi processing" disabled>
                        <span className="btn-upi-spinner" />
                        <span>Verifying with UPI Switch...</span>
                      </button>
                    )}

                    {upiPaymentState === "success" && (
                      <button type="button" className="btn btn-simulate-upi success" disabled>
                        <CheckCircleIcon size={18} />
                        <span>Payment Verified! Allocating Token...</span>
                      </button>
                    )}

                    <span className="mobile-upi-sec-badge">
                      🔒 256-Bit Encrypted • Contactless College Express Token
                    </span>
                  </div>
                </div>
              )}

              {/* 3B: IF CASH PAYMENT SELECTED */}
              {paymentMethod === "Cash" && (
                <div className="mobile-cash-confirmation-view">
                  <div className="cash-confirm-icon-badge">
                    <CashIcon size={36} />
                  </div>

                  <h3 className="cash-confirm-title">Pay at Cash Counter</h3>
                  <div className="cash-amount-pill">
                    <span>Payable on Pickup:</span>
                    <strong>₹{cartTotal}</strong>
                  </div>

                  {/* 3 Step Guidance Cards for Cash */}
                  <div className="cash-guidance-cards">
                    <div className="cash-guide-item">
                      <span className="guide-num">1</span>
                      <div>
                        <strong>Instant Token Generation</strong>
                        <p>Aapka token abhi turant generate hoga aur kitchen preparation shuru ho jayegi.</p>
                      </div>
                    </div>

                    <div className="cash-guide-item">
                      <span className="guide-num">2</span>
                      <div>
                        <strong>Skip General Queue</strong>
                        <p>Aapko billing ki lambi line me nahi lagna hai, seedha pickup counter par jayein.</p>
                      </div>
                    </div>

                    <div className="cash-guide-item">
                      <span className="guide-num">3</span>
                      <div>
                        <strong>Pay ₹{cartTotal} at Counter</strong>
                        <p>Counter 1 par token dikhakar exact cash ya counter UPI se pay karke food collect karein.</p>
                      </div>
                    </div>
                  </div>

                  {/* Location Info Banner */}
                  <div className="cash-location-banner">
                    <span>📍 {activeCanteenName}</span>
                    <span>• Counter 1 (Fast Dispatch)</span>
                  </div>

                  {/* Confirm Cash Order Action */}
                  <button
                    type="button"
                    className="btn btn-primary btn-confirm-cash"
                    onClick={() => handleExecuteOrder(false)}
                  >
                    <CheckCircleIcon size={18} />
                    <span>Confirm & Place Cash Order (₹{cartTotal}) →</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW B: ITEM ORDERING ANIMATION (4 SECONDS WITH DYNAMIC CENTERED STATUS)
              ========================================================================= */}
          {step === "ordering" && (
            <div className="mobile-ordering-animation-view">
              <div className="radar-spinner-container">
                <div className="radar-wave wave-1" />
                <div className="radar-wave wave-2" />
                <div className="radar-wave wave-3" />
                <div className="radar-center-icon">
                  <img src="/images/canteengo-logo.png" alt="canteenGo" className="radar-food-img" />
                </div>
              </div>

              <h3 className="ordering-anim-title">Placing Your Canteen Order</h3>

              {/* Dynamic Animated Status Line Centered Directly Above Progress Bar */}
              <div className="ordering-status-stage-wrapper">
                <div key={loadingStep} className="ordering-stage-dynamic-box">
                  <span className="stage-dynamic-icon">{ORDERING_STAGES[loadingStep]?.icon}</span>
                  <strong className="stage-dynamic-title">{ORDERING_STAGES[loadingStep]?.title}</strong>
                  <p className="stage-dynamic-sub">{ORDERING_STAGES[loadingStep]?.subtitle}</p>
                </div>
              </div>

              {/* Progress Bar with smooth 4s fill */}
              <div className="ordering-progress-bar">
                <div
                  className="ordering-progress-fill"
                  style={{
                    width: ORDERING_STAGES[loadingStep]?.progress || "25%"
                  }}
                />
              </div>

              {/* 4-Step Progress Indicator Dots */}
              <div className="ordering-stage-dots-bar">
                {[0, 1, 2, 3].map((dotIdx) => (
                  <span
                    key={dotIdx}
                    className={`ordering-stage-dot-pill ${loadingStep === dotIdx ? "active" : loadingStep > dotIdx ? "done" : ""}`}
                  />
                ))}
              </div>

              <span className="ordering-anim-footer-note">Live Kitchen Dispatch • Please hold on</span>
            </div>
          )}

          {/* =========================================================================
              VIEW C: ORDER PLACED CARD
              ========================================================================= */}
          {step === "placed" && placedOrder && (
            <div className="mobile-placed-card-view">
              <div className="placed-celebration-head">
                <div className="placed-green-circle" style={!placedOrder.tokenNumber ? { background: "#ea580c" } : undefined}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="placed-title">
                  {placedOrder.tokenNumber ? "Order Confirmed!" : "Order Submitted for Approval!"}
                </h2>
                <p className="placed-subtitle">
                  {placedOrder.tokenNumber
                    ? "Your meal is being prepared hot & fresh"
                    : "Sent to kitchen • Token issued upon vendor acceptance"}
                </p>
              </div>

              {/* Token Number Banner or Awaiting Approval Banner */}
              {placedOrder.tokenNumber ? (
                <div className="placed-token-banner">
                  <div className="token-banner-left">
                    <span className="token-banner-label">PICKUP TOKEN</span>
                    <strong className="token-banner-number">{placedOrder.tokenNumber}</strong>
                  </div>
                  <div className="token-banner-divider" />
                  <div className="token-banner-right">
                    <span className="token-wait-label">ESTIMATED TIME</span>
                    <strong className="token-wait-val">
                      ~ {placedOrder.estimatedPrepTime || 8} min
                    </strong>
                  </div>
                </div>
              ) : (
                <div
                  className="placed-token-banner pending-approval-banner"
                  style={{
                    background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                    border: "1.5px dashed #ea580c",
                    flexDirection: "column",
                    padding: "16px",
                    gap: "6px",
                    textAlign: "center"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#9a3412", letterSpacing: "0.5px" }}>
                    TOKEN NUMBER STATUS
                  </span>
                  <strong style={{ fontSize: "1.2rem", color: "#c2410c" }}>
                    ⏳ Awaiting Kitchen Acceptance
                  </strong>
                  <span style={{ fontSize: "0.8rem", color: "#7c2d12" }}>
                    Token will be assigned once vendor reviews and accepts your order.
                  </span>
                </div>
              )}

              {/* Pickup & Meta Details */}
              <div className="placed-meta-box">
                <div className="placed-meta-row slot-row" style={{ background: "#fff7ed", padding: "10px", borderRadius: "8px" }}>
                  <span className="meta-row-label" style={{ color: "#ea580c", fontWeight: 700 }}>🕒 Pickup Slot</span>
                  <strong className="meta-row-val" style={{ color: "#9a3412" }}>
                    {placedOrder.pickupSlot || selectedPickupSlot || "Standard Window"}
                  </strong>
                </div>
                <div className="placed-meta-row">
                  <span className="meta-row-label">📍 Pickup Counter</span>
                  <strong className="meta-row-val">{placedOrder.counterName || "Counter 1 (Fast Dispatch)"}</strong>
                </div>
                <div className="placed-meta-row">
                  <span className="meta-row-label">🏢 Canteen</span>
                  <strong className="meta-row-val">{placedOrder.canteenName || activeCanteenName}</strong>
                </div>
                <div className="placed-meta-row">
                  <span className="meta-row-label">💳 Payment Method</span>
                  <strong className="meta-row-val" style={{ color: paymentMethod === "UPI" ? "#16a34a" : "#ea580c" }}>
                    {paymentMethod === "UPI" ? "UPI (Paid ✓)" : "Cash on Counter (Pending)"}
                  </strong>
                </div>
                <div className="placed-meta-row total">
                  <span className="meta-row-label">Total Amount</span>
                  <strong className="meta-row-val">₹{placedOrder.totalAmount || cartTotal}</strong>
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div className="placed-actions-column">
                <button
                  type="button"
                  className="btn btn-primary btn-placed-track"
                  onClick={() => {
                    handleCloseWithAnimation();
                    router.push("/queue");
                  }}
                >
                  <span>Track on Live Queue Board →</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-placed-orders"
                  onClick={() => {
                    handleCloseWithAnimation();
                    router.push("/orders");
                  }}
                >
                  <ReceiptIcon size={16} />
                  <span>View in My Orders</span>
                </button>

                <button
                  type="button"
                  className="btn-placed-done"
                  onClick={() => {
                    handleCloseWithAnimation();
                    setStep(0);
                    setPlacedOrder(null);
                  }}
                >
                  Done • Order More Food
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Sheet Footer Actions */}
        {cart.length > 0 && step === 0 && (
          <div className="mobile-cart-footer">
            <button
              type="button"
              className="btn btn-primary btn-mobile-checkout"
              onClick={handleProceedToStep1}
              disabled={isCartCanteenClosed}
            >
              <span>Proceed to Checkout • ₹{cartTotal} →</span>
            </button>
          </div>
        )}

        {cart.length > 0 && step === 1 && (
          <div className="mobile-cart-footer">
            <button
              type="button"
              className="btn btn-primary btn-mobile-checkout"
              onClick={handleProceedToStep2}
              disabled={isCartCanteenClosed}
            >
              <span>Confirm Items & Proceed (₹{cartTotal}) →</span>
            </button>
          </div>
        )}

        {cart.length > 0 && step === 2 && (
          <div className="mobile-cart-footer">
            <button
              type="button"
              className="btn btn-primary btn-mobile-checkout"
              onClick={handleProceedToStep3}
            >
              {paymentMethod === "UPI" ? (
                <span>Proceed to UPI Payment (₹{cartTotal}) →</span>
              ) : (
                <span>Proceed to Cash Order (₹{cartTotal}) →</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
