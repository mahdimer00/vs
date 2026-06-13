import { createBrowserRouter } from "react-router-dom";
import { App } from "@/app/App";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminLoginPage } from "@/pages/AdminLoginPage";
import { AffiliateDashboardPage } from "@/pages/AffiliateDashboardPage";
import { AffiliateLoginPage } from "@/pages/AffiliateLoginPage";
import { AffiliateRegisterPage } from "@/pages/AffiliateRegisterPage";
import { CartPage } from "@/pages/CartPage";
import { CategoriesPage } from "@/pages/CategoriesPage";
import { CheckoutConfirmationPage } from "@/pages/CheckoutConfirmationPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { ContactPage } from "@/pages/ContactPage";
import { EarnMoneyPage } from "@/pages/EarnMoneyPage";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OrderSuccessPage } from "@/pages/OrderSuccessPage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { ProductDetailsPage } from "@/pages/ProductDetailsPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ReturnPolicyPage } from "@/pages/ReturnPolicyPage";
import { TermsPage } from "@/pages/TermsPage";
import { TrackOrderPage } from "@/pages/TrackOrderPage";
import { WishlistPage } from "@/pages/WishlistPage";

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
      { path: "admin/login", element: <AdminLoginPage /> },
      {
        path: "admin",
        element: (
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER"]} area="admin">
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/*",
        element: (
          <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER"]} area="admin">
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
