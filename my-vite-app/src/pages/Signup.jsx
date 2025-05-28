import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  signupStart,
  signupSuccess,
  signupFailure,
  verifyEmailSuccess,
  verifyEmailFailure,
  resendOtpStart,
  resendOtpSuccess,
  resendOtpFailure,
  logout,
  resetAuthState,
} from '../redux/slices/authSlice';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    specialization: '',
  });
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [timeLeft, setTimeLeft] = useState(600);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showSignupOtpInput, loading, error, signupSuccessMessage, user } = useSelector((state) => state.auth);

  // Check if user is already authenticated and reset auth state
  useEffect(() => {
    dispatch(resetAuthState());
    const token = localStorage.getItem('token');
    if (token && user) {
      console.log('[Signup] User already authenticated:', { user });
      const destination = user.role === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard';
      navigate(destination, { replace: true });
    }
  }, [navigate, user, dispatch]);

  // Timer for OTP
  useEffect(() => {
    if (!showSignupOtpInput || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [showSignupOtpInput, timeLeft]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'otp') {
      setOtp(value);
      setErrors((prev) => ({ ...prev, otp: '' }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleRoleChange = (newRole) => {
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      specialization: newRole === 'doctor' ? prev.specialization : '',
    }));
    setErrors({});
  };

  const validate = () => {
    const errors = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.password || formData.password.length < 6)
      errors.password = 'Password must be at least 6 characters';
    if (!formData.role) errors.role = 'Role is required';
    if (formData.role === 'doctor' && !formData.specialization)
      errors.specialization = 'Specialization is required';
    return errors;
  };

  const validateOtp = () => {
    const errors = {};
    if (!otp) errors.otp = 'OTP is required';
    else if (!/^\d{6}$/.test(otp)) errors.otp = 'OTP must be a 6-digit number';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      console.log('[Signup] Validation errors:', validationErrors);
      return;
    }

    dispatch(signupStart());
    try {
      console.log('[Signup] Sending:', formData);
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      console.log('[Signup] Response:', { status: response.status, data });

      if (response.ok) {
        dispatch(signupSuccess());
        setTimeLeft(600);
      } else {
        dispatch(signupFailure(data.message || 'Signup failed'));
      }
    } catch (error) {
      console.error('[Signup] Error:', error);
      dispatch(signupFailure('Failed to connect to the server. Please check your network or try again later.'));
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    const validationErrors = validateOtp();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      console.log('[Signup] OTP validation errors:', validationErrors);
      return;
    }

    dispatch(signupStart());
    try {
      console.log('[Signup] Sending OTP verification:', { email: formData.email, otp });
      const response = await fetch('http://localhost:5000/api/email/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp }),
      });

      const data = await response.json();
      console.log('[Signup] OTP verification response:', { status: response.status, data });

      if (response.ok) {
        dispatch(verifyEmailSuccess());
        setTimeout(() => {
          navigate('/auth/signin', { replace: true });
        }, 2000);
      } else {
        dispatch(verifyEmailFailure(data.message || 'Verification failed'));
      }
    } catch (error) {
      console.error('[Signup] OTP verification error:', error);
      dispatch(verifyEmailFailure('Failed to connect to the server. Please check your network or try again later.'));
    }
  };

  const handleResendOtp = async () => {
    dispatch(resendOtpStart());
    try {
      console.log('[Signup] Resending OTP for:', formData.email);
      const response = await fetch('http://localhost:5000/api/email/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      const data = await response.json();
      console.log('[Signup] Resend OTP response:', { status: response.status, data });

      if (response.ok) {
        dispatch(resendOtpSuccess());
        setTimeLeft(600);
        setOtp('');
      } else {
        dispatch(resendOtpFailure(data.message || 'Failed to resend OTP'));
      }
    } catch (error) {
      console.error('[Signup] Resend OTP error:', error);
      dispatch(resendOtpFailure('Failed to connect to the server. Please check your network or try again later.'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          {formData.role === 'doctor' ? 'Create Doctor Account' : 'Create Patient Account'}
        </h2>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => handleRoleChange('patient')}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              formData.role === 'patient'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            Patient
          </button>
          <button
            onClick={() => handleRoleChange('doctor')}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              formData.role === 'doctor'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            Doctor
          </button>
        </div>

        {signupSuccessMessage && (
          <p className="text-green-600 bg-green-100 border border-green-400 rounded-md p-2 mb-4 text-center">
            {signupSuccessMessage}
          </p>
        )}

        {error && (
          <p className="text-red-600 bg-red-100 border border-red-400 rounded-md p-2 mb-4 text-center">
            {error}
          </p>
        )}

        {!showSignupOtpInput ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full p-3 border ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Full Name"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full p-3 border ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Email Address"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full p-3 border ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Password"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {formData.role === 'doctor' && (
              <div>
                <input
                  type="text"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  className={`w-full p-3 border ${
                    errors.specialization ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Specialization (e.g., Cardiologist)"
                />
                {errors.specialization && (
                  <p className="text-red-500 text-xs mt-1">{errors.specialization}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 hover:shadow-lg'
              }`}
            >
              {loading ? 'Signing Up...' : 'Sign Up'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <input
                type="text"
                name="otp"
                value={otp}
                onChange={handleChange}
                disabled={timeLeft <= 0}
                className={`w-full p-3 border ${
                  errors.otp || timeLeft <= 0 ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="Enter 6-digit OTP"
              />
              {errors.otp && <p className="text-red-500 text-xs mt-1">{errors.otp}</p>}
              <p className="text-gray-600 text-sm mt-2">Time remaining: {formatTime(timeLeft)}</p>
            </div>

            {timeLeft <= 0 && (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className={`w-full p-2 border border-blue-600 text-blue-600 rounded-lg transition-all ${
                  loading ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-50'
                }`}
              >
                {loading ? 'Resending...' : 'Resend OTP'}
              </button>
            )}

            <button
              type="submit"
              disabled={loading || timeLeft <= 0}
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                loading || timeLeft <= 0
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 hover:shadow-lg'
              }`}
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        )}

        <p className="text-center mt-4 text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/auth/signin"
            onClick={() => dispatch(resetAuthState())}
            className="text-blue-600 font-medium hover:underline"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;