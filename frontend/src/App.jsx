
import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Orders from "./pages/Orders";
import Users from "./pages/Users";
function NotFound() {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold">404</h1>
            <p className="mt-2 text-slate-500">
                The page you requested was not found.
            </p>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout />}>
                            <Route
                                path="/"
                                element={<Dashboard />}
                            />
                            <Route 
                                path="customers" 
                                element={<Customers />} 
                            />
                            <Route
                                path="/products"
                                element={<Products />}
                            />
                            <Route
                                path="/categories"
                                element={<Categories />}
                            />
                            <Route
                                path="/orders"
                                element={<Orders />}
                            />
                            <Route
                                path="/users"
                                element={<Users />}
                            />
                        </Route>
                    </Route>

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}