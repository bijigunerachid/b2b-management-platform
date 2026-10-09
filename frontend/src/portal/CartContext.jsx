/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const CartContext = createContext(null);
const MAX_LINES = 50;

function storageKey(userId) {
  return `b2b-portal-cart-${userId}`;
}

function readCart(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) || "[]");
    return Array.isArray(saved) ? saved.filter((line) => line && Number.isInteger(line.product_id) && line.quantity > 0) : [];
  } catch {
    return [];
  }
}

/**
 * The client's cart, kept per user in this browser so it survives a refresh.
 * Prices shown are indicative; the server prices the order when placed.
 */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const [lines, setLines] = useState(() => (user ? readCart(user.id) : []));
  const [open, setOpen] = useState(false);

  // Reload when a different user signs in on this browser.
  const [loadedFor, setLoadedFor] = useState(user?.id ?? null);
  if ((user?.id ?? null) !== loadedFor) {
    setLoadedFor(user?.id ?? null);
    setLines(user ? readCart(user.id) : []);
  }

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify(lines));
    } catch {
      // The cart still works for this session.
    }
  }, [lines, user]);

  const add = useCallback((product, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((line) => line.product_id === product.id);
      if (existing) {
        return current.map((line) => (line.product_id === product.id ? { ...line, quantity: Math.min(100000, line.quantity + quantity) } : line));
      }
      if (current.length >= MAX_LINES) return current;
      return [...current, { product_id: product.id, name: product.name, price: Number(product.price), quantity }];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setLines((current) =>
      quantity < 1
        ? current.filter((line) => line.product_id !== productId)
        : current.map((line) => (line.product_id === productId ? { ...line, quantity: Math.min(100000, quantity) } : line))
    );
  }, []);

  const remove = useCallback((productId) => setLines((current) => current.filter((line) => line.product_id !== productId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const units = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = Math.round(lines.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100;
    return { lines, units, subtotal, add, setQuantity, remove, clear, open, setOpen, full: lines.length >= MAX_LINES };
  }, [lines, add, setQuantity, remove, clear, open]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
