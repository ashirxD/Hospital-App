import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { resetAuthState } from '../redux/slices/authSlice';

const VerifyEmail = () => {
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setSuccessMessage('');
  };

  const validate = () => {
    const errors = {};
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }
    if (!formData.otp) {
      errors.otp = 'OTP is required';
    } else if (!/^\d{6}$/.test(formData.otp)) {
      errors.otp = 'OTP must be a 6-digit number';
    }
    return errors;
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/email/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          otp: formData.otp,
        }),
      });

      const data = await response.json();
      console.log('Verify email response:', { status: response.status, data });

      if (response.ok) {
        setSuccessMessage('Email verified successfully! Redirecting to signin page...');
        setFormData({ email: '', otp: '' });
        setTimeout(() => {
          dispatch(resetAuthState());
          navigate('/auth/signin');
        }, 2000);
      } else {
        setErrors({ server: data.message || 'Email verification failed' });
      }
    } catch (error) {
      console.error('Verify email request failed:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      setErrors({ server: 'Failed to connect to the server. Please check if the server is running.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!formData.email) {
      setErrors({ email: 'Please enter your email to resend OTP' });
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrors({ email: 'Please enter a valid email' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
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
      console.log('Resend OTP response:', { status: response.status, data });

      if (response.ok) {
        setSuccessMessage('A new OTP has been sent to your email.');
      } else {
        setErrors({ server: data.message || 'Failed to resend OTP' });
      }
    } catch (error) {
      console.error('Resend OTP request failed:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      setErrors({ server: 'Failed to connect to the server. Please check if the server is running.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 transform transition-all hover:shadow-2xl">
        <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
          Verify Your Email
        </h2>
        {successMessage && (
          <p className="text-green-600 bg-green-100 border border-green-400 rounded-md p-3 text-center mb-6 animate-pulse">
            {successMessage}
          </p>
        )}
        {errors.server && (
          <p className="text-red-600 bg-red-100 border border-red-400 rounded-md p-3 text-center mb-6">
            {errors.server}
          </p>
        )}
        <form onSubmit={handleVerifyEmail} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <div className="mt-1 relative">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
              OTP
            </label>
            <div className="mt-1 relative">
              <input
                type="text"
                id="otp"
                name="otp"
                value={formData.otp}
                onChange={handleChange}
                className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                  errors.otp ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter 6-digit OTP"
              />
            </div>
            {errors.otp && (
              <p className="text-red-500 text-xs mt-1">{errors.otp}</p>
            )}
          </div>
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full p-3 text-white rounded-lg shadow-md transition-all duration-300 ${
                isSubmitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300'
              }`}
            >
              {isSubmitting ? 'Verifying...' : 'Verify Email'}
            </button>
          </div>
        </form>
        <p className="text-center mt-4 text-sm text-gray-600">
          Didn't receive an OTP or OTP expired?{' '}
          <button
            onClick={handleResendOtp}
            disabled={isSubmitting}
            className={`text-blue-600 font-medium hover:text-blue-800 transition-colors ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Resend OTP
          </button>
        </p>
        <p className="text-center mt-4 text-sm text-gray-600">
          Already verified?{' '}
          <Link
            to="/auth/signin"
            onClick={() => dispatch(resetAuthState())}
            className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;