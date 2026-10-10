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
const Pricing = lazy(() => import("./pages/Pricing"));
const Reports = lazy(() => import("./pages/Reports"));
const Forecast = lazy(() => import("./pages/Forecast"));
const PaymentRisk = lazy(() => import("./pages/PaymentRisk"));
const Recommendations = lazy(() => import("./pages/Recommendations"));
const Emails = lazy(() => import("./pages/Emails"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Orders = lazy(() => import("./pages/Orders"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Receivables = lazy(() => import("./pages/Receivables"));
const CreditNotes = lazy(() => import("./pages/CreditNotes"));
const CreditNoteDocument = lazy(() => import("./pages/CreditNoteDocument"));
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
const PortalCreditNote = lazy(() => import("./portal/pages/PortalDocuments").then((module) => ({ default: module.PortalCreditNote })));

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
                                <Route path="/orders/:id/invoice" element={<ProtectedRoute permission="orders.view"><Invoice /></ProtectedRoute>} />
                                <Route path="/quotes/:id/print" element={<ProtectedRoute permission="quotes.view"><QuoteDocument /></ProtectedRoute>} />
                                <Route path="/credit-notes/:id/print" element={<ProtectedRoute permission="payments.view"><CreditNoteDocument /></ProtectedRoute>} />

                                <Route element={<Layout />}>
                                    <Route path="/" element={<ProtectedRoute permission="dashboard.view"><Dashboard /></ProtectedRoute>} />
                                    <Route path="/customers" element={<ProtectedRoute permission="customers.view"><Customers /></ProtectedRoute>} />
                                    <Route path="/products" element={<ProtectedRoute permission="products.view"><Products /></ProtectedRoute>} />
                                    <Route path="/categories" element={<ProtectedRoute permission="products.view"><Categories /></ProtectedRoute>} />
                                    <Route path="/pricing" element={<ProtectedRoute permission="pricing.view"><Pricing /></ProtectedRoute>} />
                                    <Route path="/orders" element={<ProtectedRoute permission="orders.view"><Orders /></ProtectedRoute>} />
                                    <Route path="/receivables" element={<ProtectedRoute permission="payments.view"><Receivables /></ProtectedRoute>} />
                                    <Route path="/credit-notes" element={<ProtectedRoute permission="payments.view"><CreditNotes /></ProtectedRoute>} />
                                    <Route path="/quotes" element={<ProtectedRoute permission="quotes.view"><Quotes /></ProtectedRoute>} />
                                    <Route path="/inventory" element={<ProtectedRoute permission="inventory.view"><Inventory /></ProtectedRoute>} />
                                    <Route path="/purchase-orders" element={<ProtectedRoute permission="inventory.view"><PurchaseOrders /></ProtectedRoute>} />
                                    <Route path="/suppliers" element={<ProtectedRoute permission="inventory.view"><Suppliers /></ProtectedRoute>} />
                                    <Route path="/reports" element={<ProtectedRoute permission="reports.view"><Reports /></ProtectedRoute>} />
                                    <Route path="/forecast" element={<ProtectedRoute permission="reports.view"><Forecast /></ProtectedRoute>} />
                                    <Route path="/payment-risk" element={<ProtectedRoute permission="reports.view"><PaymentRisk /></ProtectedRoute>} />
                                    <Route path="/recommendations" element={<ProtectedRoute permission="reports.view"><Recommendations /></ProtectedRoute>} />
                                    <Route path="/emails" element={<ProtectedRoute permission="emails.view"><Emails /></ProtectedRoute>} />
                                    <Route path="/audit" element={<ProtectedRoute permission="audit.view"><AuditLog /></ProtectedRoute>} />
                                    <Route path="/users" element={<ProtectedRoute permission="users.manage"><Users /></ProtectedRoute>} />
                                </Route>
                            </Route>

                            <Route element={<ProtectedRoute area="portal" />}>
                                <Route path="/portal/orders/:id/invoice" element={<PortalInvoice />} />
                                <Route path="/portal/quotes/:id/print" element={<PortalQuoteDocument />} />
                                <Route path="/portal/credit-notes/:id/print" element={<PortalCreditNote />} />
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
