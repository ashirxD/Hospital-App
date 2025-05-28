import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  loginStart,
  loginSuccess,
  loginFailure,
  verifyOtpSuccess,
  verifyOtpFailure,
  resendOtpStart,
  resendOtpSuccess,
  resendOtpFailure,
  resetAuthState,
} from "../redux/slices/authSlice";

export default function Signin() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    otp: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [rememberMe, setRememberMe] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showSigninOtpInput, pendingToken, loading, error } = useSelector((state) => state.auth);

  // Reset auth state on page load
  useEffect(() => {
    dispatch(resetAuthState());
    setTimeLeft(600);
  }, [dispatch]);

  // Timer effect
  useEffect(() => {
    if (!showSigninOtpInput || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showSigninOtpInput, timeLeft]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && name === "rememberMe") {
      setRememberMe(checked);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!showSigninOtpInput && !formData.password) {
      newErrors.password = "Password is required";
    }

    if (showSigninOtpInput && !formData.otp) {
      newErrors.otp = "OTP is required";
    } else if (showSigninOtpInput && !/^\d{6}$/.test(formData.otp)) {
      newErrors.otp = "OTP must be a 6-digit number";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    console.log("[Signin] Form submitted:", { formData, validationErrors });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      if (!showSigninOtpInput) {
        console.log("[Signin] Sending sign-in request:", { email: formData.email });
        dispatch(loginStart());
        const response = await fetch("http://localhost:5000/api/auth/signin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });

        const data = await response.json();
        console.log("[Signin] Sign-in response:", { status: response.status, data });

        if (!response.ok) {
          dispatch(loginFailure(data.message || "Sign in failed"));
          setErrors({ server: data.message || "Sign in failed" });
          return;
        }

        if (data.token) {
          const userRole = data.role || (data.user && data.user.role);
          if (!userRole) {
            dispatch(loginFailure("Invalid response: missing role"));
            setErrors({ server: "Invalid response from server: missing role" });
            return;
          }
          localStorage.setItem("token", data.token);
          console.log("[Signin] Token stored:", {
            token: data.token,
            role: userRole,
            email: formData.email,
          });
          dispatch(
            loginSuccess({
              user: data.user || data,
              role: userRole,
              isEmailVerified: data.isEmailVerified || true,
            })
          );
          console.log("[Signin] Direct login success:", { role: userRole });
          setFormData({ email: "", password: "", otp: "" });
          const dashboardPath = userRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";
          console.log("[Signin] Navigating to:", dashboardPath);
          navigate(dashboardPath);
          return;
        }

        if (!data.pendingToken) {
          dispatch(loginFailure("No pending token received from server"));
          setErrors({ server: "No pending token received from server" });
          return;
        }

        dispatch(loginSuccess({ pendingToken: data.pendingToken }));
        console.log("[Signin] Login success, pendingToken:", data.pendingToken);
        setTimeLeft(600);
      } else {
        if (!pendingToken) {
          dispatch(loginFailure("Session expired. Please sign in again."));
          setErrors({ server: "Session expired. Please sign in again." });
          setTimeLeft(0);
          return;
        }

        console.log("[Signin] Sending OTP verification:", { email: formData.email, otp: formData.otp, pendingToken });
        dispatch(loginStart());
        const otpResponse = await fetch("http://localhost:5000/api/auth/verify-otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            otp: formData.otp,
            pendingToken,
          }),
        });

        const otpData = await otpResponse.json();
        console.log("[Signin] OTP verification response:", {
          status: otpResponse.status,
          statusText: otpResponse.statusText,
          data: otpData,
        });

        if (!otpResponse.ok) {
          dispatch(verifyOtpFailure(otpData.message || "Invalid or expired OTP"));
          setErrors({ otp: otpData.message || "Invalid or expired OTP" });
          return;
        }

        if (!otpData.token) {
          dispatch(verifyOtpFailure("Invalid response: missing token"));
          setErrors({ server: "Invalid response from server: missing token" });
          return;
        }

        const userRole = otpData.role || (otpData.user && otpData.user.role);
        if (!userRole) {
          dispatch(verifyOtpFailure("Invalid response: missing role"));
          setErrors({ server: "Invalid response from server: missing role" });
          return;
        }

        localStorage.setItem("token", otpData.token);
        console.log("[Signin] Token stored:", {
          token: otpData.token,
          role: userRole,
          email: formData.email,
        });

        dispatch(
          verifyOtpSuccess({
            user: otpData.user || otpData,
            role: userRole,
            isEmailVerified: otpData.isEmailVerified || true,
          })
        );
        console.log("[Signin] OTP success, state updated:", { role: userRole });

        setFormData({ email: "", password: "", otp: "" });
        setTimeLeft(0);

        setTimeout(() => {
          const dashboardPath = userRole === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";
          console.log("[Signin] Navigating to:", dashboardPath);
          navigate(dashboardPath);
        }, 100);
      }
    } catch (err) {
      console.error("[Signin] Error:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      dispatch(
        showSigninOtpInput
          ? verifyOtpFailure(
              err.message.includes("Failed to fetch")
                ? "Unable to connect to server. Check backend."
                : "Unexpected error."
            )
          : loginFailure(
              err.message.includes("Failed to fetch")
                ? "Unable to connect to server. Check backend."
                : "Unexpected error."
            )
      );
      setErrors({ server: err.message.includes("Failed to fetch") ? "Unable to connect to server." : "Unexpected error." });
    }
  };

  const handleResendOtp = async () => {
    dispatch(resendOtpStart());
    try {
      console.log('[Signin] Resending OTP for:', formData.email);
      const response = await fetch('http://localhost:5000/api/email/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
        }),
      });

      const data = await response.json();
      console.log('[Signin] Resend OTP response:', { status: response.status, data });

      if (response.ok) {
        dispatch(resendOtpSuccess());
        setTimeLeft(600);
        setFormData((prev) => ({ ...prev, otp: '' }));
      } else {
        dispatch(resendOtpFailure(data.message || 'Failed to resend OTP'));
        setErrors({ server: data.message || 'Failed to resend OTP' });
      }
    } catch (error) {
      console.error('[Signin] Resend OTP error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      dispatch(resendOtpFailure('Failed to connect to server.'));
      setErrors({ server: 'Failed to connect to server.' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl">
        <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
          Sign In to Your Account
        </h2>
        <p className="text-center text-sm text-gray-600 mb-6">
          Don't have an account?{" "}
          <Link
            to="/auth/signup"
            onClick={() => dispatch(resetAuthState())}
            className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
          >
            Sign Up
          </Link>
        </p>

        {error && (
          <div className="text-red-600 bg-red-100 border border-red-400 rounded-md p-3 text-center mb-6 font-semibold text-base">
            <p>{error}</p>
            {error === "Please verify your email before signing in" && (
              <p className="mt-2">
                <Link
                  to="/auth/verify-email"
                  onClick={() => dispatch(resetAuthState())}
                  className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
                >
                  Verify your email now
                </Link>
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!showSigninOtpInput ? (
            <>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-lg">✉️</span>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`pl-10 w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.email ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-lg">🔒</span>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`pl-10 pr-10 w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                      errors.password ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="••••••••"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <span className="text-lg">{showPassword ? "🙈" : "👁️"}</span>
                    </button>
                  </div>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <Link
                    to="/auth/forgetpass"
                    onClick={() => dispatch(resetAuthState())}
                    className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-gray-700"
              >
                Enter OTP
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 text-lg">🔐</span>
                </div>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  value={formData.otp}
                  onChange={handleChange}
                  disabled={timeLeft <= 0}
                  className={`pl-10 w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    errors.otp || timeLeft <= 0 ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter 6-digit OTP"
                />
              </div>
              {errors.otp && (
                <p className="text-red-500 text-xs mt-1">{errors.otp}</p>
              )}
              <p className="text-gray-600 text-sm mt-2">
                Time remaining: {formatTime(timeLeft)}
              </p>
              {timeLeft <= 0 && (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className={`mt-2 w-full p-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Resending..." : "Resend OTP"}
                </button>
              )}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || (showSigninOtpInput && timeLeft <= 0)}
              className={`w-full p-3 text-white rounded-lg shadow-md transition-all duration-300 ${
                loading || (showSigninOtpInput && timeLeft <= 0)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300"
              }`}
            >
              {loading
                ? showSigninOtpInput
                  ? "Verifying OTP..."
                  : "Sending OTP..."
                : showSigninOtpInput
                ? "Verify OTP"
                : "Sign In"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div>
              <a
                href="#"
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span className="sr-only">Sign in with Google</span>
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12.545 10.239v3.821h5.445c-0.712 2.315-2.647 3.972-5.445 3.972-3.332 0-6.033-2.701-6.033-6.032s2.701-6.032 6.033-6.032c1.498 0 2.866 0.549 3.921 1.453l2.814-2.814c-1.787-1.676-4.188-2.707-6.735-2.707-5.522 0-10 4.478-10 10s4.478 10 10 10c8.396 0 10-7.584 10-10 0-0.665-0.076-1.307-0.214-1.914z" />
                </svg>
              </a>
            </div>
            <div>
              <a
                href="#"
                className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span className="sr-only">Sign in with GitHub</span>
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}