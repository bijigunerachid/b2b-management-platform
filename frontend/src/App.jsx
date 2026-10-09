import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider, ToastProvider } from "./components/ui/feedback";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { PageFallback } from "./components/PageFallback";

// Pages load on demand so the first visit only downloads what it shows.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const Products = lazy(() => import("./pages/Products"));
const Categories = lazy(() => import("./pages/Categories"));
const Orders = lazy(() => import("./pages/Orders"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Receivables = lazy(() => import("./pages/Receivables"));
const Users = lazy(() => import("./pages/Users"));
const Invoice = lazy(() => import("./pages/Invoice"));
const QuoteDocument = lazy(() => import("./pages/QuoteDocument"));

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <ConfirmProvider>
                    <AuthProvider>
                        <Suspense fallback={<PageFallback fullScreen />}>
                        <Routes>
                            <Route path="/login" element={<Login />} />

                            <Route element={<ProtectedRoute />}>
                                {/* Full-page document, outside the app shell so it prints cleanly. */}
                                <Route path="/orders/:id/invoice" element={<Invoice />} />
                                <Route path="/quotes/:id/print" element={<QuoteDocument />} />

                                <Route element={<Layout />}>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/customers" element={<Customers />} />
                                    <Route path="/products" element={<Products />} />
                                    <Route path="/categories" element={<Categories />} />
                                    <Route path="/orders" element={<Orders />} />
                                    <Route path="/receivables" element={<Receivables />} />
                                    <Route path="/quotes" element={<Quotes />} />
                                    <Route
                                        path="/users"
                                        element={<ProtectedRoute roles={["Admin"]} />}
                                    >
                                        <Route index element={<Users />} />
                                    </Route>
                                </Route>
                            </Route>

                            <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                    </AuthProvider>
                </ConfirmProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}
