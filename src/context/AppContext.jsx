"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import MobileStudentCartSheet from "@/components/mobile/MobileStudentCartSheet";
import OrderSuccessOverlay from "@/components/OrderSuccessOverlay";
import UpiModal from "@/components/UpiModal";
import ChooseCanteenModal from "@/components/ChooseCanteenModal";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CAMPUS_CANTEENS } from "@/data/canteens";

const AppContext = createContext(null);

export function useAppContext() {
  const context = useContext(AppContext);
  return context || {};
}

export function AppProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // Dynamic Canteens State (Loaded from MongoDB Atlas collection)
  const [canteens, setCanteens] = useState(CAMPUS_CANTEENS);
  const [loadingCanteens, setLoadingCanteens] = useState(true);

  const refreshCanteens = async () => {
    try {
      const res = await fetch("/api/canteens");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCanteens(data);
          try {
            localStorage.setItem("canteenGo_cachedCanteens", JSON.stringify(data));
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Failed to load dynamic canteens:", e);
    } finally {
      setLoadingCanteens(false);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem("canteenGo_cachedCanteens");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCanteens(parsed);
        }
      }
    } catch {}
    refreshCanteens();
  }, []);

  // Student Profile
  const [studentProfile, setStudentProfile] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Cart State (Persisted in localStorage)
  const [cart, setCart] = useState([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedProfile = localStorage.getItem("canteenGo_studentProfile");
      if (savedProfile) {
        setStudentProfile(JSON.parse(savedProfile));
      }
      const savedCart = localStorage.getItem("canteenGo_studentCart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}

    // Verify active JWT token with backend session API
    fetch("/api/auth/student/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated && data.student) {
          setStudentProfile((prev) => ({
            ...prev,
            ...data.student
          }));
          try {
            localStorage.setItem("canteenGo_studentProfile", JSON.stringify(data.student));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      if (Array.isArray(cart)) {
        localStorage.setItem("canteenGo_studentCart", JSON.stringify(cart));
      }
    } catch {}
  }, [cart, isMounted]);

  const handleSaveStudentProfile = (profile) => {
    setStudentProfile(profile);
    setIsProfileModalOpen(false);
    if (pathname === "/") {
      router.push("/order");
    }
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const handleBackToHome = () => {
    setIsProfileModalOpen(false);
    router.push("/order");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/student/logout", { method: "POST" }).catch(() => {});
      localStorage.removeItem("canteenGo_studentProfile");
      localStorage.removeItem("canteenGo_studentToken");
      localStorage.removeItem("canteenGo_userRole");
      localStorage.removeItem("canteenGo_studentTab");
      localStorage.removeItem("canteenGo_studentCart");
    } catch {}
    setStudentProfile(null);
    setCart([]);
    router.push("/");
  };

  // Derive userRole from route pathname:
  const userRole = pathname?.startsWith("/vendor")
    ? "vendor"
    : ["/order", "/queue", "/orders", "/my-orders", "/account"].some((p) => pathname?.startsWith(p))
    ? "student"
    : null;

  // Derive active tab from route pathname:
  const studentTab = pathname?.startsWith("/queue")
    ? "queue"
    : pathname?.startsWith("/orders") || pathname?.startsWith("/my-orders")
    ? "my-orders"
    : pathname?.startsWith("/account")
    ? "account"
    : "order";

  const handleSetStudentTab = (tab) => {
    if (tab === "order") router.push("/order");
    else if (tab === "queue") router.push("/queue");
    else if (tab === "my-orders") router.push("/orders");
    else if (tab === "account") router.push("/account");
  };

  const handleSetUserRole = (role) => {
    if (role === "vendor") router.push("/vendor");
    else if (role === "student") router.push("/order");
    else router.push("/");
  };

  const totalCartCount = Array.isArray(cart)
    ? cart.reduce((sum, item) => sum + (item?.quantity || 1), 0)
    : 0;

  // Global Cart State & Helpers (for routes other than /order)
  const [cartRemarks, setCartRemarks] = useState("");
  const [cartPaymentMethod, setCartPaymentMethod] = useState("Cash");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
  const [canteenModalItem, setCanteenModalItem] = useState(null);
  const [isCanteenModalOpen, setIsCanteenModalOpen] = useState(false);

  const cartTotal = Array.isArray(cart)
    ? cart.reduce(
        (sum, item) =>
          sum + (item.price || item.basePrice || 0) * (item.quantity || 1),
        0
      )
    : 0;

  const handleIncreaseCartQuantity = (menuItemId) => {
    setCart((prev) =>
      prev.map((i) =>
        i.menuItemId === menuItemId
          ? { ...i, quantity: (i.quantity || 1) + 1 }
          : i
      )
    );
  };

  const handleDecreaseCartQuantity = (menuItemId) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.menuItemId === menuItemId
            ? { ...i, quantity: (i.quantity || 1) - 1 }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const handleRemoveFromCart = (menuItemId) => {
    setCart((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const submitGlobalOrder = async (paidOnline = false, extraDetails = {}) => {
    try {
      setSubmittingOrder(true);
      setIsUpiModalOpen(false);

      const distinctCanteens = Array.from(
        new Set(cart.map((i) => i.canteen?.name || "Food Court near 34 Block"))
      );
      const canteenSummary = distinctCanteens.join(", ");
      const counterSummary = Array.from(
        new Set(cart.map((i) => i.canteen?.counter || "Counter 1"))
      ).join(", ");
      const firstValidCanteen =
        cart.find((i) => i.canteen?.id && i.canteen?.id !== "all")?.canteen ||
        canteens[0];

      const orderPayload = {
        studentName: (extraDetails?.studentName || studentProfile?.name || "Student").trim(),
        studentEmail: studentProfile?.email || "",
        studentPhone: (extraDetails?.studentPhone || studentProfile?.phone || "").trim(),
        paymentMethod: extraDetails?.paymentMethod || cartPaymentMethod,
        remarks: (extraDetails?.remarks !== undefined ? extraDetails.remarks : cartRemarks).trim(),
        pickupSlot: (extraDetails?.pickupSlot || "Immediate (Standard)").trim(),
        canteenId: firstValidCanteen?.id || "foodcourt-34",
        canteenName:
          canteenSummary && !canteenSummary.includes("All Canteens")
            ? canteenSummary
            : firstValidCanteen?.name || "Food Court near 34 Block",
        counterName:
          counterSummary || firstValidCanteen?.counter || "Counter 1 (Fast Dispatch)",
        items: cart.map((item) => {
          const itemCanteen =
            item.canteen?.id !== "all" ? item.canteen : firstValidCanteen;
          return {
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            canteenId: itemCanteen?.id || "foodcourt-34",
            canteenName: itemCanteen?.name || "Food Court near 34 Block",
            counterName: itemCanteen?.counter || "Counter 1"
          };
        })
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to place order");

      if (paidOnline) {
        await fetch(`/api/orders/${data._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentStatus: "Paid" })
        });
        data.paymentStatus = "Paid";
      }

      try {
        localStorage.setItem("canteenGo_lastToken", data.tokenNumber);
        const myIds = JSON.parse(
          localStorage.getItem("canteenGo_myOrderIds") || "[]"
        );
        if (!myIds.includes(data._id)) {
          myIds.push(data._id);
          localStorage.setItem("canteenGo_myOrderIds", JSON.stringify(myIds));
        }
      } catch {}

      setCart([]);
      try {
        localStorage.removeItem("canteenGo_studentCart");
      } catch {}

      setIsMobileCartOpen(false);
      setLastPlacedOrder(data);
      setIsOrderSuccessOpen(true);
      return data;
    } catch (err) {
      alert(err.message || "Could not place order");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleGlobalPlaceOrder = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!cart || cart.length === 0) return;
    if (cartPaymentMethod === "UPI") {
      setIsUpiModalOpen(true);
      return;
    }
    submitGlobalOrder(false);
  };

  return (
    <AppContext.Provider
      value={{
        canteens,
        loadingCanteens,
        refreshCanteens,
        userRole,
        studentTab,
        cart,
        setCart,
        cartCount: totalCartCount,
        studentProfile,
        setStudentProfile,
        isProfileModalOpen,
        setIsProfileModalOpen,
        handleSaveStudentProfile,
        handleLogout,
        handleSetStudentTab,
        handleSetUserRole,
        isMounted,
        isMobileCartOpen,
        setIsMobileCartOpen
      }}
    >
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {pathname !== "/" && (
          <Navbar
            userRole={userRole}
            setUserRole={handleSetUserRole}
            studentTab={studentTab}
            setStudentTab={handleSetStudentTab}
            cartCount={totalCartCount}
            studentProfile={studentProfile}
            onOpenProfile={() => router.push("/account")}
            onLogout={handleLogout}
          />
        )}

        <main className={pathname === "/" ? "home-main-container" : "container"} style={{ flex: 1, padding: pathname === "/" ? 0 : undefined }}>
          {children}
        </main>

        {pathname !== "/" && <Footer />}

        {/* Global Cart Sheet for routes other than /order */}
        {pathname !== "/order" && userRole === "student" && (
          <>
            <MobileStudentCartSheet
              isOpen={Boolean(isMobileCartOpen)}
              onClose={() => setIsMobileCartOpen(false)}
              cart={cart}
              cartTotal={cartTotal}
              onIncrease={handleIncreaseCartQuantity}
              onDecrease={handleDecreaseCartQuantity}
              onRemove={handleRemoveFromCart}
              studentName={studentProfile?.name || ""}
              studentProfile={studentProfile}
              remarks={cartRemarks}
              setRemarks={setCartRemarks}
              paymentMethod={cartPaymentMethod}
              setPaymentMethod={setCartPaymentMethod}
              onSubmit={handleGlobalPlaceOrder}
              onPlaceOrder={submitGlobalOrder}
              submitting={submittingOrder}
              canteensList={canteens}
              onOpenCanteenModal={(item) => {
                setCanteenModalItem(item);
                setIsCanteenModalOpen(true);
              }}
              onChangeCanteen={(newCanteen) => {
                setCart((prev) =>
                  prev.map((i) => ({ ...i, canteen: newCanteen }))
                );
              }}
              onBrowseMenu={() => {
                setIsMobileCartOpen(false);
                router.push("/order");
              }}
            />

            <UpiModal
              isOpen={isUpiModalOpen}
              onClose={() => setIsUpiModalOpen(false)}
              amount={cartTotal}
              onPaymentSuccess={() => submitGlobalOrder(true)}
            />

            <OrderSuccessOverlay
              isOpen={isOrderSuccessOpen}
              isSubmitting={submittingOrder}
              order={lastPlacedOrder}
              onClose={() => setIsOrderSuccessOpen(false)}
              onGoToYourOrders={() => {
                setIsOrderSuccessOpen(false);
                router.push("/orders");
              }}
              onTrackOrder={() => {
                setIsOrderSuccessOpen(false);
                router.push("/queue");
              }}
            />

            <ChooseCanteenModal
              isOpen={isCanteenModalOpen}
              onClose={() => setIsCanteenModalOpen(false)}
              selectedCanteen={canteenModalItem?.canteen}
              onSelectCanteen={(newCanteen) => {
                if (canteenModalItem) {
                  setCart((prev) =>
                    prev.map((it) =>
                      it.menuItemId === canteenModalItem.menuItemId
                        ? { ...it, canteen: newCanteen }
                        : it
                    )
                  );
                }
                setIsCanteenModalOpen(false);
              }}
              targetItem={canteenModalItem}
              cartItems={cart}
              canteens={canteens}
            />
          </>
        )}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

