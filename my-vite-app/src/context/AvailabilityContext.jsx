import { createContext, useContext } from 'react';

// Create Context for availability
const AvailabilityContext = createContext(null);

// Custom hook to use AvailabilityContext
export const useAvailability = () => {
  const context = useContext(AvailabilityContext);
  if (!context) {
    throw new Error('useAvailability must be used within an AvailabilityProvider');
  }
  return { ...context, dispatch: context.dispatch }; // Keep dispatch for compatibility
};

// Export the Context for use in DoctorDashboard.jsx
export default AvailabilityContext;