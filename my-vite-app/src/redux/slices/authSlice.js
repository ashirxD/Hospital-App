import { createSlice } from '@reduxjs/toolkit';

// Load initial state from localStorage if available
const loadInitialState = () => {
  try {
    const persistedState = localStorage.getItem('authState');
    if (persistedState) {
      const parsedState = JSON.parse(persistedState);
      // Ensure availability object has all required fields with proper defaults
      if (parsedState.user) {
        parsedState.user = {
          ...parsedState.user,
          availability: {
            startTime: parsedState.user.availability?.startTime || '',
            endTime: parsedState.user.availability?.endTime || '',
            days: Array.isArray(parsedState.user.availability?.days) ? parsedState.user.availability.days : [],
            slotDuration: parsedState.user.availability?.slotDuration || 30,
            breakTime: parsedState.user.availability?.breakTime || 0,
            vacations: Array.isArray(parsedState.user.availability?.vacations) ? parsedState.user.availability.vacations : []
          },
          profilePicture: parsedState.user.profilePicture || null
        };
      }
      return parsedState;
    }
  } catch (error) {
    console.error('Error loading persisted state:', error);
  }
  return {
    user: null,
    isAuthenticated: false,
    role: null,
    isEmailVerified: false,
    token: localStorage.getItem('token') || '',
    loading: false,
    error: null,
    showSigninOtpInput: false, // For 2FA OTP in Signin
    showSignupOtpInput: false, // For email verification OTP in Signup
    pendingToken: '',
    signupSuccessMessage: '',
  };
};

const initialState = loadInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Token verification actions
    verifyTokenStart(state) {
      state.loading = true;
      state.error = null;
    },
    verifyTokenSuccess(state, action) {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = {
        ...action.payload.user,
        availability: {
          startTime: action.payload.user.availability?.startTime || '',
          endTime: action.payload.user.availability?.endTime || '',
          days: Array.isArray(action.payload.user.availability?.days) ? action.payload.user.availability.days : [],
          slotDuration: action.payload.user.availability?.slotDuration || 30,
          breakTime: action.payload.user.availability?.breakTime || 0,
          vacations: Array.isArray(action.payload.user.availability?.vacations) ? action.payload.user.availability.vacations : []
        },
        profilePicture: action.payload.user.profilePicture || null,
      };
      state.role = action.payload.role;
      state.isEmailVerified = action.payload.isEmailVerified;
      state.token = action.payload.token || state.token;
      // Persist to localStorage
      localStorage.setItem('authState', JSON.stringify(state));
    },
    verifyTokenFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
      state.user = null;
      state.role = null;
      state.token = '';
      state.showSigninOtpInput = false;
      state.showSignupOtpInput = false;
      state.pendingToken = '';
    },
    // Login actions
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action) {
      state.loading = false;
      state.showSigninOtpInput = !!action.payload.pendingToken;
      state.pendingToken = action.payload.pendingToken || '';
      state.token = action.payload.token || state.token;
    },
    loginFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
      state.showSigninOtpInput = false;
      state.pendingToken = '';
      state.token = '';
    },
    // OTP verification actions
    verifyOtpSuccess(state, action) {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = {
        ...action.payload.user,
        availability: action.payload.user.availability || { startTime: '', endTime: '', days: [] },
        profilePicture: action.payload.user.profilePicture || null,
      };
      state.role = action.payload.role;
      state.isEmailVerified = action.payload.isEmailVerified;
      state.showSigninOtpInput = false;
      state.pendingToken = '';
      state.token = action.payload.token || state.token;
    },
    verifyOtpFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
      state.token = '';
    },
    // OTP resend actions
    resendOtpStart(state) {
      state.loading = true;
      state.error = null;
    },
    resendOtpSuccess(state) {
      state.loading = false;
      state.signupSuccessMessage = 'A new OTP has been sent to your email.';
    },
    resendOtpFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    // Signup actions
    signupStart(state) {
      state.loading = true;
      state.error = null;
      state.signupSuccessMessage = '';
    },
    signupSuccess(state) {
      state.loading = false;
      state.showSignupOtpInput = true;
      state.signupSuccessMessage = 'Please verify your email with the OTP sent.';
    },
    signupFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    // Email verification actions
    verifyEmailSuccess(state) {
      state.loading = false;
      state.isEmailVerified = true;
      state.showSignupOtpInput = false;
      state.signupSuccessMessage = 'Email verified successfully! Redirecting...';
    },
    verifyEmailFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    // Availability actions
    setAvailability(state, action) {
      if (!state.user) return;
      
      const { startTime, endTime, days, slotDuration, breakTime, vacations } = action.payload;
      state.user.availability = {
        startTime: startTime || state.user.availability.startTime || '',
        endTime: endTime || state.user.availability.endTime || '',
        days: Array.isArray(days) ? days : state.user.availability.days || [],
        slotDuration: slotDuration || state.user.availability.slotDuration || 30,
        breakTime: breakTime || state.user.availability.breakTime || 0,
        vacations: Array.isArray(vacations) ? vacations : state.user.availability.vacations || []
      };
      // Persist to localStorage
      localStorage.setItem('authState', JSON.stringify(state));
    },
    clearAvailability(state) {
      state.user.availability = {
        startTime: "",
        endTime: "",
        days: [],
        slotDuration: 30,
        breakTime: 0,
        vacations: []
      };
    },
    // Profile picture update action
    updateProfilePicture(state, action) {
      if (state.user) {
        state.user.profilePicture = action.payload;
        // Persist to localStorage
        localStorage.setItem('authState', JSON.stringify(state));
      }
    },
    // Logout action
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.role = null;
      state.isEmailVerified = false;
      state.token = '';
      state.error = null;
      state.showSigninOtpInput = false;
      state.showSignupOtpInput = false;
      state.pendingToken = '';
      state.signupSuccessMessage = '';
      // Clear localStorage
      localStorage.removeItem('authState');
      localStorage.removeItem('token');
    },
    // Reset auth state for navigation
    resetAuthState(state) {
      state.error = null;
      state.showSigninOtpInput = false;
      state.showSignupOtpInput = false;
      state.pendingToken = '';
      state.signupSuccessMessage = '';
    },
  },
});

export const {
  verifyTokenStart,
  verifyTokenSuccess,
  verifyTokenFailure,
  loginStart,
  loginSuccess,
  loginFailure,
  verifyOtpSuccess,
  verifyOtpFailure,
  resendOtpStart,
  resendOtpSuccess,
  resendOtpFailure,
  signupStart,
  signupSuccess,
  signupFailure,
  verifyEmailSuccess,
  verifyEmailFailure,
  setAvailability,
  clearAvailability,
  updateProfilePicture,
  logout,
  resetAuthState,
} = authSlice.actions;

export default authSlice.reducer;