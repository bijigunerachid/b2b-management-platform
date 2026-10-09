import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider, ToastProvider } from "./components/ui/feedback";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { PageFallback } from "./components/PageFallback";

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
const Inventory = lazy(() => import("./pages/Inventory"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const Suppliers = lazy(() => import("./pages/Suppliers"));

const PortalLayout = lazy(() => import("./portal/PortalLayout"));
const PortalHome = lazy(() => import("./portal/pages/PortalHome"));
const PortalCatalog = lazy(() => import("./portal/pages/PortalCatalog"));
const PortalOrders = lazy(() => import("./portal/pages/PortalOrders"));
const PortalQuotes = lazy(() => import("./portal/pages/PortalQuotes"));
const PortalAccount = lazy(() => import("./portal/pages/PortalAccount"));
const PortalInvoice = lazy(() => import("./portal/pages/PortalDocuments").then((module) => ({ default: module.PortalInvoice })));
const PortalQuoteDocument = lazy(() => import("./portal/pages/PortalDocuments").then((module) => ({ default: module.PortalQuoteDocument })));

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
                                    <Route path="/inventory" element={<Inventory />} />
                                    <Route path="/purchase-orders" element={<PurchaseOrders />} />
                                    <Route path="/suppliers" element={<Suppliers />} />
                                    <Route
                                        path="/users"
                                        element={<ProtectedRoute roles={["Admin"]} />}
                                    >
                                        <Route index element={<Users />} />
                                    </Route>
                                </Route>
                            </Route>

                            <Route element={<ProtectedRoute area="portal" />}>
                                <Route path="/portal/orders/:id/invoice" element={<PortalInvoice />} />
                                <Route path="/portal/quotes/:id/print" element={<PortalQuoteDocument />} />
                                <Route path="/portal" element={<PortalLayout />}>
                                    <Route index element={<PortalHome />} />
                                    <Route path="catalog" element={<PortalCatalog />} />
                                    <Route path="orders" element={<PortalOrders />} />
                                    <Route path="quotes" element={<PortalQuotes />} />
                                    <Route path="account" element={<PortalAccount />} />
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
