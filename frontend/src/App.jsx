import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider, ToastProvider } from "./components/ui/feedback";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import Users from "./pages/Users";
import NotFound from "./pages/NotFound";
import Invoice from "./pages/Invoice";
import Receivables from "./pages/Receivables";

export default function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <ConfirmProvider>
                    <AuthProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />

                            <Route element={<ProtectedRoute />}>
                                {/* Full-page document, outside the app shell so it prints cleanly. */}
                                <Route path="/orders/:id/invoice" element={<Invoice />} />

                                <Route element={<Layout />}>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/customers" element={<Customers />} />
                                    <Route path="/products" element={<Products />} />
                                    <Route path="/categories" element={<Categories />} />
                                    <Route path="/orders" element={<Orders />} />
                                    <Route path="/receivables" element={<Receivables />} />
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
                    </AuthProvider>
                </ConfirmProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}
