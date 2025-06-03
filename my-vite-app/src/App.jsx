import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider, useSelector, useDispatch } from 'react-redux';
import store from './redux/store';
import Signup from './pages/Signup';
import Signin from './pages/Signin';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPasswordPage from './pages/ForgetPass';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import { DoctorSlotsPage, BookAppointmentPage } from './pages/Components/PatientComponents.jsx';
import {
  verifyTokenStart,
  verifyTokenSuccess,
  verifyTokenFailure,
  logout,
} from './redux/slices/authSlice';
import AvailabilityContext from './context/AvailabilityContext';
import ErrorBoundary from './pages/Components/ErrorBoundary.jsx';

// ProtectedRoute
// App.jsx
function ProtectedRoute({ children, allowedRole }) {
  const dispatch = useDispatch();
  const { isAuthenticated, role: reduxRole } = useSelector((state) => state.auth);
  const [userRole, setUserRole] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const verifyToken = async () => {
      const token = localStorage.getItem("token");
      console.log("[ProtectedRoute] Verifying token for path:", window.location.pathname, "token:", token?.slice(0, 20) + "...");
      if (!token) {
        console.log("[ProtectedRoute] No token, will redirect to signin");
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        dispatch(verifyTokenStart());
        const endpoint = `http://localhost:5000/api/${allowedRole}/user`;
        console.log("[ProtectedRoute] Fetching:", endpoint);
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        console.log("[ProtectedRoute] Response:", { status: response.status, data });

        if (isMounted) {
          if (response.ok && data.role === allowedRole) {
            console.log("[ProtectedRoute] Success:", { role: data.role });
            setUserRole(data.role);
            dispatch(
              verifyTokenSuccess({
                user: data,
                role: data.role,
                isEmailVerified: data.isEmailVerified || false,
              })
            );
          } else {
            console.error("[ProtectedRoute] Failed:", {
              message: data.message || "Invalid response",
              status: response.status,
            });
            setUserRole(null);
          }
        }
      } catch (err) {
        console.error("[ProtectedRoute] Error:", { message: err.message });
        setUserRole(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [dispatch, allowedRole]);

  if (isLoading) {
    console.log("[ProtectedRoute] Loading for:", window.location.pathname);
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated || !userRole || userRole !== allowedRole) {
    console.log("[ProtectedRoute] Authentication failed, redirecting to /auth/signin", {
      isAuthenticated,
      userRole,
      requiredRole: allowedRole,
      path: window.location.pathname,
    });
    // Delay redirect to catch logs
    setTimeout(() => {
      dispatch(logout());
      window.location.href = "/auth/signin"; // Force full redirect to ensure logs are visible
    }, 1000);
    return <div>Redirecting to signin...</div>;
  }

  console.log("[ProtectedRoute] Rendering children for:", window.location.pathname);
  return children;
}

// AuthRedirect
function AuthRedirect({ children }) {
  const { pathname } = useLocation();
  const { isAuthenticated, role } = useSelector((state) => state.auth);

  console.log("[AuthRedirect] Checking:", {
    pathname,
    isAuthenticated,
    role,
    token: localStorage.getItem("token")?.slice(0, 20) + "..." || "none",
    timestamp: new Date().toISOString(),
  });

  if (isAuthenticated && role && pathname.startsWith('/auth')) {
    console.log("[AuthRedirect] Authenticated user on auth route, redirecting:", { role });
    const redirectTo = role === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  console.log("[AuthRedirect] Rendering children");
  return children;
}

// RedirectHandler
// RedirectHandler
// App.jsx
function RedirectHandler() {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const { isAuthenticated, role } = useSelector((state) => state.auth);

  console.log("[RedirectHandler] Processing:", {
    path,
    isAuthenticated,
    role,
    timestamp: new Date().toISOString(),
  });

  if (path === "/doctor-dashboard" || path === "/doctor-dashboard/") {
    console.log("[RedirectHandler] Exact match for /doctor-dashboard");
    return (
      <ProtectedRoute allowedRole="doctor">
        <DoctorDashboard />
      </ProtectedRoute>
    );
  }
  if (path.startsWith("/doctor-dashboard/appointment")) {
    console.log("[RedirectHandler] Handling /doctor-dashboard/appointment/*");
    return (
      <ProtectedRoute allowedRole="doctor">
        <DoctorDashboard />
      </ProtectedRoute>
    );
  }
  if (path === "/patient-dashboard" || path === "/patient-dashboard/") {
    console.log("[RedirectHandler] Exact match for /patient-dashboard");
    return (
      <ProtectedRoute allowedRole="patient">
        <PatientDashboard />
      </ProtectedRoute>
    );
  }
  if (path.startsWith("/patient-dashboard/appointments")) {
    console.log("[RedirectHandler] Handling /patient-dashboard/appointments/*");
    return (
      <ProtectedRoute allowedRole="patient">
        <PatientDashboard />
      </ProtectedRoute>
    );
  }

  if (path.startsWith("/doctor-dashboard")) {
    console.log("[RedirectHandler] Path starts with /doctor-dashboard, redirecting to /doctor-dashboard");
    return <Navigate to="/doctor-dashboard" replace />;
  }
  if (path.startsWith("/patient-dashboard")) {
    console.log("[RedirectHandler] Path starts with /patient-dashboard, redirecting to /patient-dashboard");
    return <Navigate to="/patient-dashboard" replace />;
  }

  if (isAuthenticated && role) {
    const redirectTo = role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";
    console.log("[RedirectHandler] Authenticated user with invalid path, redirecting to:", redirectTo);
    return <Navigate to={redirectTo} replace />;
  }

  console.log("[RedirectHandler] Unauthenticated or no role, redirecting to /auth/signin");
  return <Navigate to="/auth/signin" replace />;
}

// Inner App component
function InnerApp() {
  const { isAuthenticated, role, user } = useSelector((state) => state.auth);
  const availability = user?.availability || { startTime: "", endTime: "", days: [] };

  console.log("[InnerApp] Rendering:", {
    isAuthenticated,
    role,
    path: window.location.pathname,
    timestamp: new Date().toISOString(),
  });

  return (
    <AvailabilityContext.Provider value={{ availability, dispatch: store.dispatch }}>
      <AuthRedirect>
        <Routes>
          <Route path="/auth/signin" element={<Signin />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/forgetpass" element={<ForgotPasswordPage />} />
          <Route path="/doctor-dashboard/*" element={<RedirectHandler />} />
          <Route path="/patient-dashboard/*" element={<RedirectHandler />} />
          <Route
            path="/doctor/:id/slots"
            element={
              <ProtectedRoute allowedRole="patient">
                <DoctorSlotsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book-appointment/:doctorId"
            element={
              <ProtectedRoute allowedRole="patient">
                <ErrorBoundary>
                  <BookAppointmentPage />
                </ErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route path="/book-appointment" element={<Navigate to="/patient-dashboard" replace />} />
          <Route path="/" element={<Navigate to="/auth/signup" replace />} />
          <Route path="*" element={<RedirectHandler />} />
          <Route
            path="/debug"
            element={
              <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-2xl">Debug: App is rendering</h1>
              </div>
            }
          />
        </Routes>
      </AuthRedirect>
    </AvailabilityContext.Provider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <InnerApp />
    </Provider>
  );
}