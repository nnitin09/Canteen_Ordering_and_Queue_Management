import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import MenuCard from "../components/MenuCard";
import StatusBadge from "../components/StatusBadge";
import UpiModal from "../components/UpiModal";
import OrderSuccessOverlay from "../components/OrderSuccessOverlay";
import ChooseCanteenModal from "../components/ChooseCanteenModal";
import MobileStudentCartSheet from "../components/mobile/MobileStudentCartSheet";
import DesktopCheckoutModal from "../components/DesktopCheckoutModal";
import StudentMobileBottomNav from "../components/mobile/StudentMobileBottomNav";
import { CAMPUS_CANTEENS, DEFAULT_CANTEEN, getCanteenItemPrice, isCanteenOpenNow, getItemEstimateTime, getItemPriceForCanteen, isItemAvailableAtCanteen } from "../data/canteens";
import { useAppContext } from "@/context/AppContext";
import {
  SearchIcon,
  FlameIcon,
  CartIcon,
  SparklesIcon,
  ClockIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  CashIcon,
  QrIcon,
  QueueIcon,
  ReceiptIcon,
  LocationPinIcon,
  ZapIcon,
  UsersIcon,
  TicketIcon,
  ArrowRightIcon
} from "../components/Icons";

export default function StudentPage({
  setActiveTab,
  cart: externalCart,
  setCart: externalSetCart,
  studentProfile,
  onOpenProfile,
  onLogout
}) {
  const [menu, setMenu] = useState([]);
  const [internalCart, setInternalCart] = useState(() => {
    try {
      const saved = localStorage.getItem("canteenGo_studentCart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const rawCart = externalCart !== undefined ? externalCart : internalCart;
  const cart = Array.isArray(rawCart) ? rawCart : [];
  const setCart = externalSetCart !== undefined ? externalSetCart : setInternalCart;
  const [studentName, setStudentName] = useState(() => studentProfile?.name || "");
  const [remarks, setRemarks] = useState(() => {
    try {
      return localStorage.getItem("canteenGo_orderRemarks") || "";
    } catch {}
    return "";
  });
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [studentPhone, setStudentPhone] = useState(() => {
    try {
      return studentProfile?.phone || localStorage.getItem("canteenGo_studentPhone") || "";
    } catch {}
    return studentProfile?.phone || "";
  });
  const [isDesktopCheckoutOpen, setIsDesktopCheckoutOpen] = useState(false);

  useEffect(() => {
    if (studentProfile?.phone && !studentPhone) {
      setStudentPhone(studentProfile.phone);
    }
  }, [studentProfile]);

  useEffect(() => {
    try {
      if (remarks) {
        localStorage.setItem("canteenGo_orderRemarks", remarks);
      } else {
        localStorage.removeItem("canteenGo_orderRemarks");
      }
    } catch {}
  }, [remarks]);

  const { canteens: ctxCanteens, isMobileCartOpen, setIsMobileCartOpen } = useAppContext();
  const canteensList = ctxCanteens && ctxCanteens.length > 0 ? ctxCanteens : CAMPUS_CANTEENS;
  const defaultCanteenObj = canteensList[0] || DEFAULT_CANTEEN;

  // Selected Canteen State (Defaults to primary canteen from Atlas collection)
  const [selectedCanteen, setSelectedCanteen] = useState(() => {
    try {
      const saved = localStorage.getItem("canteenGo_selectedCanteen");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name) return parsed;
      }
    } catch {}
    return defaultCanteenObj;
  });
  const currentCanteen = selectedCanteen?.name ? selectedCanteen : defaultCanteenObj;
  const currentCanteenStatus = isCanteenOpenNow(currentCanteen);

  // Check if any item in cart is from a currently closed canteen
  const cartClosedCanteens = useMemo(() => {
    const map = new Map();
    cart.forEach((item) => {
      const itemCanteen = item.canteen && item.canteen.id !== "all" ? item.canteen : defaultCanteenObj;
      const status = isCanteenOpenNow(itemCanteen);
      if (!status.isOpen) {
        map.set(itemCanteen.name, { canteen: itemCanteen, status });
      }
    });
    return Array.from(map.values());
  }, [cart, defaultCanteenObj]);

  const isCartCanteenClosed = cartClosedCanteens.length > 0;
  const [isCanteenModalOpen, setIsCanteenModalOpen] = useState(false);
  const [canteenModalItem, setCanteenModalItem] = useState(null);

  // Sanitize cart items: An order can never go to "All Canteens"
  useEffect(() => {
    if (Array.isArray(cart) && cart.some((it) => it.canteen?.id === "all" || it.canteen?.name === "All Canteens")) {
      const fallbackCanteen = canteensList.find((c) => c.id !== "all" && c.name !== "All Canteens") || defaultCanteenObj;
      setCart((prevCart) =>
        prevCart.map((it) => {
          if (it.canteen?.id === "all" || it.canteen?.name === "All Canteens") {
            return {
              ...it,
              canteen: fallbackCanteen,
              price: getCanteenItemPrice(it.basePrice || it.price, fallbackCanteen)
            };
          }
          return it;
        })
      );
    }
  }, [cart, canteensList, defaultCanteenObj, setCart]);

  const handleSelectCanteen = (newCanteen, targetItem, computedPrice) => {
    setIsCanteenModalOpen(false);
    setCanteenModalItem(null);

    if (!newCanteen) return;

    // Per-item canteen selection: update or add specific item with chosen canteen & dynamic price
    if (targetItem && (targetItem.menuItemId || targetItem._id)) {
      const targetId = targetItem.menuItemId || targetItem._id;
      const base = targetItem.basePrice || targetItem.price;
      const finalPrice =
        typeof computedPrice === "number"
          ? computedPrice
          : getItemPriceForCanteen(targetItem, newCanteen);

      setCart((prevCart) => {
        const existingIndex = prevCart.findIndex(
          (ci) => ci.menuItemId === targetId
        );

        if (existingIndex > -1) {
          const updated = [...prevCart];
          updated[existingIndex] = {
            ...updated[existingIndex],
            canteen: newCanteen,
            price: finalPrice,
            basePrice: base
          };
          return updated;
        } else {
          return [
            ...prevCart,
            {
              menuItemId: targetId,
              name: targetItem.name,
              basePrice: base,
              price: finalPrice,
              quantity: 1,
              image: targetItem.image || "/images/samosa.jpg",
              canteen: newCanteen
            }
          ];
        }
      });

      setSuccessMessage(`Changed ${targetItem.name} canteen to ${newCanteen.shortName || newCanteen.name}`);
      return;
    }

    // Default global canteen switch (e.g. from top header)
    setSelectedCanteen(newCanteen);
    try {
      localStorage.setItem("canteenGo_selectedCanteen", JSON.stringify(newCanteen));
    } catch {}
    if (newCanteen.id === "all") {
      setSuccessMessage("Switched to All Campus Canteens view");
    } else {
      setSuccessMessage(`Switched canteen to ${newCanteen.shortName || newCanteen.name}`);
    }
    setMenuAnimKey((prev) => prev + 1);
  };

  // Instant inline canteen update for mobile cart - updates all cart items & dynamic prices without popup modal
  const handleCartCanteenChange = (newCanteen) => {
    if (!newCanteen || newCanteen.id === "all" || newCanteen.name === "All Canteens") return;

    setSelectedCanteen(newCanteen);
    try {
      localStorage.setItem("canteenGo_selectedCanteen", JSON.stringify(newCanteen));
    } catch {}

    setCart((prevCart) => {
      return prevCart.map((cartItem) => {
        const fullItem = menu.find((m) => m._id === cartItem.menuItemId) || cartItem;
        const newPrice = getItemPriceForCanteen(fullItem, newCanteen);
        return {
          ...cartItem,
          canteen: newCanteen,
          price: newPrice,
          basePrice: cartItem.basePrice || fullItem.price || newPrice
        };
      });
    });

    setSuccessMessage(`Pickup canteen updated to ${newCanteen.shortName || newCanteen.name}`);
  };

  useEffect(() => {
    if (studentProfile?.name) {
      setStudentName(studentProfile.name);
    }
  }, [studentProfile]);

  const [loadingMenu, setLoadingMenu] = useState(true);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Bottom Toast Notification (1s auto-dismiss on mobile, 2.2s on desktop)
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = "info") => {
    if (!message) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, isExiting: false });

    // On mobile, alert dismisses after 1 second as requested; desktop stays 2.2s
    const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
    const duration = isMobile ? 1000 : 2200;

    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, isExiting: true } : null));
      setTimeout(() => {
        setToast(null);
      }, 200);
    }, duration);
  }, []);

  useEffect(() => {
    if (successMessage) {
      showToast(successMessage, "info");
      setSuccessMessage("");
    }
  }, [successMessage, showToast]);

  useEffect(() => {
    if (errorMessage) {
      showToast(errorMessage, "error");
      setErrorMessage("");
    }
  }, [errorMessage, showToast]);

  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [menuAnimKey, setMenuAnimKey] = useState(0);

  // Custom Canteen Dropdown state & outside-click close
  const [isCanteenDropdownOpen, setIsCanteenDropdownOpen] = useState(false);
  const canteenDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        canteenDropdownRef.current &&
        !canteenDropdownRef.current.contains(e.target) &&
        !e.target.closest(".hero-btn-canteen")
      ) {
        setIsCanteenDropdownOpen(false);
      }
    };
    if (isCanteenDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isCanteenDropdownOpen]);

  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [liveCanteenStats, setLiveCanteenStats] = useState({});

  useEffect(() => {
    fetchMenu();
    fetchCanteenStats();
    const interval = setInterval(fetchCanteenStats, 20000);

    const handleMenuRatingUpdated = () => {
      fetchMenu();
    };
    window.addEventListener("menu-rating-updated", handleMenuRatingUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("menu-rating-updated", handleMenuRatingUpdated);
    };
  }, []);

  const fetchCanteenStats = async () => {
    try {
      const res = await fetch("/api/canteens/stats");
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach((s) => {
          map[s.canteenName] = s;
        });
        setLiveCanteenStats(map);
      }
    } catch {}
  };

  const fetchMenu = async () => {
    try {
      setLoadingMenu(true);
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Could not load canteen menu");
      const data = await res.json();
      setMenu(data);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoadingMenu(false);
    }
  };

  // Add Item to Cart
  const handleAddToCart = (item) => {
    setErrorMessage("");
    setSuccessMessage("");

    // When viewing "All Canteens", an order cannot be placed to "All Canteens".
    // Prompt the student to choose which specific campus canteen to pick up this item from!
    if (!selectedCanteen || selectedCanteen.id === "all" || selectedCanteen.name === "All Canteens") {
      setCanteenModalItem(item);
      setIsCanteenModalOpen(true);
      return;
    }

    const itemCanteen = selectedCanteen?.name ? selectedCanteen : DEFAULT_CANTEEN;
    if (!isItemAvailableAtCanteen(item, itemCanteen)) {
      setErrorMessage(`Sorry, "${item.name}" is currently sold out at ${itemCanteen.shortName || itemCanteen.name}.`);
      return;
    }
    const basePrice = item.price;
    const finalPrice = getItemPriceForCanteen(item, itemCanteen);

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (ci) => ci.menuItemId === item._id && (ci.canteen?.id === itemCanteen.id || ci.canteen?.name === itemCanteen.name)
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [
          ...prevCart,
          {
            menuItemId: item._id,
            name: item.name,
            basePrice: basePrice,
            price: finalPrice,
            quantity: 1,
            image: item.image || "/images/samosa.jpg",
            canteen: itemCanteen
          }
        ];
      }
    });

    setSuccessMessage(`✓ Added ${item.name} to cart (${itemCanteen.shortName || itemCanteen.name})`);
  };

  // Increase quantity from card or cart
  const handleIncreaseQuantity = (menuItemId) => {
    let itemName = "";
    let nextQty = 1;
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.menuItemId === menuItemId) {
          itemName = item.name;
          nextQty = item.quantity + 1;
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
    if (itemName) {
      setSuccessMessage(`Updated ${itemName} quantity (×${nextQty})`);
    }
  };

  // Decrease quantity from card or cart
  const handleDecreaseQuantity = (menuItemId) => {
    let itemName = "";
    let nextQty = 0;
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.menuItemId === menuItemId) {
            itemName = item.name;
            nextQty = item.quantity - 1;
            return { ...item, quantity: item.quantity - 1 };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
    if (itemName) {
      if (nextQty > 0) {
        setSuccessMessage(`Updated ${itemName} quantity (×${nextQty})`);
      } else {
        setSuccessMessage(`Removed ${itemName} from cart`);
      }
    }
  };

  const handleRemoveFromCart = (menuItemId) => {
    const itemToRemove = cart.find((i) => i.menuItemId === menuItemId);
    setCart((prevCart) => prevCart.filter((item) => item.menuItemId !== menuItemId));
    setSuccessMessage(itemToRemove ? `Removed ${itemToRemove.name} from cart` : "Removed item from cart");
  };

  // 1-Click Dynamic Fast-Break Combo: adds multiple real DB items
  const handleAddDynamicCombo = (itemsToAdd) => {
    setErrorMessage("");
    setSuccessMessage("");

    // If on "All Canteens", prompt to select a canteen first
    if (!selectedCanteen || selectedCanteen.id === "all" || selectedCanteen.name === "All Canteens") {
      setCanteenModalItem(itemsToAdd[0]?.item || null);
      setIsCanteenModalOpen(true);
      showToast("Please choose a pickup canteen first", "info");
      return;
    }

    const itemCanteen = selectedCanteen?.name ? selectedCanteen : DEFAULT_CANTEEN;

    setCart((prevCart) => {
      let updatedCart = [...prevCart];
      itemsToAdd.forEach(({ item, qty }) => {
        const existingIndex = updatedCart.findIndex((ci) => ci.menuItemId === item._id);
        const basePrice = item.price;
        const finalPrice = getItemPriceForCanteen(item, itemCanteen);

        if (existingIndex > -1) {
          updatedCart[existingIndex].quantity += qty;
        } else {
          updatedCart.push({
            menuItemId: item._id,
            name: item.name,
            basePrice: basePrice,
            price: finalPrice,
            quantity: qty,
            image: item.image || "/images/samosa.jpg",
            canteen: itemCanteen
          });
        }
      });
      return updatedCart;
    });

    setSuccessMessage("⚡ Fast Combo added to cart!");
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Transient 2.5-second floating cart alert when an item is added or quantity increased
  const [showCartAlert, setShowCartAlert] = useState(false);
  const cartAlertTimerRef = useRef(null);
  const prevCartCountRef = useRef(totalCartCount);

  useEffect(() => {
    if (totalCartCount > prevCartCountRef.current) {
      setShowCartAlert(true);
      if (cartAlertTimerRef.current) {
        clearTimeout(cartAlertTimerRef.current);
      }
      cartAlertTimerRef.current = setTimeout(() => {
        setShowCartAlert(false);
      }, 2500);
    } else if (totalCartCount === 0) {
      setShowCartAlert(false);
    }
    prevCartCountRef.current = totalCartCount;

    return () => {
      if (cartAlertTimerRef.current) {
        clearTimeout(cartAlertTimerRef.current);
      }
    };
  }, [totalCartCount]);

  const submitOrderToServer = async (paidOnline = false, extraDetails = {}) => {
    try {
      setIsUpiModalOpen(false);
      setSubmittingOrder(true);

      const distinctCanteens = Array.from(
        new Set(
          cart.map(
            (i) => i.canteen?.name || selectedCanteen?.name || "Food Court near 34 Block"
          )
        )
      );
      const canteenSummary = distinctCanteens.join(", ");
      const counterSummary = Array.from(
        new Set(
          cart.map(
            (i) => i.canteen?.counter || selectedCanteen?.counter || "Counter 1"
          )
        )
      ).join(", ");

      const firstValidCanteen = cart.find((i) => i.canteen?.id && i.canteen?.id !== "all")?.canteen ||
        (selectedCanteen?.id !== "all" ? selectedCanteen : defaultCanteenObj);

      const finalName = (extraDetails?.studentName || studentName || studentProfile?.name || "Student").trim();
      const finalPhone = (extraDetails?.studentPhone || studentPhone || studentProfile?.phone || "").trim();
      const finalRemarks = extraDetails?.remarks !== undefined ? extraDetails.remarks : remarks;
      const finalPayment = extraDetails?.paymentMethod || (paidOnline ? "UPI" : paymentMethod);
      const finalPickupSlot = (extraDetails?.pickupSlot || "Immediate (Standard)").trim();

      const orderPayload = {
        studentName: finalName,
        studentEmail: studentProfile?.email || "",
        studentPhone: finalPhone,
        paymentMethod: finalPayment,
        remarks: finalRemarks ? finalRemarks.trim() : "",
        pickupSlot: finalPickupSlot,
        canteenId: firstValidCanteen?.id || "foodcourt-34",
        canteenName: canteenSummary && !canteenSummary.includes("All Canteens") ? canteenSummary : (firstValidCanteen?.name || "Food Court near 34 Block"),
        counterName: counterSummary || firstValidCanteen?.counter || "Counter 1 (Fast Dispatch)",
        items: cart.map((item) => {
          const itemCanteen = item.canteen?.id !== "all" ? item.canteen : firstValidCanteen;
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

      if (!res.ok) {
        throw new Error(data.message || "Failed to place order");
      }

      if (paidOnline) {
        await fetch(`/api/orders/${data._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentStatus: "Paid" })
        });
        data.paymentStatus = "Paid";
      }

      // Smooth transition to token card
      setTimeout(() => {
        setLastPlacedOrder(data);
        setSubmittingOrder(false);
        if (setIsMobileCartOpen) setIsMobileCartOpen(false);
        setSuccessMessage(
          data.tokenNumber
            ? `Order Placed! Your Pickup Token is ${data.tokenNumber}`
            : `Order Placed! Sent for kitchen approval • Pickup Slot: ${data.pickupSlot || finalPickupSlot}`
        );
        setCart([]);
        setRemarks("");
        try {
          localStorage.removeItem("canteenGo_studentCart");
          localStorage.removeItem("canteenGo_orderRemarks");
        } catch {}
        try {
          localStorage.setItem("canteenGo_lastToken", data.tokenNumber);
          const myIds = JSON.parse(localStorage.getItem("canteenGo_myOrderIds") || "[]");
          if (!myIds.includes(data._id)) {
            myIds.unshift(data._id);
            localStorage.setItem("canteenGo_myOrderIds", JSON.stringify(myIds));
          }
        } catch {
          // localStorage fallback
        }
      }, 500);

      return data;
    } catch (err) {
      setErrorMessage(err.message);
      setIsOverlayOpen(false);
      setSubmittingOrder(false);
      throw err;
    }
  };

  const handlePlaceOrderClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (cart.length === 0) {
      setErrorMessage("Your cart is empty. Please add items from the menu.");
      showToast("Your cart is empty. Please add items from the menu.", "warning");
      return;
    }

    if (isCartCanteenClosed) {
      const closedNames = cartClosedCanteens.length > 0
        ? cartClosedCanteens.map((c) => c.canteen.name).join(", ")
        : currentCanteen.name;
      const msg = `Cannot place order: ${closedNames} is currently closed. Please change your pickup canteen.`;
      setErrorMessage(msg);
      showToast(msg, "warning");
      return;
    }

    // Open desktop 3-step checkout overlay modal
    setIsDesktopCheckoutOpen(true);
  };

  // DYNAMIC CATEGORIES: Extracted directly from menu items in MongoDB + Combos option
  const dynamicCategories = [
    "All",
    "Combos",
    ...new Set(
      menu
        .map((i) => i.category || "Snacks")
        .filter((cat) => Boolean(cat) && cat.toLowerCase() !== "combos" && cat.toLowerCase() !== "all")
    )
  ];

  // Dynamic filter by canteen, category & search query
  const filteredMenu = menu.filter((item) => {
    // Multi-canteen availability check
    const currentCanteenId = selectedCanteen?.id || selectedCanteen?.canteenId || "foodcourt-34";
    const currentCanteenName = (selectedCanteen?.name || "").toLowerCase();

    let matchesCanteen = true;
    if (currentCanteenId === "all" || currentCanteenName.includes("all")) {
      matchesCanteen = true;
    } else if (Array.isArray(item.availableCanteens) && item.availableCanteens.length > 0) {
      matchesCanteen =
        item.availableCanteens.includes("all") ||
        item.availableCanteens.includes(currentCanteenId) ||
        item.availableCanteens.some((c) => c && currentCanteenName.includes(c.toLowerCase()));
    } else if (item.canteenId) {
      matchesCanteen =
        item.canteenId === "all" ||
        item.canteenId === currentCanteenId ||
        (item.canteenName && item.canteenName.toLowerCase().includes(currentCanteenName));
    }

    if (!matchesCanteen) return false;

    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // DYNAMIC COMBOS: Computed dynamically from real available database items with strict separation
  const isBeverage = (i) =>
    i.category?.toLowerCase().includes("beverage") ||
    i.name.toLowerCase().includes("chai") ||
    i.name.toLowerCase().includes("coffee") ||
    i.name.toLowerCase().includes("tea") ||
    i.name.toLowerCase().includes("shake");

  // Drinks are strictly beverages available at this canteen
  const drinksList = menu.filter((i) => isItemAvailableAtCanteen(i, currentCanteen) && isBeverage(i));
  // Snacks are strictly solid food items available at this canteen (never beverage)
  const snacksList = menu.filter((i) => isItemAvailableAtCanteen(i, currentCanteen) && !isBeverage(i));

  // Combo 1: Primary snack + primary drink (guaranteed 2 distinct items)
  const comboPair1 =
    snacksList.length > 0 && drinksList.length > 0
      ? [
          { item: snacksList[0], qty: 2 },
          { item: drinksList[0], qty: 1 }
        ]
      : null;

  // Combo 2: Secondary snack + secondary drink (strictly distinct items)
  const snack2 = snacksList[1] || snacksList[0];
  const drink2 = drinksList[1] || drinksList[0];
  const comboPair2 =
    snack2 && drink2 && snack2._id !== drink2._id
      ? [
          { item: snack2, qty: 1 },
          { item: drink2, qty: 1 }
        ]
      : null;

  // Combo 3: Third snack + drink (if available)
  const snack3 = snacksList[2] || (snacksList.length > 2 ? snacksList[2] : null);
  const drink3 = drinksList[0] || drinksList[1];
  const comboPair3 =
    snack3 && drink3 && snack3._id !== drink3._id && snack3._id !== snack2?._id
      ? [
          { item: snack3, qty: 1 },
          { item: drink3, qty: 1 }
        ]
      : null;

  const dynamicCombos = [
    comboPair1 && {
      id: "combo-1",
      name: "Snack & Chai Combo",
      badge: "POPULAR PAIRING",
      desc:
        comboPair1[0].item._id === comboPair1[1].item._id
          ? `${comboPair1[0].qty + comboPair1[1].qty}× ${comboPair1[0].item.name}`
          : `${comboPair1[0].qty}× ${comboPair1[0].item.name} + ${comboPair1[1].qty}× ${comboPair1[1].item.name}`,
      price: comboPair1[0].item.price * comboPair1[0].qty + comboPair1[1].item.price * comboPair1[1].qty,
      image1: comboPair1[0].item.image || "/images/samosa.jpg",
      image2: comboPair1[1].item.image || "/images/chai.jpg",
      pair: comboPair1
    },
    comboPair2 && {
      id: "combo-2",
      name: "Patty & Coffee Combo",
      badge: "POPULAR PAIRING",
      desc:
        comboPair2[0].item._id === comboPair2[1].item._id
          ? `${comboPair2[0].qty + comboPair2[1].qty}× ${comboPair2[0].item.name}`
          : `${comboPair2[0].qty}× ${comboPair2[0].item.name} + ${comboPair2[1].qty}× ${comboPair2[1].item.name}`,
      price: comboPair2[0].item.price * comboPair2[0].qty + comboPair2[1].item.price * comboPair2[1].qty,
      image1: comboPair2[0].item.image || "/images/patty.jpg",
      image2: comboPair2[1].item.image || "/images/coffee.jpg",
      pair: comboPair2
    },
    comboPair3 && {
      id: "combo-3",
      name: "Roll & Beverage Combo",
      badge: "VALUE MEAL",
      desc: `${comboPair3[0].qty}× ${comboPair3[0].item.name} + ${comboPair3[1].qty}× ${comboPair3[1].item.name}`,
      price: comboPair3[0].item.price * comboPair3[0].qty + comboPair3[1].item.price * comboPair3[1].qty,
      image1: comboPair3[0].item.image || "/images/roll.jpg",
      image2: comboPair3[1].item.image || "/images/chai.jpg",
      pair: comboPair3
    }
  ].filter(Boolean);

  const filteredCombos = dynamicCombos.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Student Hero Banner (Full width & compact height) */}
      <div className="student-hero-banner">
        <div className="student-hero-content">
          <div className="student-hero-text">
            <div className="student-hero-greeting-text">
              Hey {studentProfile?.name ? studentProfile.name.split(" ")[0] : "Ankit"}! 👋
            </div>

            <h1 className="student-hero-title">
              Order Ahead, <span className="highlight-orange">Pick Up Fresh!</span>
            </h1>
            <p className="student-hero-subtitle">
              Pre-order your favourite meals, skip the long queue, and pick up fresh food from your campus canteen.
            </p>
            <div className="student-hero-badges">
              <span className="hero-pill">
                <ZapIcon size={14} className="hero-badge-icon" />
                <span>Order in Seconds</span>
              </span>
              <span className="hero-pill">
                <UsersIcon size={14} className="hero-badge-icon" />
                <span>Live Queue</span>
              </span>
              <span className="hero-pill">
                <TicketIcon size={14} className="hero-badge-icon" />
                <span>Digital Token</span>
              </span>
            </div>

            {/* Quick Interactive Shortcut Chips (Shown on Mobile) */}
            <div className="student-hero-quick-chips">
              <button
                type="button"
                className="hero-quick-chip"
                onClick={() => {
                  setSelectedCategory("Combos");
                  const el = document.querySelector(".menu-toolbar");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span>🔥 Top Combos</span>
              </button>

              <button
                type="button"
                className="hero-quick-chip"
                onClick={() => {
                  setSelectedCategory("All");
                  const el = document.querySelector(".menu-toolbar");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span>⚡ Quick Bites</span>
              </button>

              <button
                type="button"
                className="hero-quick-chip queue-chip"
                onClick={() => setActiveTab && setActiveTab("queue")}
              >
                <ClockIcon size={12} />
                <span>Live Queue</span>
              </button>
            </div>

            <div className="student-hero-actions">
              <button
                type="button"
                className="hero-btn-order"
                onClick={() => {
                  const el = document.querySelector(".menu-toolbar") || document.querySelector(".grid-2");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <CartIcon size={18} />
                <span>Order Now</span>
                <ArrowRightIcon size={15} />
              </button>
              <button
                type="button"
                className={`hero-btn-canteen ${isCanteenDropdownOpen ? "active" : ""}`}
                onClick={() => {
                  setIsCanteenDropdownOpen((prev) => !prev);
                  const el = canteenDropdownRef.current || document.querySelector(".custom-canteen-dropdown-wrap");
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const isFullyVisible = (
                      rect.top >= 0 &&
                      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
                    );
                    if (!isFullyVisible) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                    const triggerBtn = el.querySelector(".custom-canteen-trigger");
                    if (triggerBtn) triggerBtn.focus();
                  }
                }}
              >
                <LocationPinIcon size={18} />
                <span>Choose Canteen</span>
              </button>
            </div>
          </div>
          <div className="student-hero-media">
            <img
              src="/images/hero-food-artwork.png"
              alt="Campus Canteen Food - Pizza, Burger, Noodles, Sandwich"
              className="student-hero-food-img"
            />
          </div>
        </div>
      </div>

      {/* Animated Order Success Modal */}
      <OrderSuccessOverlay
        isOpen={isOverlayOpen}
        isSubmitting={submittingOrder}
        order={lastPlacedOrder}
        onClose={() => setIsOverlayOpen(false)}
        onGoToYourOrders={() => setActiveTab && setActiveTab("my-orders")}
        onTrackOrder={() => setActiveTab && setActiveTab("queue")}
      />

      {/* Active Token Bar with Go to Your Orders button */}
      {lastPlacedOrder && (
        <div className="active-token-floating-bar">
          <div className="active-bar-left">
            <span className="active-pill">ACTIVE TOKEN</span>
            <strong className="active-num">{lastPlacedOrder.tokenNumber}</strong>
            <span className="active-desc">• Placed for {lastPlacedOrder.studentName}</span>
          </div>
          <div className="active-bar-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setActiveTab && setActiveTab("my-orders")}
            >
              <ReceiptIcon size={14} />
              <span>View in Your Orders →</span>
            </button>
          </div>
        </div>
      )}

      {/* UPI QR Payment Modal */}
      <UpiModal
        isOpen={isUpiModalOpen}
        onClose={() => setIsUpiModalOpen(false)}
        amount={cartTotal}
        onPaymentSuccess={() => submitOrderToServer(true)}
      />

      {/* Mobile Slide-Up Cart Bottom Sheet (< 768px) */}
      <MobileStudentCartSheet
        isOpen={Boolean(isMobileCartOpen)}
        onClose={() => setIsMobileCartOpen && setIsMobileCartOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        onIncrease={handleIncreaseQuantity}
        onDecrease={handleDecreaseQuantity}
        onRemove={handleRemoveFromCart}
        studentName={studentName}
        setStudentName={setStudentName}
        studentPhone={studentPhone}
        setStudentPhone={setStudentPhone}
        studentProfile={studentProfile}
        remarks={remarks}
        setRemarks={setRemarks}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        onSubmit={handlePlaceOrderClick}
        onPlaceOrder={submitOrderToServer}
        submitting={submittingOrder}
        selectedCanteen={selectedCanteen}
        currentCanteen={currentCanteen}
        isCartCanteenClosed={isCartCanteenClosed}
        cartClosedCanteens={cartClosedCanteens}
        canteensList={canteensList}
        menuItems={menu}
        onChangeCanteen={handleCartCanteenChange}
        onOpenCanteenModal={(item) => {
          setCanteenModalItem({
            menuItemId: item?.menuItemId,
            name: item?.name,
            basePrice: item?.basePrice || item?.price,
            price: item?.price,
            image: item?.image,
            quantity: item?.quantity || 1,
            canteen: item?.canteen || currentCanteen,
            isFromCart: true
          });
          setIsCanteenModalOpen(true);
        }}
        liveStatsMap={liveCanteenStats}
        onBrowseMenu={() => {
          if (setIsMobileCartOpen) setIsMobileCartOpen(false);
          if (setActiveTab) setActiveTab("order");
        }}
      />

      {/* Desktop 3-Step Checkout Overlay Modal */}
      <DesktopCheckoutModal
        isOpen={isDesktopCheckoutOpen}
        onClose={() => setIsDesktopCheckoutOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        studentName={studentName}
        setStudentName={setStudentName}
        studentPhone={studentPhone}
        setStudentPhone={setStudentPhone}
        studentProfile={studentProfile}
        remarks={remarks}
        setRemarks={setRemarks}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        selectedCanteen={selectedCanteen}
        currentCanteen={currentCanteen}
        liveStatsMap={liveCanteenStats}
        onPlaceOrder={submitOrderToServer}
        onViewInOrders={() => setActiveTab && setActiveTab("my-orders")}
        onTrackInQueue={() => setActiveTab && setActiveTab("queue")}
      />

      {/* Mobile Floating Mini Cart Bar (< 768px - shows temporarily for 2.5s alert on add to cart) */}
      {showCartAlert && cart.length > 0 && !isMobileCartOpen && (
        <div
          className="mobile-floating-cart-bar"
          onClick={() => {
            setShowCartAlert(false);
            if (setIsMobileCartOpen) setIsMobileCartOpen(true);
          }}
          role="button"
          tabIndex={0}
          aria-label="View Cart"
        >
          <div className="floating-cart-left">
            <span className="floating-cart-badge">{totalCartCount}</span>
            <div className="floating-cart-meta">
              <span className="floating-cart-label">{totalCartCount === 1 ? "1 item added" : `${totalCartCount} items in cart`}</span>
              <strong className="floating-cart-total">₹{cartTotal}</strong>
            </div>
          </div>
          <div className="floating-cart-right">
            <span>View Cart</span>
            <ArrowRightIcon size={16} />
          </div>
        </div>
      )}

      {/* Main Grid: Menu on Left, Cart on Right */}
      <div className="grid-2">
        {/* Left Column: Menu Items */}
        <div>
          <div className="card">
            {/* Search and Category Filter Toolbar */}
            <div className="menu-toolbar">
              <div className="menu-search-canteen-row">
                <div className="search-input-wrap">
                  <SearchIcon size={18} className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search snacks, beverages, rolls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="clear-search-btn"
                      onClick={() => setSearchQuery("")}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Custom Canteen Dropdown Selector */}
                <div className="custom-canteen-dropdown-wrap" ref={canteenDropdownRef}>
                  <button
                    type="button"
                    className={`custom-canteen-trigger ${isCanteenDropdownOpen ? "active" : ""}`}
                    onClick={() => setIsCanteenDropdownOpen((prev) => !prev)}
                    aria-expanded={isCanteenDropdownOpen}
                  >
                    <span className="canteen-trigger-text">
                      <LocationPinIcon size={16} className="canteen-trigger-location-icon" />
                      <span>
                        {currentCanteen.id === "all"
                          ? "All Canteens"
                          : currentCanteen.shortName || currentCanteen.name}
                      </span>
                    </span>
                    <span className={`canteen-trigger-arrow ${isCanteenDropdownOpen ? "open" : ""}`}>
                      ▼
                    </span>
                  </button>

                  {isCanteenDropdownOpen && (
                    <div className="custom-canteen-menu">
                      <button
                        type="button"
                        className={`custom-canteen-option ${currentCanteen.id === "all" ? "selected" : ""}`}
                        onClick={() => {
                          handleSelectCanteen({
                            id: "all",
                            canteenId: "all",
                            name: "All Canteens",
                            shortName: "All Canteens",
                            icon: "🌐"
                          });
                          setIsCanteenDropdownOpen(false);
                          setMenuAnimKey((prev) => prev + 1);
                        }}
                      >
                        <span className="canteen-opt-icon"></span>
                        <span className="canteen-opt-name">All Canteens</span>
                        {currentCanteen.id === "all" && <span className="canteen-check-mark">✓</span>}
                      </button>

                      <div className="custom-canteen-divider"></div>

                      {canteensList.map((canteen) => {
                        const cId = canteen.id || canteen.canteenId;
                        const isSelected = (currentCanteen.id || currentCanteen.canteenId) === cId;
                        return (
                          <button
                            key={cId}
                            type="button"
                            className={`custom-canteen-option ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              handleSelectCanteen(canteen);
                              setIsCanteenDropdownOpen(false);
                              setMenuAnimKey((prev) => prev + 1);
                            }}
                          >
                            <span className="canteen-opt-icon">{canteen.icon || ""}</span>
                            <span className="canteen-opt-name">{canteen.shortName || canteen.name}</span>
                            {isSelected && <span className="canteen-check-mark">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Filter Chips with Combos Option */}
              <div className="category-scroll-chips">
                {dynamicCategories.map((cat) => (
                  <button
                    key={cat}
                    className={`cat-chip ${selectedCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu List State */}
            {loadingMenu ? (
              <div className="menu-loading-state">
                <div className="loading-spinner"></div>
                <p>Loading fresh canteen items from MongoDB...</p>
              </div>
            ) : selectedCategory === "Combos" ? (
              filteredCombos.length === 0 && filteredMenu.length === 0 ? (
                <div className="empty-menu-state">
                  <p>No combos found matching "{searchQuery}".</p>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "10px" }}
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All");
                    }}
                  >
                    View All Items
                  </button>
                </div>
              ) : (
                <div className="menu-grid">
                  {filteredCombos.map((combo) => (
                    <div key={combo.id} className="menu-card combo-menu-card">
                      <div className="menu-card-img-wrap combo-card-img-wrap">
                        <div className="combo-dual-images">
                          <img
                            src={combo.image1}
                            alt={combo.name}
                            className="combo-dual-img img-left"
                            loading="lazy"
                          />
                          <div className="combo-dual-divider"></div>
                          <img
                            src={combo.image2}
                            alt={combo.name}
                            className="combo-dual-img img-right"
                            loading="lazy"
                          />
                        </div>

                        <div className="menu-card-badge-pos">
                          <span className="combo-card-pill">{combo.badge}</span>
                        </div>

                        <span className="menu-card-category-tag">Combos</span>
                      </div>

                      <div className="menu-card-content">
                        <div className="menu-card-header">
                          <h4 className="menu-card-title">{combo.name}</h4>
                          <span className="veg-indicator" title="Pure Veg Combo">
                            <span className="veg-dot"></span>
                          </span>
                        </div>

                        <p className="menu-card-desc">{combo.desc}</p>

                        <div className="combo-card-highlight-note">
                          ✨ Best matched student combo
                        </div>

                        <div className="menu-card-footer">
                          <div className="menu-card-price">
                            <span className="currency-symbol">₹</span>
                            <span className="price-number">{combo.price}</span>
                            <span className="price-unit">/ combo</span>
                          </div>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm btn-add-combo"
                            onClick={() => handleAddDynamicCombo(combo.pair)}
                          >
                            <PlusIcon size={14} /> Add Combo
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Also render any database items explicitly categorized as 'Combos' */}
                  {filteredMenu.map((item) => {
                    const cartItem = cart.find((ci) => ci.menuItemId === item._id);
                    const quantityInCart = cartItem ? cartItem.quantity : 0;
                    const itemPrice = getItemPriceForCanteen(item, currentCanteen);
                    const isAvailAtCanteen = isItemAvailableAtCanteen(item, currentCanteen);
                    const itemWithDynamicPrice = {
                      ...item,
                      price: itemPrice,
                      available: isAvailAtCanteen
                    };

                    return (
                      <MenuCard
                        key={item._id}
                        item={itemWithDynamicPrice}
                        cartQuantity={quantityInCart}
                        selectedCanteen={currentCanteen}
                        liveStatsMap={liveCanteenStats}
                        onAddToCart={handleAddToCart}
                        onIncrease={handleIncreaseQuantity}
                        onDecrease={handleDecreaseQuantity}
                        onOpenCanteenModal={(clickedItem) => {
                          setCanteenModalItem(clickedItem);
                          setIsCanteenModalOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              )
            ) : filteredMenu.length === 0 ? (
              <div className="empty-menu-state">
                <p>No food items found matching "{searchQuery}".</p>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: "10px" }}
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div key={menuAnimKey} className="menu-grid menu-update-fade">
                {filteredMenu.map((item) => {
                  const cartItem = cart.find((ci) => ci.menuItemId === item._id);
                  const quantityInCart = cartItem ? cartItem.quantity : 0;
                  const itemPrice = getItemPriceForCanteen(item, currentCanteen);
                  const isAvailAtCanteen = isItemAvailableAtCanteen(item, currentCanteen);
                  const itemWithDynamicPrice = {
                    ...item,
                    price: itemPrice,
                    available: isAvailAtCanteen
                  };

                  return (
                    <MenuCard
                      key={item._id}
                      item={itemWithDynamicPrice}
                      cartQuantity={quantityInCart}
                      selectedCanteen={currentCanteen}
                      liveStatsMap={liveCanteenStats}
                      onAddToCart={handleAddToCart}
                      onIncrease={handleIncreaseQuantity}
                      onDecrease={handleDecreaseQuantity}
                      onOpenCanteenModal={(clickedItem) => {
                        setCanteenModalItem(clickedItem);
                        setIsCanteenModalOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cart & Checkout Form */}
        <div>
          <div className="card sticky-cart-card">
            <div className="card-header">
              <div className="cart-header-title">
                <CartIcon size={20} />
                <h3>Your Cart ({totalCartCount})</h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  className="btn-clear-cart"
                  onClick={() => {
                    setCart([]);
                    setSuccessMessage("Cart cleared successfully");
                  }}
                >
                  <TrashIcon size={14} /> Clear
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart-view">
                <div className="empty-cart-icon-wrap">
                  <CartIcon size={40} />
                </div>
                <h4>Your cart is empty</h4>
                <p>Select delicious hot snacks or combos from the menu to get started.</p>
              </div>
            ) : (
              <div>
                <ul className="cart-list">
                  {cart.map((item) => (
                    <li key={item.menuItemId} className="cart-item">
                      <img
                        src={item.image || "/images/samosa.jpg"}
                        alt={item.name}
                        className="cart-item-thumb"
                        onError={(e) => {
                          e.target.src = "/images/samosa.jpg";
                        }}
                      />
                      <div className="cart-item-details">
                        <div className="cart-item-title-row">
                          <span className="cart-item-title">{item.name}</span>
                          <span className="cart-item-time-badge" title="Estimated preparation time">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="cart-clock-icon">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>{getItemEstimateTime(item, item.canteen, liveCanteenStats)}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="cart-item-canteen-link"
                          onClick={() => {
                            setCanteenModalItem({
                              menuItemId: item.menuItemId,
                              name: item.name,
                              basePrice: item.basePrice || item.price,
                              price: item.price,
                              image: item.image,
                              quantity: item.quantity,
                              canteen: item.canteen || currentCanteen,
                              isFromCart: true
                            });
                            setIsCanteenModalOpen(true);
                          }}
                          title="Click to change canteen for this item"
                        >
                          <span>{item.canteen?.name || currentCanteen.name}</span>
                          {!isCanteenOpenNow(item.canteen || currentCanteen).isOpen && (
                            <span className="cart-item-closed-badge">🔴 Closed</span>
                          )}
                        </button>
                        <span className="cart-item-pricing">
                          ₹{item.price} × {item.quantity} = <strong>₹{item.price * item.quantity}</strong>
                        </span>
                      </div>

                      <div className="cart-item-stepper">
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => handleDecreaseQuantity(item.menuItemId)}
                        >
                          <MinusIcon size={12} />
                        </button>
                        <span className="stepper-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => handleIncreaseQuantity(item.menuItemId)}
                        >
                          <PlusIcon size={12} />
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => handleRemoveFromCart(item.menuItemId)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Subtotal Box */}
                <div className="cart-total-box">
                  <div className="total-row">
                    <span>Subtotal</span>
                    <span>₹{cartTotal}</span>
                  </div>
                  <div className="total-row total-highlight">
                    <span>Total Amount</span>
                    <span className="total-price">₹{cartTotal}</span>
                  </div>
                </div>

                {/* Checkout Form */}
                <form onSubmit={handlePlaceOrderClick} className="checkout-form">
                  {/* Selected Canteen in Cart */}
                  <div className="cart-canteen-info-pill">
                    <div className="cart-canteen-left">
                      <div className="cart-canteen-pin-badge" title="Pickup Location Hub">
                        <LocationPinIcon size={22} className="cart-canteen-pin-svg" />
                      </div>
                      <div className="cart-canteen-content">
                        {(() => {
                          const distinctCanteens = Array.from(
                            new Map(
                              cart
                                .map((ci) => ci.canteen)
                                .filter((c) => c && c.id !== "all" && c.name !== "All Canteens")
                                .map((c) => [c.id || c.name, c])
                            ).values()
                          );
                          const isMultiCanteen = distinctCanteens.length > 1;
                          const singleCartCanteen = distinctCanteens[0] ||
                            (selectedCanteen?.id !== "all" && selectedCanteen?.name !== "All Canteens" ? selectedCanteen : defaultCanteenObj);
                          const singleCanteenStatus = isCanteenOpenNow(singleCartCanteen);

                          return (
                            <>
                              <div className="cart-canteen-header-tag">
                                <span className="cart-canteen-label">
                                  {isMultiCanteen
                                    ? `PICKUP CANTEENS (${distinctCanteens.length})`
                                    : "PICKUP CANTEEN"}
                                </span>
                                <span className={`cart-canteen-status-dot ${isCartCanteenClosed ? "is-closed" : ""}`}>
                                  {!isCartCanteenClosed ? (
                                    <>
                                      <span className="pulse-dot"></span> Active
                                    </>
                                  ) : (
                                    <>
                                      <span className="closed-dot"></span> Closed ({singleCanteenStatus.nextOpenText || singleCartCanteen.openingHours || "Unavailable"})
                                    </>
                                  )}
                                </span>
                              </div>

                              {isMultiCanteen ? (
                                <div className="multi-canteen-tags-wrap">
                                  {distinctCanteens.map((c) => (
                                    <span key={c.id || c.name} className="canteen-mini-chip">
                                      📍 {c.shortName || c.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <strong className="cart-canteen-name">
                                  {singleCartCanteen.name}
                                </strong>
                              )}

                              <div className="cart-canteen-counter">
                                {isMultiCanteen ? (
                                  <span>Collect items at each respective counter</span>
                                ) : (
                                  <>
                                    <span>{singleCartCanteen.counter || "Counter 1"}</span>
                                    {singleCartCanteen.walkingMinutes && (
                                      <span className="canteen-walk-badge">
                                        🚶 {singleCartCanteen.walkingMinutes} min walk
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-change-canteen-pill"
                      onClick={() => {
                        if (cart.length > 0) {
                          const firstCartItem = cart[0];
                          const fullItem = menu.find((m) => m._id === firstCartItem.menuItemId);
                          setCanteenModalItem({
                            menuItemId: firstCartItem.menuItemId,
                            name: firstCartItem.name,
                            basePrice: firstCartItem.basePrice || firstCartItem.price,
                            price: firstCartItem.price,
                            image: firstCartItem.image || fullItem?.image || "",
                            quantity: firstCartItem.quantity,
                            canteen: firstCartItem.canteen || currentCanteen,
                            isFromCart: true
                          });
                        } else {
                          setCanteenModalItem(null);
                        }
                        setIsCanteenModalOpen(true);
                      }}
                      title="Click to change pickup canteen"
                    >
                      Change
                    </button>
                  </div>

                  {/* Payment Method Selector in Cart */}
                  <div className="form-group" style={{ marginTop: "14px" }}>
                    <label className="form-label">Select Payment Option:</label>
                    <div className="payment-options-grid">
                      <div
                        className={`payment-option-card ${paymentMethod === "Cash" ? "selected" : ""}`}
                        onClick={() => setPaymentMethod("Cash")}
                        role="button"
                        tabIndex={0}
                      >
                        <CashIcon size={22} className="pay-icon" />
                        <div>
                          <div className="pay-title">Cash Counter</div>
                          <div className="pay-sub">Pay at pickup</div>
                        </div>
                      </div>

                      <div
                        className={`payment-option-card ${paymentMethod === "UPI" ? "selected" : ""}`}
                        onClick={() => setPaymentMethod("UPI")}
                        role="button"
                        tabIndex={0}
                      >
                        <QrIcon size={22} className="pay-icon" />
                        <div>
                          <div className="pay-title">UPI QR Code</div>
                          <div className="pay-sub">Fast Scan & Pay</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isCartCanteenClosed && (
                    <div className="cart-canteen-closed-banner">
                      <div className="closed-banner-left">
                        <span className="closed-alert-icon">⚠️</span>
                        <div>
                          <strong className="closed-banner-title">
                            {cartClosedCanteens.length > 0
                              ? `${cartClosedCanteens.map((c) => c.canteen.name).join(", ")} is Closed`
                              : `${currentCanteen.name} is Closed`}
                          </strong>
                          <p className="closed-banner-desc">
                            {cartClosedCanteens.length > 0
                              ? cartClosedCanteens.map((c) => `${c.canteen.name}: ${c.status.nextOpenText || c.canteen.openingHours}`).join(" • ")
                              : `${currentCanteenStatus.nextOpenText || currentCanteen.openingHours || "Closed for ordering"}`}
                            . You cannot place orders while closed.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-switch-to-open"
                        onClick={() => {
                          if (cart.length > 0) {
                            const firstCartItem = cart[0];
                            const fullItem = menu.find((m) => m._id === firstCartItem.menuItemId);
                            setCanteenModalItem({
                              menuItemId: firstCartItem.menuItemId,
                              name: firstCartItem.name,
                              basePrice: firstCartItem.basePrice || firstCartItem.price,
                              price: firstCartItem.price,
                              image: firstCartItem.image || fullItem?.image || "",
                              quantity: firstCartItem.quantity,
                              canteen: firstCartItem.canteen || currentCanteen,
                              isFromCart: true
                            });
                          }
                          setIsCanteenModalOpen(true);
                        }}
                      >
                        Switch Canteen →
                      </button>
                    </div>
                  )}

                  {/* Proceed to 3-Step Overlay Checkout */}
                  <button
                    type="submit"
                    className={`btn btn-primary btn-checkout ${isCartCanteenClosed ? "btn-checkout-disabled-closed" : ""}`}
                    disabled={submittingOrder || isCartCanteenClosed}
                    title={isCartCanteenClosed ? "Canteen is currently closed" : "Proceed to 3-Step Checkout"}
                  >
                    {isCartCanteenClosed ? (
                      <span>✕ Canteen Closed ({currentCanteenStatus.nextOpenText || "Outside Hours"})</span>
                    ) : (
                      <>
                        <span>Proceed to Checkout (₹{cartTotal})</span>
                        <span className="btn-arrow">→</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bottom Toast Alert (Pill capsule with animation matching design) */}
      {toast && (
        <div
          className={`student-bottom-toast ${toast.isExiting ? "toast-exit" : "toast-enter"} toast-${toast.type}`}
          role="status"
          aria-live="polite"
        >
          <span className="toast-exclamation-circle" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </span>
          <span className="toast-divider" aria-hidden="true" />
          <span className="toast-message">{toast.message}</span>
        </div>
      )}

      {/* Choose Canteen Modal (Light Orange-White Theme & Dynamic Sorting) */}
      <ChooseCanteenModal
        isOpen={isCanteenModalOpen}
        onClose={() => {
          setIsCanteenModalOpen(false);
          setCanteenModalItem(null);
        }}
        selectedCanteen={selectedCanteen}
        onSelectCanteen={handleSelectCanteen}
        targetItem={canteenModalItem}
        cartItems={cart}
        canteens={canteensList}
        menuItems={menu}
      />

      {/* Student Floating Bottom Pill Dock (< 768px, permanently sticky fixed) */}
      <StudentMobileBottomNav
        studentTab="order"
        setStudentTab={setActiveTab}
        cartCount={totalCartCount}
        isCartOpen={Boolean(isMobileCartOpen)}
        onToggleCart={() => setIsMobileCartOpen && setIsMobileCartOpen((prev) => !prev)}
        onOpenProfile={onOpenProfile}
      />
    </div>
  );
}
