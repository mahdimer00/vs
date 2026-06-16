import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { App } from "@/app/App";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage })));
const AdminLoginPage = lazy(() => import("@/pages/AdminLoginPage").then((module) => ({ default: module.AdminLoginPage })));
const AffiliateDashboardPage = lazy(() => import("@/pages/AffiliateDashboardPage").then((module) => ({ default: module.AffiliateDashboardPage })));
const AffiliateLoginPage = lazy(() => import("@/pages/AffiliateLoginPage").then((module) => ({ default: module.AffiliateLoginPage })));
const AffiliateRegisterPage = lazy(() => import("@/pages/AffiliateRegisterPage").then((module) => ({ default: module.AffiliateRegisterPage })));
const CartPage = lazy(() => import("@/pages/CartPage").then((module) => ({ default: module.CartPage })));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage").then((module) => ({ default: module.CategoriesPage })));
const CheckoutConfirmationPage = lazy(() => import("@/pages/CheckoutConfirmationPage").then((module) => ({ default: module.CheckoutConfirmationPage })));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));
const ContactPage = lazy(() => import("@/pages/ContactPage").then((module) => ({ default: module.ContactPage })));
const EarnMoneyPage = lazy(() => import("@/pages/EarnMoneyPage").then((module) => ({ default: module.EarnMoneyPage })));
const OrderSuccessPage = lazy(() => import("@/pages/OrderSuccessPage").then((module) => ({ default: module.OrderSuccessPage })));
const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage").then((module) => ({ default: module.PrivacyPolicyPage })));
const ProductDetailsPage = lazy(() => import("@/pages/ProductDetailsPage").then((module) => ({ default: module.ProductDetailsPage })));
const ProductsPage = lazy(() => import("@/pages/ProductsPage").then((module) => ({ default: module.ProductsPage })));
const ReturnPolicyPage = lazy(() => import("@/pages/ReturnPolicyPage").then((module) => ({ default: module.ReturnPolicyPage })));
const TermsPage = lazy(() => import("@/pages/TermsPage").then((module) => ({ default: module.TermsPage })));
const TrackOrderPage = lazy(() => import("@/pages/TrackOrderPage").then((module) => ({ default: module.TrackOrderPage })));
const WishlistPage = lazy(() => import("@/pages/WishlistPage").then((module) => ({ default: module.WishlistPage })));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "products/:slug", element: <ProductDetailsPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "wishlist", element: <WishlistPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "checkout/confirm", element: <CheckoutConfirmationPage /> },
      { path: "order/success", element: <OrderSuccessPage /> },
      { path: "track-order", element: <TrackOrderPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "earn-money", element: <EarnMoneyPage /> },
      { path: "privacy-policy", element: <PrivacyPolicyPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "return-policy", element: <ReturnPolicyPage /> },
      { path: "gestion-secure", element: <AdminLoginPage /> },
      {
        path: "gestion",
        element: (
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "SUB_ADMIN"]} area="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "gestion/*",
        element: (
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "SUB_ADMIN"]} area="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },
      { path: "affiliate/login", element: <AffiliateLoginPage /> },
      { path: "affiliate/register", element: <AffiliateRegisterPage /> },
      {
        path: "affiliate",
        element: (
          <ProtectedRoute roles={["AFFILIATE"]} area="affiliate">
            <AffiliateDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "affiliate/*",
        element: (
          <ProtectedRoute roles={["AFFILIATE"]} area="affiliate">
            <AffiliateDashboardPage />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
