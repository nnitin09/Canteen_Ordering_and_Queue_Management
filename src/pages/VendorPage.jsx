import { useState, useEffect, useRef, useMemo } from "react";
import StatusBadge from "../components/StatusBadge";
import { CAMPUS_CANTEENS, getItemPriceForCanteen, isItemAvailableAtCanteen } from "../data/canteens";
import { useAppContext } from "@/context/AppContext";
import {
  ChefIcon,
  RefreshIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  FlameIcon,
  ClockIcon,
  BellIcon,
  QueueIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  UploadIcon,
  ImageIcon,
  SearchIcon,
  VolumeIcon
} from "../components/Icons";
import QueuePage from "./QueuePage";
import SecureHandoverModal from "../components/SecureHandoverModal";
import DeclineOrderModal from "../components/DeclineOrderModal";
import VendorLiveQueueBoard from "../components/VendorLiveQueueBoard";
import VendorItemSalesView from "../components/VendorItemSalesView";
import EditMenuItemModal from "../components/EditMenuItemModal";
import MobileVendorMoreSheet from "../components/mobile/MobileVendorMoreSheet";

// Preset fast-pick image shortcuts for the vendor
const PHOTO_PRESETS = [
  { label: "Samosa", url: "/images/samosa.jpg" },
  { label: "Chai", url: "/images/chai.jpg" },
  { label: "Veg Patty", url: "/images/patty.jpg" },
  { label: "Paneer Roll", url: "/images/roll.jpg" },
  { label: "Cheese Maggi", url: "/images/maggi.jpg" },
  { label: "Cold Coffee", url: "/images/coffee.jpg" },
  { label: "Veg Sandwich", url: "/images/sandwich.jpg" }
];

export default function VendorPage({ onExitToHome }) {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeVendorTab, setActiveVendorTab] = useState("orders");

  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Search & Filter state for orders
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Menu Search
  const [menuSearchQuery, setMenuSearchQuery] = useState("");

  // Secure Pickup Handover & Decline Modals
  const [selectedHandoverOrder, setSelectedHandoverOrder] = useState(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);

  const [selectedDeclineOrder, setSelectedDeclineOrder] = useState(null);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);

  // Sub-view toggle: "orders" (live kitchen cards) or "sales" (item-wise sales breakdown)
  const [ordersSubView, setOrdersSubView] = useState("orders");

  // Sub-view toggle for Menu tab: "list" (items table) or "add" (add item form)
  const [menuSubView, setMenuSubView] = useState("list");

  // Mobile overflow "..." menu sheet state
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  const { canteens: ctxCanteens } = useAppContext();
  const canteensList = ctxCanteens && ctxCanteens.length > 0 ? ctxCanteens : CAMPUS_CANTEENS;

  const [selectedVendorCanteen, setSelectedVendorCanteen] = useState(() => {
    try {
      const saved = localStorage.getItem("canteenGo_vendorCanteen");
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = canteensList.find((c) => (c.id || c.canteenId) === (parsed.id || parsed.canteenId));
        if (match) return match;
      }
    } catch {}
    return canteensList[0];
  });

  // Track previous pending count to trigger alert message for incoming orders
  const prevPendingCountRef = useRef(null);

  // Add Item Form State
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Hot Snacks");
  const [newItemCustomCategory, setNewItemCustomCategory] = useState("");
  const [newItemFoodType, setNewItemFoodType] = useState("veg"); // "veg" | "non-veg" | "egg"
  const [newItemImage, setNewItemImage] = useState("/images/samosa.jpg");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemAvailable, setNewItemAvailable] = useState(true);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Menu Category & Dietary Filter Chips
  const [selectedMenuCategory, setSelectedMenuCategory] = useState("all");
  const [selectedFoodTypeFilter, setSelectedFoodTypeFilter] = useState("all");

  // Bulk stock update state
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Full item edit modal state
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ text: "Please select a valid image file (PNG, JPG, WEBP, etc.)", type: "error" });
      return;
    }

    setIsUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl) {
        setIsUploadingImage(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          setNewItemImage(compressed);
          setImageLoadError(false);
          setIsUploadingImage(false);
          setMessage({ text: `Image "${file.name}" uploaded successfully!`, type: "success" });
        } catch {
          setNewItemImage(dataUrl);
          setImageLoadError(false);
          setIsUploadingImage(false);
        }
      };
      img.onerror = () => {
        setNewItemImage(dataUrl);
        setImageLoadError(false);
        setIsUploadingImage(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setIsUploadingImage(false);
      setMessage({ text: "Failed to read image file. Please try another image.", type: "error" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Edit Item State
  const [editingItemId, setEditingItemId] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const fetchOrders = async (canteenToFetch, isBackground = false) => {
    try {
      if (!isBackground) setLoadingOrders(true);
      const targetCanteen =
        canteenToFetch && typeof canteenToFetch === "object" && typeof canteenToFetch.id === "string"
          ? canteenToFetch
          : selectedVendorCanteen;

      const canteenId = targetCanteen?.id;
      const canteenParam = canteenId ? `?canteenId=${encodeURIComponent(canteenId)}` : "";
      const res = await fetch(`/api/orders${canteenParam}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();

      // Check if a brand-new Pending Approval order has arrived
      const currentPendingCount = data.filter(
        (o) => o.orderStatus === "Pending Approval" || (o.orderStatus === "Pending" && !o.tokenNumber)
      ).length;
      if (prevPendingCountRef.current !== null && currentPendingCount > prevPendingCountRef.current) {
        setMessage({ text: "⚡ New order approval request received! Please Accept or Reject.", type: "success" });
      }
      prevPendingCountRef.current = currentPendingCount;

      setOrders(data);
    } catch (err) {
      if (!isBackground) {
        setMessage({ text: err.message, type: "error" });
      }
    } finally {
      if (!isBackground) setLoadingOrders(false);
    }
  };

  const fetchMenu = async () => {
    try {
      setLoadingMenu(true);
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Failed to load menu items");
      const data = await res.json();
      setMenuItems(data);
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoadingMenu(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchOrders(selectedVendorCanteen);
    fetchMenu();
  }, [selectedVendorCanteen]);

  // Silent background auto-sync (every 10 seconds) without UI clutter
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(selectedVendorCanteen, true);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedVendorCanteen]);

  // Vendor Action: Accept Order & Generate Token
  const handleAcceptOrder = async (orderId) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canteenId: selectedVendorCanteen?.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept order");

      setMessage({
        text: `✓ Order Accepted! Token #${data.tokenNumber} generated and assigned to student.`,
        type: "success"
      });
      fetchOrders(selectedVendorCanteen, true);
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  // Order state update (Preparing, Ready for Pickup, etc.)
  const handleUpdateOrderStatus = async (orderId, nextStatus, extraPayload = {}) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderStatus: nextStatus,
          canteenId: selectedVendorCanteen?.id,
          ...extraPayload
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update status");

      if (nextStatus === "Preparing") {
        setMessage({ text: `✓ Order #${data.tokenNumber || ""} cooking in kitchen.`, type: "success" });
      } else if (nextStatus === "Ready for Pickup" || nextStatus === "Ready") {
        setMessage({ text: `✓ Order #${data.tokenNumber || ""} marked Ready for counter pickup!`, type: "success" });
      } else {
        setMessage({ text: `Order updated to ${nextStatus}`, type: "success" });
      }

      fetchOrders(selectedVendorCanteen, true);
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  // Reject / Decline Order Workflow
  const handleInitiateDecline = (order) => {
    setSelectedDeclineOrder(order);
    setIsDeclineModalOpen(true);
  };

  const handleConfirmDeclineOrder = async (orderId, reason) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: reason,
          canteenId: selectedVendorCanteen?.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject order");

      setMessage({
        text: `✕ Order rejected with reason: "${reason}". Student notified. No token generated.`,
        type: "info"
      });
      fetchOrders(selectedVendorCanteen, true);
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  // Secure Pickup Handover Workflow
  const handleInitiateHandover = (order) => {
    setSelectedHandoverOrder(order);
    setIsHandoverModalOpen(true);
  };

  const handleConfirmSecureHandover = async (orderId, pinCode, bypass) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderStatus: "Completed",
        verifyPickupCode: pinCode,
        bypassVerification: bypass
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to handover order");

    setMessage({ text: `✓ Order ${data.tokenNumber} verified & handed over!`, type: "success" });
    fetchOrders(selectedVendorCanteen, true);
  };

  const handleTogglePaymentStatus = async (orderId, currentStatus) => {
    const nextStatus = currentStatus === "Paid" ? "Pending" : "Paid";
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: nextStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update payment");

      setMessage({ text: `Payment status set to ${nextStatus}`, type: "success" });
      fetchOrders(selectedVendorCanteen, true);
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  // Menu Management
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setMessage({ text: "Item name cannot be empty", type: "error" });
      return;
    }
    const priceNum = parseFloat(newItemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setMessage({ text: "Please enter a valid price", type: "error" });
      return;
    }

    const finalCategory =
      newItemCategory === "Custom"
        ? newItemCustomCategory.trim() || "Snacks"
        : newItemCategory;

    const assignedCanteenId = selectedVendorCanteen?.id || "foodcourt-34";
    const assignedCanteenName = selectedVendorCanteen?.name || "Food Court near 34 Block";
    const assignedAvailableCanteens = [assignedCanteenId];

    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItemName.trim(),
          price: priceNum,
          category: finalCategory,
          foodType: newItemFoodType,
          isVeg: newItemFoodType === "veg",
          image: newItemImage.trim() || "/images/samosa.jpg",
          description: newItemDescription.trim(),
          available: newItemAvailable,
          canteenId: assignedCanteenId,
          canteenName: assignedCanteenName,
          availableCanteens: assignedAvailableCanteens
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add menu item");

      setMessage({ text: `✓ Added "${data.name}" to ${assignedCanteenName}!`, type: "success" });
      setNewItemName("");
      setNewItemPrice("");
      setNewItemDescription("");
      setNewItemAvailable(true);
      setNewItemFoodType("veg");
      setMenuSubView("list");
      fetchMenu();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      const currentAvail = isItemAvailableAtCanteen(item, selectedVendorCanteen);
      const nextAvail = !currentAvail;
      const canteenId = selectedVendorCanteen?.id;

      const res = await fetch(`/api/menu/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canteenId: canteenId,
          canteenAvailable: nextAvail
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update item");

      const canteenName = selectedVendorCanteen?.shortName || selectedVendorCanteen?.name || "this canteen";
      setMessage({
        text: `"${item.name}" is now ${nextAvail ? "Available (In Stock)" : "Sold Out (Out of Stock)"} at ${canteenName}!`,
        type: "success"
      });
      fetchMenu();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  const handleSaveEdit = async (itemId) => {
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setMessage({ text: "Please enter a valid price", type: "error" });
      return;
    }

    try {
      const canteenId = selectedVendorCanteen?.id;
      const res = await fetch(`/api/menu/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canteenId: canteenId,
          canteenPrice: priceNum,
          price: priceNum,
          category: editCategory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update item");

      const canteenName = selectedVendorCanteen?.shortName || selectedVendorCanteen?.name || "this canteen";
      setMessage({ text: `Price for "${data.name}" set to ₹${priceNum} at ${canteenName}!`, type: "success" });
      setEditingItemId(null);
      setEditPrice("");
      fetchMenu();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  const handleDeleteMenuItem = async (itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete item");

      setMessage({ text: `"${itemName}" deleted from menu`, type: "success" });
      fetchMenu();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    }
  };

  const handleBulkStockToggle = async (action) => {
    const isSoldOutAction = action === "mark-all-soldout";
    const actionLabel = isSoldOutAction ? "Sold Out" : "In Stock / Available";
    const canteenName = selectedVendorCanteen?.shortName || selectedVendorCanteen?.name || "this canteen";

    if (!window.confirm(`Are you sure you want to mark ALL menu items as ${actionLabel} for ${canteenName}?`)) {
      return;
    }

    try {
      setBulkUpdating(true);
      const res = await fetch("/api/menu/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canteenId: selectedVendorCanteen?.id || "foodcourt-34",
          action
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Bulk update failed");

      setMessage({
        text: `✓ All menu items are now marked as ${actionLabel} for ${canteenName}!`,
        type: "success"
      });
      await fetchMenu();
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setBulkUpdating(false);
    }
  };

  const existingCategories = [
    "Hot Snacks",
    "Beverages",
    "Meals & Wraps",
    ...new Set(menuItems.map((m) => m.category).filter(Boolean))
  ];
  const uniqueCategories = [...new Set(existingCategories)];

  // Order Counts & Metrics
  const pendingApprovalCount = orders.filter(
    (o) => o.orderStatus === "Pending Approval" || (o.orderStatus === "Pending" && !o.tokenNumber)
  ).length;
  const acceptedCount = orders.filter((o) => o.orderStatus === "Accepted").length;
  const preparingCount = orders.filter((o) => o.orderStatus === "Preparing").length;
  const readyCount = orders.filter((o) => o.orderStatus === "Ready" || o.orderStatus === "Ready for Pickup").length;
  const completedCount = orders.filter((o) => o.orderStatus === "Completed").length;
  const rejectedCount = orders.filter((o) => o.orderStatus === "Rejected" || o.orderStatus === "Cancelled").length;
  const cancelledCount = rejectedCount;
  const pendingCount = pendingApprovalCount;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.paymentStatus === "Paid" ? o.totalAmount : 0),
    0
  );

  // Filtered Orders based on Search & Status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "Pending Approval" || statusFilter === "Pending") {
          const isPendingApp = order.orderStatus === "Pending Approval" || (order.orderStatus === "Pending" && !order.tokenNumber);
          if (!isPendingApp) return false;
        } else if (statusFilter === "Accepted") {
          if (order.orderStatus !== "Accepted") return false;
        } else if (statusFilter === "Preparing") {
          if (order.orderStatus !== "Preparing") return false;
        } else if (statusFilter === "Ready") {
          if (order.orderStatus !== "Ready" && order.orderStatus !== "Ready for Pickup") return false;
        } else if (statusFilter === "Completed") {
          if (order.orderStatus !== "Completed") return false;
        } else if (statusFilter === "Cancelled" || statusFilter === "Rejected") {
          if (order.orderStatus !== "Rejected" && order.orderStatus !== "Cancelled") return false;
        } else if (order.orderStatus !== statusFilter) {
          return false;
        }
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const tokenMatch = order.tokenNumber?.toLowerCase().includes(query);
        const orderIdMatch = String(order._id || "").toLowerCase().includes(query);
        const nameMatch = order.studentName?.toLowerCase().includes(query);
        const phoneMatch = order.studentPhone?.toLowerCase().includes(query);
        const slotMatch = order.pickupSlot?.toLowerCase().includes(query);
        const itemMatch = order.items?.some((it) => it.name?.toLowerCase().includes(query));
        if (!tokenMatch && !orderIdMatch && !nameMatch && !phoneMatch && !slotMatch && !itemMatch) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Displayed Menu Items for current canteen
  const displayedMenuItems = useMemo(() => {
    let list = menuItems.filter((item) => {
      const avail = item.availableCanteens || (item.canteenId ? [item.canteenId] : []);
      return (
        item.canteenId === selectedVendorCanteen?.id ||
        avail.includes(selectedVendorCanteen?.id) ||
        item.canteenId === "all" ||
        avail.includes("all")
      );
    });

    if (selectedMenuCategory !== "all") {
      list = list.filter((it) => (it.category || "Hot Snacks") === selectedMenuCategory);
    }

    if (selectedFoodTypeFilter !== "all") {
      list = list.filter((it) => {
        const ft = it.foodType || (it.isVeg === false ? "non-veg" : "veg");
        return ft === selectedFoodTypeFilter;
      });
    }

    if (menuSearchQuery.trim()) {
      const q = menuSearchQuery.trim().toLowerCase();
      list = list.filter(
        (it) => it.name?.toLowerCase().includes(q) || it.category?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [menuItems, selectedVendorCanteen, menuSearchQuery, selectedMenuCategory, selectedFoodTypeFilter]);

  // Helper for human-readable time elapsed
  const getTimeElapsed = (dateString) => {
    if (!dateString) return "";
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div>
      {/* Specific Canteen Role Bar */}
      <div className="vendor-canteen-switch-bar">
        <div className="vendor-canteen-info">
          <div className="vendor-canteen-icon-box" style={{ background: selectedVendorCanteen?.themeBg || "#ea580c" }}>
            <span>{selectedVendorCanteen?.icon || "🏢"}</span>
          </div>
          <div className="vendor-canteen-text">
            <div className="vendor-canteen-top-badge">
              <span className="hub-pill">CANTEEN OPERATOR TERMINAL</span>
              <span className="counter-pill">{selectedVendorCanteen?.counter || "Counter 1"}</span>
            </div>
            <h3 className="vendor-canteen-name">{selectedVendorCanteen?.name || "Campus Canteen"}</h3>
            <p className="vendor-canteen-sub">
              📍 {selectedVendorCanteen?.location} • Hours: {selectedVendorCanteen?.openingHours}
            </p>
          </div>
        </div>

        <div className="vendor-canteen-right-actions">
          <div className="vendor-terminal-status">
            <span className="terminal-live-dot"></span>
            <span>Live Kitchen Terminal Active</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar with Instant Visual Counts */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-icon stat-icon-orange">
            <ClockIcon size={22} />
          </div>
          <div>
            <div className="stat-label">Total Received</div>
            <div className="stat-value">{orders.length}</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: pendingApprovalCount > 0 ? "#f97316" : "" }}>
          <div className="stat-icon stat-icon-amber">
            <FlameIcon size={22} />
          </div>
          <div>
            <div className="stat-label">Awaiting Approval</div>
            <div className="stat-value" style={{ color: pendingApprovalCount > 0 ? "#ea580c" : "" }}>
              {pendingApprovalCount}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <ChefIcon size={22} />
          </div>
          <div>
            <div className="stat-label">In Kitchen Cooking</div>
            <div className="stat-value">{preparingCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <BellIcon size={22} />
          </div>
          <div>
            <div className="stat-label">Ready at Counter</div>
            <div className="stat-value">{readyCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            <span style={{ fontSize: "1.3rem", fontWeight: "800" }}>₹</span>
          </div>
          <div>
            <div className="stat-label">Paid Revenue</div>
            <div className="stat-value">₹{totalRevenue}</div>
          </div>
        </div>
      </div>

      {/* Flash Alert Banner */}
      {message.text && (
        <div className={`alert ${message.type === "success" ? "alert-success" : message.type === "info" ? "alert-info" : "alert-error"}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{message.text}</span>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}
            onClick={() => setMessage({ text: "", type: "" })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Switcher Navigation Tabs */}
      <div className="vendor-tabs-nav">
        <button
          className={`vendor-tab-btn ${activeVendorTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveVendorTab("orders")}
        >
          <ClockIcon size={16} />
          <span>Live Orders Console ({orders.length})</span>
          {pendingApprovalCount > 0 && (
            <span className="chip-pulse-badge" style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: "999px" }}>
              {pendingApprovalCount} AWAITING
            </span>
          )}
        </button>
        <button
          className={`vendor-tab-btn ${activeVendorTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveVendorTab("queue")}
        >
          <QueueIcon size={16} />
          <span>Live Queue Display Board</span>
        </button>
        <button
          className={`vendor-tab-btn ${activeVendorTab === "menu" ? "active" : ""}`}
          onClick={() => setActiveVendorTab("menu")}
        >
          <ChefIcon size={16} />
          <span>Menu Inventory Management ({menuItems.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE ORDERS CONSOLE (With KDS Card View, Accept/Decline, Search)
          ========================================================================= */}
      {activeVendorTab === "orders" && (
        <div>
          {/* Controls Bar: Search + Status Filter Chips + View Mode Switcher */}
          <div className="vendor-orders-controls-bar">
            {/* Search Input Row with Mobile "..." More Menu */}
            <div className="vendor-search-row-mobile-wrap">
              <div className="vendor-search-wrap">
                <span className="search-icon">
                  <SearchIcon size={16} />
                </span>
                <input
                  type="text"
                  className="vendor-search-input"
                  placeholder="Search Token (e.g. 127), Student, or Item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="vendor-clear-search-btn"
                    onClick={() => setSearchQuery("")}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Mobile "..." More Options Trigger */}
              <button
                type="button"
                className="btn-mobile-more-trigger"
                onClick={() => setIsMobileMoreOpen(true)}
                title="More actions, sales & filters"
                aria-label="More actions"
              >
                ⋯
              </button>
            </div>

            {/* Desktop Controls: Orders vs Sales Toggle & Refresh */}
            <div className="vendor-orders-desktop-controls">
              <div className="vendor-view-toggle-group">
                <button
                  type="button"
                  className={`btn-view-toggle ${ordersSubView === "orders" ? "active" : ""}`}
                  onClick={() => setOrdersSubView("orders")}
                  title="View Live Kitchen Orders"
                >
                  📋 Orders
                </button>
                <button
                  type="button"
                  className={`btn-view-toggle ${ordersSubView === "sales" ? "active" : ""}`}
                  onClick={() => setOrdersSubView("sales")}
                  title="View Item-wise Sales & Revenue for this Canteen"
                >
                  📊 Sales
                </button>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchOrders()}
                disabled={loadingOrders}
                title="Refresh queue manually"
              >
                <RefreshIcon size={14} />
                <span>{loadingOrders ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {ordersSubView === "orders" ? (
            <>
              {/* Status Filter Chips */}
              <div className="vendor-status-chips">
                <button
                  type="button"
                  className={`status-chip ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  <span>All Orders</span>
                  <span className="status-chip-count">{orders.length}</span>
                </button>

                <button
                  type="button"
                  className={`status-chip chip-pending ${statusFilter === "Pending Approval" || statusFilter === "Pending" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Pending Approval")}
                >
                  <span>⚡ Awaiting Approval</span>
                  <span className={`status-chip-count ${pendingApprovalCount > 0 ? "chip-pulse-badge" : ""}`}>
                    {pendingApprovalCount}
                  </span>
                </button>

                <button
                  type="button"
                  className={`status-chip ${statusFilter === "Accepted" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Accepted")}
                >
                  <span>✓ Accepted</span>
                  <span className="status-chip-count">{acceptedCount}</span>
                </button>

                <button
                  type="button"
                  className={`status-chip ${statusFilter === "Preparing" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Preparing")}
                >
                  <span>👨‍🍳 Cooking</span>
                  <span className="status-chip-count">{preparingCount}</span>
                </button>

                <button
                  type="button"
                  className={`status-chip ${statusFilter === "Ready" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Ready")}
                >
                  <span>🔔 Ready for Pickup</span>
                  <span className="status-chip-count">{readyCount}</span>
                </button>

                <button
                  type="button"
                  className={`status-chip ${statusFilter === "Completed" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Completed")}
                >
                  <span>✓ Handed Over</span>
                  <span className="status-chip-count">{completedCount}</span>
                </button>

                <button
                  type="button"
                  className={`status-chip ${statusFilter === "Rejected" || statusFilter === "Cancelled" ? "active" : ""}`}
                  onClick={() => setStatusFilter("Rejected")}
                >
                  <span>✕ Rejected</span>
                  <span className="status-chip-count">{rejectedCount}</span>
                </button>
              </div>

              {/* Empty State */}
              {filteredOrders.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🍽️</div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", color: "#0f172a" }}>
                    {searchQuery || statusFilter !== "all"
                      ? "No matching orders found"
                      : "No orders received yet"}
                  </h4>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                    {searchQuery || statusFilter !== "all"
                      ? "Try resetting filters or search query to view all orders."
                      : "New student orders will appear right here for your approval."}
                  </p>
                </div>
              ) : (
                /* =========================================================
                   KDS CARD VIEW (Kitchen Display System - Touch Friendly)
                   ========================================================= */
                <div className="vendor-kds-grid">
                  {filteredOrders.map((order) => {
                    const isPendingApproval = order.orderStatus === "Pending Approval" || (order.orderStatus === "Pending" && !order.tokenNumber);
                    const isAccepted = order.orderStatus === "Accepted";
                    const isPreparing = order.orderStatus === "Preparing";
                    const isReady = order.orderStatus === "Ready" || order.orderStatus === "Ready for Pickup";
                    const isMissed = order.orderStatus === "Missed Pickup";
                    const isCompleted = order.orderStatus === "Completed";
                    const isRejected = order.orderStatus === "Rejected" || order.orderStatus === "Cancelled";

                    const cardStatusClass = isPendingApproval
                      ? "status-pending-approval"
                      : isAccepted
                      ? "status-accepted"
                      : isPreparing
                      ? "status-preparing"
                      : isReady
                      ? "status-ready"
                      : isMissed
                      ? "status-missed"
                      : isRejected
                      ? "status-cancelled"
                      : "status-completed";

                    return (
                      <div key={order._id} className={`kds-card ${cardStatusClass}`}>
                        {/* Header */}
                        <div className="kds-card-header">
                          <div>
                            {order.tokenNumber ? (
                              <div className="kds-token-badge">#{order.tokenNumber}</div>
                            ) : (
                              <div className="kds-token-badge pending-approval" title="Token generated after vendor acceptance">
                                ⏳ AWAITING APPROVAL
                              </div>
                            )}
                            <div className="kds-order-id-sub" style={{ fontSize: "0.75rem", fontWeight: "700", color: "#475569", marginTop: "2px" }}>
                              Order #{String(order._id || "").slice(-6).toUpperCase()}
                            </div>
                            <span className="kds-time-ago">
                              Ordered {getTimeElapsed(order.createdAt)}
                            </span>
                          </div>
                          <div className="kds-meta-right">
                            <StatusBadge status={order.orderStatus} type="order" />
                            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                              {new Date(order.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="kds-card-body">
                          {/* Pickup Slot Banner */}
                          <div className="kds-slot-banner">
                            <span className="kds-slot-icon">🕒</span>
                            <div className="kds-slot-text">
                              <span className="kds-slot-label">Pickup Time Slot</span>
                              <strong className="kds-slot-value">{order.pickupSlot || "Next Available / ASAP"}</strong>
                            </div>
                          </div>

                          {/* Student info */}
                          <div className="kds-student-info">
                            <span className="kds-student-name">
                              👤 {order.studentName || "Student"}
                            </span>
                            {order.studentPhone && (
                              <span className="kds-student-phone">📞 {order.studentPhone}</span>
                            )}
                            {order.studentEmail && (
                              <span className="kds-student-email" style={{ fontSize: "0.72rem", color: "#64748b" }}>
                                ✉️ {order.studentEmail}
                              </span>
                            )}
                          </div>

                          {/* Items list */}
                          <div className="kds-items-list">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="kds-item-row">
                                <div className="kds-item-left">
                                  <img
                                    src={item.image || "/images/samosa.jpg"}
                                    alt={item.name}
                                    className="kds-item-img"
                                    onError={(e) => {
                                      e.target.src = "/images/samosa.jpg";
                                    }}
                                  />
                                  <span className="kds-item-name">{item.name}</span>
                                </div>
                                <span className="kds-item-qty">× {item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {/* Remarks / Special Notes */}
                          {order.remarks && (
                            <div className="kds-remarks-box">
                              <span>📝</span>
                              <div>
                                <strong>Student Note:</strong> {order.remarks}
                              </div>
                            </div>
                          )}

                          {/* Cancellation/Rejection Reason if Rejected */}
                          {isRejected && (order.rejectionReason || order.cancellationReason) && (
                            <div className="kds-cancellation-banner">
                              ✕ Reason: {order.rejectionReason || order.cancellationReason}
                            </div>
                          )}
                        </div>

                        {/* Footer with Billing & Action Buttons */}
                        <div className="kds-card-footer">
                          <div className="kds-billing-row">
                            <div>
                              <span style={{ fontSize: "0.74rem", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                                Total Bill
                              </span>
                              <span className="kds-total-amount">₹{order.totalAmount}</span>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{
                                  fontSize: "0.76rem",
                                  padding: "4px 10px",
                                  fontWeight: "800",
                                  color: order.paymentStatus === "Paid" ? "#16a34a" : "#dc2626",
                                  borderColor: order.paymentStatus === "Paid" ? "#86efac" : "#fca5a5",
                                  background: order.paymentStatus === "Paid" ? "#f0fdf4" : "#fef2f2"
                                }}
                                onClick={() => handleTogglePaymentStatus(order._id, order.paymentStatus)}
                                title="Click to toggle payment status"
                              >
                                {order.paymentStatus === "Paid" ? "✓ Paid" : `🔴 Unpaid (₹${order.totalAmount})`}
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons based on status */}
                          {isPendingApproval && (
                            <div className="kds-actions-grid two-cols">
                              <button
                                type="button"
                                className="btn-kds-accept"
                                onClick={() => handleAcceptOrder(order._id)}
                                title="Accept order and generate token number"
                              >
                                <CheckCircleIcon size={16} /> Accept Order
                              </button>
                              <button
                                type="button"
                                className="btn-kds-decline"
                                onClick={() => handleInitiateDecline(order)}
                                title="Reject order without token"
                              >
                                ✕ Reject Order
                              </button>
                            </div>
                          )}

                          {isAccepted && (
                            <div className="kds-actions-grid">
                              <button
                                type="button"
                                className="btn-kds-prepare"
                                onClick={() => handleUpdateOrderStatus(order._id, "Preparing")}
                                title="Start preparing food in kitchen"
                                style={{
                                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                                  color: "#ffffff",
                                  border: "none",
                                  padding: "10px 14px",
                                  borderRadius: "8px",
                                  fontWeight: "700",
                                  fontSize: "0.88rem",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "8px",
                                  cursor: "pointer",
                                  width: "100%",
                                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)"
                                }}
                              >
                                <ChefIcon size={16} /> Start Preparing
                              </button>
                            </div>
                          )}

                          {isPreparing && (
                            <div className="kds-actions-grid">
                              <button
                                type="button"
                                className="btn-kds-ready"
                                onClick={() => handleUpdateOrderStatus(order._id, "Ready for Pickup")}
                                title="Food cooked! Mark ready for student counter pickup"
                              >
                                <BellIcon size={16} /> Mark Ready for Pickup
                              </button>
                            </div>
                          )}

                          {isReady && (
                            <div className="kds-actions-grid two-cols">
                              <button
                                type="button"
                                className="btn-kds-verify"
                                style={{
                                  background: order.paymentStatus !== "Paid" ? "#dc2626" : "#ea580c"
                                }}
                                onClick={() => handleInitiateHandover(order)}
                                title={
                                  order.paymentStatus !== "Paid"
                                    ? `⚠️ Collect ₹${order.totalAmount} before handover!`
                                    : "Student at counter: verify PIN and complete handover"
                                }
                              >
                                <ShieldCheckIcon size={16} />
                                <span>
                                  {order.paymentStatus !== "Paid"
                                    ? `Collect ₹${order.totalAmount} & Handover`
                                    : "Verify PIN & Handover"}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.8rem", padding: "9px 8px" }}
                                onClick={() => handleUpdateOrderStatus(order._id, "Missed Pickup")}
                                title="Student didn't collect in time"
                              >
                                <AlertTriangleIcon size={13} /> Missed Pickup
                              </button>
                            </div>
                          )}

                          {isMissed && (
                            <div className="kds-actions-grid two-cols">
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleUpdateOrderStatus(order._id, "Ready for Pickup")}
                              >
                                <RefreshIcon size={13} /> Restore to Ready
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleInitiateDecline(order)}
                              >
                                ✕ Cancel Order
                              </button>
                            </div>
                          )}

                          {isCompleted && (
                            <div style={{ textAlign: "center", fontSize: "0.82rem", fontWeight: "700", color: "#16a34a", padding: "6px" }}>
                              ✓ Order Handed Over & Completed
                            </div>
                          )}

                          {isRejected && (
                            <div style={{ textAlign: "center", fontSize: "0.82rem", fontWeight: "700", color: "#dc2626", padding: "6px" }}>
                              ✕ Order Rejected by Kitchen (No Token)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* =========================================================
               IN-PAGE ITEM-WISE SALES BREAKDOWN (Today & Monthly)
               ========================================================= */
            <VendorItemSalesView
              orders={orders}
              selectedCanteen={selectedVendorCanteen}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE QUEUE DISPLAY MONITOR (For Canteen TV / Wall Screen)
          ========================================================================= */}
      {activeVendorTab === "queue" && (
        <div className="vendor-queue-container">
          <VendorLiveQueueBoard
            orders={orders}
            selectedCanteen={selectedVendorCanteen}
            onVendorAction={async (orderId, nextStatus) => {
              if (nextStatus === "Completed") {
                const targetOrder = orders.find((o) => o._id === orderId);
                if (targetOrder) {
                  handleInitiateHandover(targetOrder);
                  return;
                }
              }
              await handleUpdateOrderStatus(orderId, nextStatus);
            }}
            onRefresh={() => fetchOrders(selectedVendorCanteen, true)}
            loading={loadingOrders}
          />
        </div>
      )}

      {/* =========================================================================
          TAB 3: DYNAMIC MENU INVENTORY (Fast 1-Click Stock Toggle & Add Form)
          ========================================================================= */}
      {activeVendorTab === "menu" && (
        <div className="vendor-menu-section-container">
          {/* Top Sub-view Toggle Buttons: Add New vs Items List */}
          <div className="menu-subview-toggle-bar">
            <button
              type="button"
              className={`menu-subview-btn ${menuSubView === "add" ? "active" : ""}`}
              onClick={() => setMenuSubView("add")}
            >
              <PlusIcon size={16} />
              <span>+ Add New</span>
            </button>

            <button
              type="button"
              className={`menu-subview-btn ${menuSubView === "list" ? "active" : ""}`}
              onClick={() => setMenuSubView("list")}
            >
              <ChefIcon size={16} />
              <span>Items List ({displayedMenuItems.length})</span>
            </button>
          </div>

          {/* Sub-view 1: Add Item Dynamic Form */}
          {menuSubView === "add" && (
            <div className="card add-item-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                  <PlusIcon size={18} /> Add New Canteen Food Item
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMenuSubView("list")}
                  style={{ fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <ChefIcon size={14} /> View Items List ({displayedMenuItems.length})
                </button>
              </div>

            <form onSubmit={handleAddMenuItem} className="add-menu-form">
              <div className="form-grid-4">
                <div className="form-group">
                  <label className="form-label" htmlFor="itemNameInput">Food Name:</label>
                  <input
                    id="itemNameInput"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Masala Dosa or Momos"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="itemPriceInput">Price (₹):</label>
                  <input
                    id="itemPriceInput"
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 40"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category:</label>
                  <select
                    className="form-input"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                  >
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Custom">+ Add New Custom Category...</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Canteen (Current Hub):</label>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      color: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>{selectedVendorCanteen?.icon || "🏢"}</span>
                    <span>{selectedVendorCanteen?.shortName || selectedVendorCanteen?.name}</span>
                  </div>
                </div>
              </div>

              {/* Dietary Food Type: Pure Veg / Non-Veg / Egg */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", padding: "10px 14px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>Dietary Type:</span>
                <div style={{ display: "inline-flex", gap: "8px" }}>
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: newItemFoodType === "veg" ? "2px solid #16a34a" : "1px solid #cbd5e1",
                      background: newItemFoodType === "veg" ? "#f0fdf4" : "#ffffff",
                      color: newItemFoodType === "veg" ? "#166534" : "#64748b"
                    }}
                    onClick={() => setNewItemFoodType("veg")}
                  >
                    <span style={{ width: "12px", height: "12px", border: "1.5px solid #16a34a", borderRadius: "2px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                    </span>
                    <span>Pure Veg</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: newItemFoodType === "non-veg" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                      background: newItemFoodType === "non-veg" ? "#fef2f2" : "#ffffff",
                      color: newItemFoodType === "non-veg" ? "#991b1b" : "#64748b"
                    }}
                    onClick={() => setNewItemFoodType("non-veg")}
                  >
                    <span style={{ width: "12px", height: "12px", border: "1.5px solid #dc2626", borderRadius: "2px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                    </span>
                    <span>Non-Veg</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: newItemFoodType === "egg" ? "2px solid #d97706" : "1px solid #cbd5e1",
                      background: newItemFoodType === "egg" ? "#fffbeb" : "#ffffff",
                      color: newItemFoodType === "egg" ? "#92400e" : "#64748b"
                    }}
                    onClick={() => setNewItemFoodType("egg")}
                  >
                    <span style={{ width: "12px", height: "12px", border: "1.5px solid #d97706", borderRadius: "2px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
                    </span>
                    <span>Contains Egg</span>
                  </button>
                </div>
              </div>

              {newItemCategory === "Custom" && (
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label className="form-label">Type Custom Category Name:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Chinese Snacks or South Indian"
                    value={newItemCustomCategory}
                    onChange={(e) => setNewItemCustomCategory(e.target.value)}
                  />
                </div>
              )}

              {/* Dynamic Photo Upload / Online URL / Live Preview */}
              <div className="form-group" style={{ marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label className="form-label" style={{ margin: 0 }}>Item Image (Online URL or File Upload):</label>
                  {newItemImage && (
                    <button
                      type="button"
                      className="btn-link-clear"
                      onClick={() => {
                        setNewItemImage("");
                        setImageLoadError(false);
                      }}
                      title="Clear current photo"
                    >
                      Clear Image
                    </button>
                  )}
                </div>

                <div className="image-input-upload-row">
                  <div className="image-url-input-wrap">
                    <input
                      type="text"
                      className={`form-input ${imageLoadError ? "input-has-error" : ""}`}
                      placeholder="Paste online image link (https://...) or upload a file"
                      value={newItemImage}
                      onChange={(e) => {
                        setNewItemImage(e.target.value);
                        setImageLoadError(false);
                      }}
                    />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageFileUpload}
                  />

                  <button
                    type="button"
                    className="btn btn-secondary btn-upload-image"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    title="Choose an image file from your device"
                  >
                    <UploadIcon size={16} />
                    <span>{isUploadingImage ? "Uploading..." : "Upload Image"}</span>
                  </button>
                </div>

                {/* Real-time Image Render & Live Preview Card */}
                {newItemImage && newItemImage.trim() !== "" && (
                  <div className={`item-image-preview-card ${imageLoadError ? "has-error" : ""}`}>
                    <div className="preview-media-box">
                      {imageLoadError ? (
                        <div className="preview-error-placeholder">
                          <ImageIcon size={26} />
                          <span>Broken Link</span>
                        </div>
                      ) : (
                        <img
                          src={newItemImage}
                          alt="Food item preview"
                          className="preview-food-img"
                          onLoad={() => setImageLoadError(false)}
                          onError={() => setImageLoadError(true)}
                        />
                      )}
                    </div>

                    <div className="preview-meta-info">
                      <div className="preview-title-row">
                        <span className="preview-label">Live Image Preview</span>
                        {!imageLoadError && (
                          <span className="preview-badge-success">
                            <CheckCircleIcon size={13} /> Loaded & Ready
                          </span>
                        )}
                        {imageLoadError && (
                          <span className="preview-badge-error">
                            ⚠️ Unable to load
                          </span>
                        )}
                      </div>

                      <p className="preview-source-text">
                        {newItemImage.startsWith("data:") ? (
                          <span>📁 Uploaded from Device (Saved locally)</span>
                        ) : newItemImage.startsWith("http") ? (
                          <span className="text-truncate" title={newItemImage}>
                            🔗 Online Web Link: {newItemImage.length > 55 ? `${newItemImage.slice(0, 55)}...` : newItemImage}
                          </span>
                        ) : (
                          <span>🖼️ Preset Photo: {newItemImage}</span>
                        )}
                      </p>

                      {imageLoadError && (
                        <p className="preview-error-hint">
                          This URL failed to load. Make sure the link is a direct public image link (e.g. .jpg, .png) or click <strong>Upload Image</strong>.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Photos Preset Chips */}
                <div className="preset-photo-chips" style={{ marginTop: "12px" }}>
                  <span className="preset-label">Quick Photos:</span>
                  {PHOTO_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`preset-chip ${newItemImage === p.url ? "selected" : ""}`}
                      onClick={() => {
                        setNewItemImage(p.url);
                        setImageLoadError(false);
                      }}
                    >
                      <img src={p.url} alt={p.label} className="chip-img" />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label">Short Description (Optional):</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Freshly fried crispy hot samosa served with tamarind chutney"
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                />
              </div>

              <div className="form-actions-bar">
                <label className="available-toggle-label">
                  <input
                    type="checkbox"
                    checked={newItemAvailable}
                    onChange={(e) => setNewItemAvailable(e.target.checked)}
                  />
                  <span>Ready in Stock (Available)</span>
                </label>

                <button type="submit" className="btn btn-primary btn-submit-item">
                  <PlusIcon size={16} /> Add Food to Menu
                </button>
              </div>
            </form>
          </div>
          )}

          {/* Sub-view 2: Active Canteen Menu Table with Fast In-Stock/Out-of-Stock Toggle & Category Filters */}
          {menuSubView === "list" && (
            <div className="card">
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 className="card-title" style={{ margin: 0 }}>
                    Menu Inventory • {selectedVendorCanteen?.shortName || selectedVendorCanteen?.name} ({displayedMenuItems.length})
                  </h3>
                  <small style={{ color: "#64748b" }}>
                    1-Click instant Out-of-Stock toggle, bulk actions & full item editor
                  </small>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setMenuSubView("add")}
                    style={{ fontSize: "0.78rem", padding: "5px 12px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <PlusIcon size={14} /> + Add Item
                  </button>

                  {/* Bulk Stock Actions */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleBulkStockToggle("mark-all-available")}
                      disabled={bulkUpdating}
                      style={{ fontSize: "0.76rem", padding: "4px 10px", borderColor: "#16a34a", color: "#16a34a", fontWeight: 700 }}
                      title="Mark all menu items for this canteen as In Stock"
                    >
                      ✓ All In-Stock
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleBulkStockToggle("mark-all-soldout")}
                      disabled={bulkUpdating}
                      style={{ fontSize: "0.76rem", padding: "4px 10px", borderColor: "#dc2626", color: "#dc2626", fontWeight: 700 }}
                      title="Mark all menu items for this canteen as Sold Out (Closing)"
                    >
                      ✕ All Sold-Out
                    </button>
                  </div>

                  <input
                    type="text"
                    className="form-input"
                    placeholder="Filter menu items..."
                    style={{ width: "170px", padding: "6px 10px", fontSize: "0.85rem" }}
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={() => fetchMenu()} disabled={loadingMenu}>
                    <RefreshIcon size={14} /> Refresh
                  </button>
                </div>
              </div>

              {/* Category Filter Chips & Dietary Pills Toolbar */}
              <div className="vendor-menu-filters-toolbar" style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                {/* Category Pills */}
                <div className="vendor-category-pills-row" style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b" }}>Category:</span>
                <button
                  type="button"
                  onClick={() => setSelectedMenuCategory("all")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    background: selectedMenuCategory === "all" ? "#0f172a" : "#ffffff",
                    color: selectedMenuCategory === "all" ? "#ffffff" : "#475569",
                    border: "1px solid",
                    borderColor: selectedMenuCategory === "all" ? "#0f172a" : "#e2e8f0"
                  }}
                >
                  All ({menuItems.length})
                </button>
                {uniqueCategories.map((cat) => {
                  const count = menuItems.filter((m) => (m.category || "Hot Snacks") === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedMenuCategory(cat)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        background: selectedMenuCategory === cat ? "#0f172a" : "#ffffff",
                        color: selectedMenuCategory === cat ? "#ffffff" : "#475569",
                        border: "1px solid",
                        borderColor: selectedMenuCategory === cat ? "#0f172a" : "#e2e8f0"
                      }}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Dietary Filter Pills */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setSelectedFoodTypeFilter("all")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    border: "1px solid",
                    borderColor: selectedFoodTypeFilter === "all" ? "#0f172a" : "#e2e8f0",
                    background: selectedFoodTypeFilter === "all" ? "#0f172a" : "#ffffff",
                    color: selectedFoodTypeFilter === "all" ? "#ffffff" : "#64748b",
                    cursor: "pointer"
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFoodTypeFilter("veg")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    border: "1px solid",
                    borderColor: selectedFoodTypeFilter === "veg" ? "#16a34a" : "#bbf7d0",
                    background: selectedFoodTypeFilter === "veg" ? "#16a34a" : "#f0fdf4",
                    color: selectedFoodTypeFilter === "veg" ? "#ffffff" : "#166534",
                    cursor: "pointer"
                  }}
                >
                  🌱 Veg
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFoodTypeFilter("non-veg")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    border: "1px solid",
                    borderColor: selectedFoodTypeFilter === "non-veg" ? "#dc2626" : "#fecaca",
                    background: selectedFoodTypeFilter === "non-veg" ? "#dc2626" : "#fef2f2",
                    color: selectedFoodTypeFilter === "non-veg" ? "#ffffff" : "#991b1b",
                    cursor: "pointer"
                  }}
                >
                  🍗 Non-Veg
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFoodTypeFilter("egg")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    border: "1px solid",
                    borderColor: selectedFoodTypeFilter === "egg" ? "#d97706" : "#fed7aa",
                    background: selectedFoodTypeFilter === "egg" ? "#d97706" : "#fffbeb",
                    color: selectedFoodTypeFilter === "egg" ? "#ffffff" : "#92400e",
                    cursor: "pointer"
                  }}
                >
                  🥚 Egg
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>Item Photo & Name</th>
                    <th>Category</th>
                    <th>Canteen Hub</th>
                    <th>Price</th>
                    <th>Stock Status (1-Click Toggle)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMenuItems.map((item) => {
                    const itemPriceAtCanteen = getItemPriceForCanteen(item, selectedVendorCanteen);
                    const isAvailAtCanteen = isItemAvailableAtCanteen(item, selectedVendorCanteen);
                    const itemFoodType = item.foodType || (item.isVeg === false ? "non-veg" : "veg");

                    return (
                      <tr key={item._id}>
                        <td>
                          <div className="table-item-with-img">
                            <img
                              src={item.image || "/images/samosa.jpg"}
                              alt={item.name}
                              className="table-item-img"
                              onError={(e) => {
                                e.target.src = "/images/samosa.jpg";
                              }}
                            />
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {itemFoodType === "veg" && (
                                  <span title="Pure Vegetarian" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", border: "1.5px solid #16a34a", borderRadius: "3px", background: "#ffffff", flexShrink: 0 }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
                                  </span>
                                )}
                                {itemFoodType === "non-veg" && (
                                  <span title="Non-Vegetarian" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", border: "1.5px solid #dc2626", borderRadius: "3px", background: "#ffffff", flexShrink: 0 }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                                  </span>
                                )}
                                {itemFoodType === "egg" && (
                                  <span title="Contains Egg" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", border: "1.5px solid #d97706", borderRadius: "3px", background: "#ffffff", flexShrink: 0 }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
                                  </span>
                                )}
                                <strong className="table-item-title">{item.name}</strong>
                              </div>
                              {item.description && (
                                <div className="table-item-desc">{item.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="table-cat-badge">
                            {item.category || "Hot Snacks"}
                          </span>
                        </td>
                        <td>
                          <span className="canteen-tag-pill" style={{ fontSize: "0.74rem", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "4px 8px", borderRadius: "6px", fontWeight: "600", color: "#334155", display: "inline-block", whiteSpace: "nowrap" }}>
                            {selectedVendorCanteen?.shortName || item.canteenName || selectedVendorCanteen?.name || "34 Block Food Court"}
                          </span>
                        </td>
                        <td>
                          <div className="price-display-wrap">
                            <strong className="table-price">₹{itemPriceAtCanteen}</strong>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`stock-toggle-btn ${isAvailAtCanteen ? "in-stock" : "out-stock"}`}
                            onClick={() => handleToggleAvailability(item)}
                            title="Click to toggle stock status instantly"
                          >
                            <span>{isAvailAtCanteen ? "● In Stock" : "○ Sold Out"}</span>
                          </button>
                        </td>
                        <td>
                          <div className="table-item-actions" style={{ display: "flex", gap: "6px" }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingMenuItem(item);
                                setIsEditModalOpen(true);
                              }}
                              title="Edit Item Details (Name, Price, Category, Photo, Veg/Non-Veg)"
                              style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                            >
                              <EditIcon size={14} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteMenuItem(item._id, item.name)}
                              title="Delete Item"
                              style={{ padding: "4px 8px" }}
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Secure Pickup Handover Modal with Unpaid Protection & 1-Click Collection */}
      <SecureHandoverModal
        isOpen={isHandoverModalOpen}
        order={selectedHandoverOrder}
        onClose={() => {
          setIsHandoverModalOpen(false);
          setSelectedHandoverOrder(null);
        }}
        onConfirmHandover={handleConfirmSecureHandover}
        onMarkPaymentPaid={async (orderId) => {
          await handleTogglePaymentStatus(orderId, "Pending");
          setSelectedHandoverOrder((prev) => (prev ? { ...prev, paymentStatus: "Paid" } : null));
        }}
        onCallOut={async (orderId) => {
          await fetch(`/api/orders/${orderId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callOut: true })
          });
          fetchOrders(selectedVendorCanteen, true);
        }}
      />

      {/* Decline Order Modal */}
      <DeclineOrderModal
        isOpen={isDeclineModalOpen}
        order={selectedDeclineOrder}
        onClose={() => {
          setIsDeclineModalOpen(false);
          setSelectedDeclineOrder(null);
        }}
        onConfirmDecline={handleConfirmDeclineOrder}
      />

      {/* Full Edit Menu Item Modal */}
      <EditMenuItemModal
        isOpen={isEditModalOpen}
        item={editingMenuItem}
        selectedCanteen={selectedVendorCanteen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingMenuItem(null);
        }}
        onSave={() => {
          fetchMenu();
          setMessage({ text: "✓ Menu item updated successfully!", type: "success" });
        }}
      />

      {/* Mobile Floating Bottom Navigation Pill (Icons only, no names) */}
      <nav className="mobile-vendor-bottom-pill-bar" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-pill-item ${activeVendorTab === "orders" && ordersSubView === "orders" ? "active" : ""}`}
          onClick={() => {
            setActiveVendorTab("orders");
            setOrdersSubView("orders");
          }}
          title="Live Kitchen Orders"
          aria-label="Live Kitchen Orders"
        >
          <ClockIcon size={20} />
          {pendingCount > 0 && (
            <span className="mobile-pill-badge">{pendingCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`mobile-pill-item ${activeVendorTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveVendorTab("queue")}
          title="Live Queue Display Board"
          aria-label="Live Queue Display Board"
        >
          <QueueIcon size={20} />
        </button>

        <button
          type="button"
          className={`mobile-pill-item ${activeVendorTab === "menu" ? "active" : ""}`}
          onClick={() => setActiveVendorTab("menu")}
          title="Menu Inventory"
          aria-label="Menu Inventory"
        >
          <ChefIcon size={20} />
        </button>

        <button
          type="button"
          className={`mobile-pill-item ${activeVendorTab === "orders" && ordersSubView === "sales" ? "active" : ""}`}
          onClick={() => {
            setActiveVendorTab("orders");
            setOrdersSubView("sales");
          }}
          title="Sales & Revenue"
          aria-label="Sales & Revenue"
        >
          <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>📊</span>
        </button>

        <button
          type="button"
          className={`mobile-pill-item ${isMobileMoreOpen ? "active" : ""}`}
          onClick={() => setIsMobileMoreOpen(true)}
          title="More Console Options"
          aria-label="More Console Options"
        >
          <span style={{ fontSize: "1.25rem", lineHeight: 1, fontWeight: "900", letterSpacing: "-1px" }}>⋯</span>
        </button>
      </nav>

      {/* Mobile Overflow "..." Sheet */}
      <MobileVendorMoreSheet
        isOpen={isMobileMoreOpen}
        onClose={() => setIsMobileMoreOpen(false)}
        onSelectSales={() => {
          setActiveVendorTab("orders");
          setOrdersSubView("sales");
        }}
        onSelectFilter={(status) => {
          setActiveVendorTab("orders");
          setOrdersSubView("orders");
          setStatusFilter(status);
        }}
        onRefresh={() => fetchOrders(selectedVendorCanteen, true)}
        completedCount={completedCount}
        cancelledCount={cancelledCount}
        selectedCanteen={selectedVendorCanteen}
        onExit={onExitToHome}
      />
    </div>
  );
}
