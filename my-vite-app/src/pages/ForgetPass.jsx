import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState("request"); // "request" or "reset"
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    newPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isTimerExpired, setIsTimerExpired] = useState(false);

  // Start or reset timer when entering reset step or requesting new OTP
  useEffect(() => {
    if (step === "reset") {
      setTimeLeft(600);
      setIsTimerExpired(false);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsTimerExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
    setServerError("");
  };

  const validateRequest = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    return newErrors;
  };

  const validateReset = () => {
    const newErrors = {};
    if (!formData.otp) {
      newErrors.otp = "OTP is required";
    }
    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }
    return newErrors;
  };

  const handleRequestOTP = async () => {
    const validationErrors = validateRequest();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setServerError("");

    try {
      const response = await fetch("http://localhost:5000/api/email/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({});
        setServerError(data.message || "Failed to send OTP");
        setIsSubmitting(false);
        return;
      }

      setStep("reset");
      setIsSubmitting(false);
    } catch (err) {
      console.error("OTP request error:", err);
      setServerError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (isTimerExpired) {
      setServerError("OTP has expired. Please request a new OTP.");
      return;
    }

    const validationErrors = validateReset();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setServerError("");

    try {
      const response = await fetch("http://localhost:5000/api/email/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          otp: formData.otp,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({});
        setServerError(data.message || "Failed to reset password");
        setIsSubmitting(false);
        return;
      }

      setFormData({ email: "", otp: "", newPassword: "" });
      setStep("request");
      setIsSubmitting(false);
      alert("Password reset successful!");
    } catch (err) {
      console.error("Password reset error:", err);
      setServerError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Format time left as MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        {step === "request" ? (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900">Forgot your password?</h2>
              <p className="mt-2 text-sm text-gray-600">
                Enter your email and we'll send you an OTP to reset your password.
              </p>
            </div>

            {serverError && (
              <p className="mb-4 text-sm text-red-600 text-center">{serverError}</p>
            )}

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
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
                    className={`pl-10 block w-full pr-3 py-2 border ${
                      errors.email ? "border-red-300" : "border-gray-300"
                    } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Send OTP"}
                </button>
              </div>

              <div className="text-center">
                <Link
                  to="/signin"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900">Reset Password</h2>
              <div className="mt-4 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="h-6 w-6 text-green-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">
                We've sent an OTP to: <span className="font-medium text-gray-800">{formData.email}</span>
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Enter the OTP within{" "}
                <span className={`font-medium ${isTimerExpired ? "text-red-600" : "text-gray-800"}`}>
                  {formatTime(timeLeft)}
                </span>
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Didn't receive the email? Check your spam folder or
                <button
                  type="button"
                  onClick={handleRequestOTP}
                  disabled={isSubmitting}
                  className="ml-1 text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  {isSubmitting ? "Sending..." : "resend OTP"}
                </button>
              </p>
            </div>

            {serverError && (
              <p className="mb-4 text-sm text-red-600 text-center">{serverError}</p>
            )}

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-gray-700"
                >
                  OTP
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    value={formData.otp}
                    onChange={handleChange}
                    disabled={isTimerExpired}
                    className={`block w-full pr-3 py-2 border ${
                      errors.otp || isTimerExpired ? "border-red-300" : "border-gray-300"
                    } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    placeholder="Enter 6-digit OTP"
                  />
                </div>
                {errors.otp && (
                  <p className="mt-2 text-sm text-red-600">{errors.otp}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700"
                >
                  New Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-lg">🔒</span>
                  </div>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={handleChange}
                    disabled={isTimerExpired}
                    className={`pl-10 block w-full pr-3 py-2 border ${
                      errors.newPassword || isTimerExpired ? "border-red-300" : "border-gray-300"
                    } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.newPassword && (
                  <p className="mt-2 text-sm text-red-600">{errors.newPassword}</p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isSubmitting || isTimerExpired}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </button>
              </div>

              <div className="text-center">
                <Link
                  to="/signin"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}