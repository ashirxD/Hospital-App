import React, { useState, useEffect } from "react";
import {
  CalendarIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setAvailability } from "../../redux/slices/authSlice";
import { Calendar } from "react-calendar";
import "react-calendar/dist/Calendar.css";
import moment from "moment";
import {
  Grid,
  Paper,
  Box,
  Avatar,
  Typography,
  Button,
  Alert,
  Container,
  CircularProgress,
  Fade,
  Zoom,
} from '@mui/material';
import { Description as DescriptionIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';


export const Sidebar = ({ activeSection, setActiveSection, handleLogout }) => {
  console.log("[Sidebar] Rendering, activeSection:", activeSection);
  return (
    <div className="w-64 bg-white shadow-lg p-6 flex flex-col justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-8">Doctor Dashboard</h2>
        <nav className="space-y-2">
          <button
            onClick={() => setActiveSection("appointments")}
            className={`w-full flex items-center p-3 rounded-lg text-gray-700 hover:bg-blue-100 transition ${
              activeSection === "appointments" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <CalendarIcon className="w-6 h-6 mr-3" />
            Appointments
          </button>
          <button
            onClick={() => setActiveSection("patients")}
            className={`w-full flex items-center p-3 rounded-lg text-gray-700 hover:bg-blue-100 transition ${
              activeSection === "patients" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <UserGroupIcon className="w-6 h-6 mr-3" />
            Patients
          </button>
          <button
            onClick={() => setActiveSection("appointment-requests")}
            className={`w-full flex items-center p-3 rounded-lg text-gray-700 hover:bg-blue-100 transition ${
              activeSection === "appointment-requests" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <ClipboardDocumentListIcon className="w-6 h-6 mr-3" />
            Appointment Requests
          </button>
          <button
            onClick={() => setActiveSection("edit-profile")}
            className={`w-full flex items-center p-3 rounded-lg text-gray-700 hover:bg-blue-100 transition ${
              activeSection === "edit-profile" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <PencilIcon className="w-6 h-6 mr-3" />
            Edit Profile
          </button>
          <button
            onClick={() => setActiveSection("chat")}
            className={`w-full flex items-center p-3 rounded-lg text-gray-700 hover:bg-blue-100 transition ${
              activeSection === "chat" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <ChatBubbleLeftRightIcon className="w-6 h-6 mr-3" />
            Chat
          </button>
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center p-3 text-white bg-red-600 rounded-lg hover:bg-red-700 transition"
      >
        <ArrowRightOnRectangleIcon className="w-6 h-6 mr-3" />
        Logout
      </button>
    </div>
  );
};

export const Header = ({
  userData = {},
  availability = { days: [], startTime: "", endTime: "" },
  notifications = [],
  toggleNotifications,
  showNotifications = false,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  error,
  averageRating = 0,
  totalReviews = 0,
  socketStatus,
}) => {
  console.log("[Header] Rendering with rating data:", { averageRating, totalReviews });
  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderStars = (rating) => {
    console.log("[Header] Rendering stars for rating:", rating);
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={`full-${i}`} className="text-yellow-400">
          ★
        </span>
      );
    }

    // Add half star if needed
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">
          ⯨
        </span>
      );
    }

    // Add empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300">
          ★
        </span>
      );
    }

    console.log("[Header] Generated stars:", stars.length);
    return stars;
  };

  return (
    <div className="mb-8 flex items-center justify-between relative">
      <div className="flex items-center space-x-4">
        {userData.profilePicture && (
          <img
            src={`${import.meta.env.VITE_API_URL}${userData.profilePicture}?t=${Date.now()}`}
            alt="Profile"
            className="w-12 h-12 rounded-full object-cover"
            onError={(e) =>
              console.error("[Header] Image error:", userData.profilePicture, e)
            }
          />
        )}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome, Dr. {userData.name || "Loading..."}!
          </h1>
          <p className="text-gray-600">Manage your practice efficiently.</p>
          {userData.specialization && (
            <p className="text-blue-600 mt-1">
              Specialization: {userData.specialization}
            </p>
          )}
          {availability.startTime && availability.endTime && availability.days?.length > 0 && (
            <p className="text-blue-600 mt-1">
              Availability: {availability.days.join(", ")},{" "}
              {availability.startTime} - {availability.endTime}
            </p>
          )}
          <div className="flex items-center mt-2">
            {averageRating > 0 ? (
              <>
                <div className="flex items-center">
                  {renderStars(averageRating)}
                </div>
                <span className="ml-2 text-gray-600">
                  {averageRating.toFixed(1)}/5 ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
                </span>
              </>
            ) : (
              <span className="text-gray-500">No ratings yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Notification Bell and Dropdown */}
      <div className="relative z-50">
        <button
          onClick={toggleNotifications}
          className="relative focus:outline-none p-2 rounded-full hover:bg-blue-100 transition"
          aria-label="Notifications"
        >
          <BellIcon className="h-6 w-6 text-gray-700" />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 mt-3 w-96 bg-white rounded-lg shadow-xl max-h-96 overflow-y-auto border border-gray-200">
            <div className="p-4">
              <NotificationsList
                notifications={notifications}
                markNotificationAsRead={markNotificationAsRead}
                markAllNotificationsAsRead={markAllNotificationsAsRead}
                error={error}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Appointments Table Component
export const AppointmentsTable = React.memo(({ appointments = [], error, normalizeTime, onViewDetails }) => {
  console.log("[AppointmentsTable] Rendering, appointments:", appointments);
  if (!Array.isArray(appointments)) {
    console.error("[AppointmentsTable] Invalid appointments prop:", appointments);
    return (
      <div className="text-red-600 bg-red-100 border border-red-400 rounded p-3">
        Error: Invalid appointments data
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Upcoming Appointments</h3>
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4 animate-fade-in">
          {error}
        </p>
      )}
      {appointments.length === 0 ? (
        <p className="text-gray-600">No upcoming appointments.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow">
            <thead>
              <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-4 px-6 text-left">Patient</th>
                <th className="py-4 px-6 text-left">Date</th>
                <th className="py-4 px-6 text-left">Time</th>
                <th className="py-4 px-6 text-left">Status</th>
                <th className="py-4 px-6 text-left">Reason</th>
                <th className="py-4 px-6 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-light">
              {appointments.map((appointment, index) => {
                console.log("[AppointmentsTable] Appointment:", index, appointment);
                const key = appointment?._id || `appt-${index}-${Date.now()}`;
                const displayStatus = appointment?.status === "attended" ? "completed" : appointment?.status || "N/A";
                return (
                  <tr
                    key={key}
                    className="border-b border-gray-200 even:bg-gray-50 hover:bg-gray-100"
                  >
                    <td className="py-4 px-6 font-semibold">
                      {appointment?.patient?.name || "Unknown Patient"}
                    </td>
                    <td className="py-4 px-6">
                      {appointment?.date
                        ? new Date(appointment.date).toISOString().split("T")[0]
                        : "N/A"}
                    </td>
                    <td className="py-4 px-6 text-teal-600">
                      {appointment?.time || "N/A"}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          appointment?.status === "accepted"
                            ? "bg-green-100 text-green-800"
                            : appointment?.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : appointment?.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : appointment?.status === "attended"
                            ? "bg-blue-100 text-blue-800"
                            : appointment?.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : appointment?.status === "absent"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6">{appointment?.reason || "N/A"}</td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => {
                          console.log("[AppointmentsTable] Viewing details for:", appointment._id);
                          onViewDetails(appointment._id);
                        }}
                        className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 transition"
                        title="View Details"
                      >
                        <InformationCircleIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});


// Custom styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 2.5,
  border: 'none',
  background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
  boxShadow: '0 3px 15px rgba(0,0,0,0.08)',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 5px 20px rgba(0,0,0,0.1)',
  },
  padding: theme.spacing(2.5),
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 1.5,
  padding: theme.spacing(0.8, 2),
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
  background: 'linear-gradient(45deg, #1a237e, #3949ab)',
  color: '#ffffff',
  '&:hover': {
    background: 'linear-gradient(45deg, #3949ab, #5c6bc0)',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.3s ease',
}));

const ProfileImage = styled('img')(({ theme }) => ({
  width: 60,
  height: 60,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid #e3f2fd',
  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  marginRight: theme.spacing(2),
  backgroundColor: '#e3f2fd',
  [theme.breakpoints.down('sm')]: {
    width: 50,
    height: 50,
  },
}));

export const PatientsList = ({ appointments, error }) => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState('');
  const [imageErrors, setImageErrors] = useState({});

  // Function to get valid image URL
  const getValidImageUrl = (url) => {
    if (!url) return null;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      return `${import.meta.env.VITE_API_URL}${url.startsWith('/') ? url : `/${url}`}`;
    } catch (err) {
      console.error('[PatientsList] Error formatting image URL:', err);
      return null;
    }
  };

  // Fallback image URL
  const fallbackImage = 'https://via.placeholder.com/60?text=Patient';

  const handleImageError = (patientId) => {
    setImageErrors(prev => ({
      ...prev,
      [patientId]: true
    }));
  };

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        setErrorState('');
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/doctor/patients`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch patients');
        }

        const data = await response.json();
        console.log('[PatientsList] Fetched patients:', data);
        // Format profile picture URLs
        const formattedData = data.map(patient => ({
          ...patient,
          profilePicture: getValidImageUrl(patient.profilePicture)
        }));
        setPatients(formattedData);
      } catch (err) {
        console.error('[PatientsList] Error fetching patients:', err);
        setErrorState(err.message || 'Failed to fetch patients');
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh',
        }}
      >
        <CircularProgress size={40} thickness={4} sx={{ color: '#1a237e' }} />
        <Typography sx={{ mt: 1.5, color: '#1a237e', fontSize: '0.9rem' }}>
          Loading patients...
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Fade in timeout={500}>
        <Box>
          <Typography 
            variant="h4" 
            component="h2" 
            sx={{ 
              mb: 3, 
              color: '#1a237e', 
              fontWeight: 700,
              fontSize: { xs: '1.6rem', md: '2.2rem' },
            }}
          >
            My Patients
          </Typography>

          {(error || errorState) && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3, 
                borderRadius: 1.5, 
                fontSize: '0.9rem', 
                bgcolor: '#ffebee',
                '& .MuiAlert-icon': { fontSize: '1.2rem' },
              }}
            >
              {error || errorState}
            </Alert>
          )}

          <Grid container spacing={3}>
            {patients.length > 0 ? (
              patients.map((patient, index) => (
                <Grid item xs={12} sm={6} md={4} key={patient._id}>
                  <Zoom in timeout={500 + index * 100}>
                    <StyledPaper>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {patient.profilePicture && !imageErrors[patient._id] ? (
                          <ProfileImage
                            src={patient.profilePicture}
                            alt={patient.name || 'Patient'}
                            onError={() => handleImageError(patient._id)}
                          />
                        ) : (
                          <Avatar
                            sx={{
                              width: 60,
                              height: 60,
                              border: '3px solid #e3f2fd',
                              bgcolor: '#e3f2fd',
                              marginRight: 2,
                              [theme.breakpoints.down('sm')]: {
                                width: 50,
                                height: 50,
                              }
                            }}
                          >
                            <PersonIcon sx={{ fontSize: 30, color: '#1a237e' }} />
                          </Avatar>
                        )}
                        <Box>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 600, 
                              color: '#1a237e',
                              fontSize: { xs: '1.2rem', md: '1.4rem' },
                            }}
                          >
                            {patient.name || 'Unknown Patient'}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'text.secondary',
                              fontSize: '0.9rem',
                            }}
                          >
                            {patient.email || 'No email provided'}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ mt: 1.5 }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'text.secondary', 
                            fontSize: '0.8rem',
                            fontWeight: 500,
                          }}
                        >
                          Last Appointment:
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ fontSize: '0.9rem' }}
                        >
                          {patient.lastAppointment?.date 
                            ? new Date(patient.lastAppointment.date).toLocaleDateString() 
                            : 'Not specified'}{' '}
                          {patient.lastAppointment?.time || ''}
                        </Typography>
                      </Box>

                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <StyledButton
                          startIcon={<DescriptionIcon />}
                          onClick={() => {
                            console.log("[PatientsList] Navigating to records for patient:", patient._id);
                            navigate(`/doctor-dashboard/patients/${patient._id}/records`);
                          }}
                        >
                          View Records
                        </StyledButton>
                      </Box>
                    </StyledPaper>
                  </Zoom>
                </Grid>
              ))
            ) : (
              <Grid item xs={12}>
                <Alert 
                  severity="info" 
                  sx={{ 
                    borderRadius: 1.5, 
                    fontSize: '0.9rem',
                    bgcolor: '#e3f2fd',
                    '& .MuiAlert-icon': { fontSize: '1.2rem' },
                  }}
                >
                  No patients found.
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      </Fade>
    </Container>
  );
};

// Appointment Requests Table Component
export const AppointmentRequestsTable = ({
  appointmentRequests = [],
  error,
  success,
  handleAcceptRequest,
  handleRejectRequest,
}) => {
  console.log("[AppointmentRequestsTable] Rendering, appointmentRequests:", appointmentRequests);
  const [loadingRequests, setLoadingRequests] = React.useState({});

  const startLoading = (requestId) => {
    setLoadingRequests((prev) => ({ ...prev, [requestId]: true }));
  };
  const stopLoading = (requestId) => {
    setLoadingRequests((prev) => ({ ...prev, [requestId]: false }));
  };

  const handleAccept = async (requestId) => {
    startLoading(requestId);
    try {
      await handleAcceptRequest(requestId);
    } finally {
      stopLoading(requestId);
    }
  };

  const handleReject = async (requestId) => {
    startLoading(requestId);
    try {
      await handleRejectRequest(requestId);
    } finally {
      stopLoading(requestId);
    }
  };

  const pendingRequests = Array.isArray(appointmentRequests)
    ? appointmentRequests.filter((request) => request?.status === "pending")
    : [];

  return (
    <div>
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">Appointment Requests</h3>
      {success && (
        <p className="text-green-600 bg-green-100 border border-green-400 rounded p-3 mb-4 animate-fade-in">
          {success}
        </p>
      )}
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4 animate-fade-in">
          {error}
        </p>
      )}
      {pendingRequests.length === 0 ? (
        <p className="text-gray-600">No pending appointment requests.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow">
            <thead>
              <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-4 px-6 text-left">Patient</th>
                <th className="py-4 px-6 text-left">Date</th>
                <th className="py-4 px-6 text-left">Time</th>
                <th className="py-4 px-6 text-left">Reason</th>
                <th className="py-4 px-6 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-light">
              {pendingRequests.map((request) => (
                <tr
                  key={request?._id || `request-${Date.now()}`}
                  className="border-b border-gray-200 even:bg-gray-50 hover:bg-gray-100"
                >
                  <td className="py-4 px-6 font-semibold">
                    {request?.patient?.name || "Unknown Patient"}
                  </td>
                  <td className="py-4 px-6">
                    {request?.date ? new Date(request.date).toISOString().split("T")[0] : "N/A"}
                  </td>
                  <td className="py-4 px-6 text-teal-600">{request?.time || "N/A"}</td>
                  <td className="py-4 px-6">{request?.reason || "N/A"}</td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleAccept(request._id)}
                      disabled={loadingRequests[request._id]}
                      className={`mr-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition ${
                        loadingRequests[request._id] ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {loadingRequests[request._id] ? "Processing..." : "Accept"}
                    </button>
                    <button
                      onClick={() => handleReject(request._id)}
                      disabled={loadingRequests[request._id]}
                      className={`px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition ${
                        loadingRequests[request._id] ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {loadingRequests[request._id] ? "Processing..." : "Reject"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Edit Profile Form Component
export const EditProfileForm = ({
  user,
  onUpdate,
  onCancel,
}) => {
  const [formData, setFormData] = useState(() => {
    // Try to load saved form data from localStorage
    try {
      const savedFormData = localStorage.getItem('editProfileFormData');
      if (savedFormData) {
        const parsedData = JSON.parse(savedFormData);
        // Ensure all required fields are present
        return {
          name: parsedData.name || user?.name || "",
          specialization: parsedData.specialization || user?.specialization || "",
          profilePicture: parsedData.profilePicture || user?.profilePicture || null,
          availability: {
            startTime: parsedData.availability?.startTime || user?.availability?.startTime || "",
            endTime: parsedData.availability?.endTime || user?.availability?.endTime || "",
            days: parsedData.availability?.days || user?.availability?.days || [],
            slotDuration: parsedData.availability?.slotDuration || user?.availability?.slotDuration || 30,
            breakTime: parsedData.availability?.breakTime || user?.availability?.breakTime || 0,
            vacations: parsedData.availability?.vacations || user?.availability?.vacations || []
          }
        };
      }
    } catch (error) {
      console.error('Error loading saved form data:', error);
    }

    // Default form data if no saved data exists
    return {
      name: user?.name || "",
      specialization: user?.specialization || "",
      profilePicture: user?.profilePicture || null,
      availability: {
        startTime: user?.availability?.startTime || "",
        endTime: user?.availability?.endTime || "",
        days: user?.availability?.days || [],
        slotDuration: user?.availability?.slotDuration || 30,
        breakTime: user?.availability?.breakTime || 0,
        vacations: user?.availability?.vacations || []
      }
    };
  });

  const handleRemovePicture = () => {
    // Update form data
    setFormData(prev => ({
      ...prev,
      profilePicture: null
    }));

    // Clear the file input value
    const fileInput = document.getElementById('profilePicture');
    if (fileInput) {
      fileInput.value = '';
    }

    // Clear saved form data
    localStorage.removeItem('editProfileFormData');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        profilePicture: file
      }));
    }
  };

  const [selectedVacationDates, setSelectedVacationDates] = useState([]);
  const [vacationReason, setVacationReason] = useState("");
  const [showVacationCalendar, setShowVacationCalendar] = useState(false);
  const dispatch = useDispatch();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('availability.')) {
      const field = name.split('.')[1];
      if (field === 'days') {
        // Handle days selection to allow multiple selections
        setFormData(prev => ({
          ...prev,
          availability: {
            ...prev.availability,
            days: checked 
              ? [...(prev.availability.days || []), value]
              : (prev.availability.days || []).filter(day => day !== value)
          }
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          availability: {
            ...prev.availability,
            [field]: value
          }
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleVacationAdd = () => {
    if (selectedVacationDates.length !== 2) {
      alert("Please select start and end dates for your vacation");
      return;
    }

    const [startDate, endDate] = selectedVacationDates;
    const newVacation = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reason: vacationReason
    };

    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        vacations: [...(prev.availability.vacations || []), newVacation]
      }
    }));

    setSelectedVacationDates([]);
    setVacationReason("");
    setShowVacationCalendar(false);
  };

  const handleVacationRemove = (index) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        vacations: prev.availability.vacations.filter((_, i) => i !== index)
      }
    }));
  };

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const slotDurations = [
    { value: 30, label: "30 minutes" },
    { value: 45, label: "45 minutes" },
    { value: 60, label: "1 hour" },
    { value: 75, label: "1 hour 15 minutes" },
    { value: 90, label: "1 hour 30 minutes" },
    { value: 105, label: "1 hour 45 minutes" },
    { value: 120, label: "2 hours" },
  ];

  const breakTimes = [
    { value: 0, label: "No break" },
    { value: 5, label: "5 minutes" },
    { value: 10, label: "10 minutes" },
    { value: 15, label: "15 minutes" },
    { value: 20, label: "20 minutes" },
    { value: 25, label: "25 minutes" },
    { value: 30, label: "30 minutes" },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-2xl font-semibold text-gray-800 mb-6">Edit Profile</h3>
      <form onSubmit={handleProfileUpdate}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">
                Specialization *
              </label>
              <input
                type="text"
                id="specialization"
                name="specialization"
                value={formData.specialization}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                required
              />
            </div>

            {/* Vacation Section - Moved here */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Vacation Dates
                </label>
                <button
                  type="button"
                  onClick={() => setShowVacationCalendar(!showVacationCalendar)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 text-sm"
                >
                  <span>{showVacationCalendar ? "Hide Calendar" : "Add Vacation"}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform ${showVacationCalendar ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {showVacationCalendar && (
                <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-200">
                  <div className="mb-3">
                    <Calendar
                      onChange={setSelectedVacationDates}
                      value={selectedVacationDates}
                      selectRange={true}
                      className="w-full border rounded-lg"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="vacationReason" className="block text-sm font-medium text-gray-700 mb-1">
                      Reason for Vacation
                    </label>
                    <input
                      type="text"
                      id="vacationReason"
                      value={vacationReason}
                      onChange={(e) => setVacationReason(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                      placeholder="Enter reason for vacation"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVacationAdd}
                    className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 text-sm"
                  >
                    <span>Add Vacation Period</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              )}

              {formData.availability.vacations && formData.availability.vacations.length > 0 && (
                <div className="space-y-2">
                  {formData.availability.vacations.map((vacation, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm text-gray-700">
                          {new Date(vacation.startDate).toLocaleDateString()} - {new Date(vacation.endDate).toLocaleDateString()}
                        </p>
                        {vacation.reason && (
                          <p className="text-xs text-gray-500 mt-1">Reason: {vacation.reason}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleVacationRemove(index)}
                        className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile Picture Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture
              </label>
              <div className="flex flex-col items-start space-y-4">
                {formData.profilePicture ? (
                  <div className="relative group">
                    <img
                      src={typeof formData.profilePicture === 'string' 
                        ? `${import.meta.env.VITE_API_URL}${formData.profilePicture}?t=${Date.now()}`
                        : URL.createObjectURL(formData.profilePicture)
                      }
                      alt="Profile Preview"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePicture}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-all duration-200 transform hover:scale-110 shadow-lg"
                      title="Remove Picture"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full">
                    <input
                      type="file"
                      id="profilePicture"
                      name="profilePicture"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full p-2 border border-gray-300 rounded-lg file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-shadow hover:shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="availability.startTime" className="block text-sm font-medium text-gray-700 mb-1">
                Availability Start Time *
              </label>
              <input
                type="time"
                id="availability.startTime"
                name="availability.startTime"
                value={formData.availability.startTime}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="availability.endTime" className="block text-sm font-medium text-gray-700 mb-1">
                Availability End Time *
              </label>
              <input
                type="time"
                id="availability.endTime"
                name="availability.endTime"
                value={formData.availability.endTime}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="availability.slotDuration" className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Duration *
              </label>
              <select
                id="availability.slotDuration"
                name="availability.slotDuration"
                value={formData.availability.slotDuration}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                required
              >
                {slotDurations.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="availability.breakTime" className="block text-sm font-medium text-gray-700 mb-1">
                Break Time Between Appointments *
              </label>
              <select
                id="availability.breakTime"
                name="availability.breakTime"
                value={formData.availability.breakTime}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:shadow-sm"
                required
              >
                {breakTimes.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Working Days *
              </label>
              <div className="grid grid-cols-7 gap-2">
                {daysOfWeek.map((day) => (
                  <label
                    key={day}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      formData.availability.days.includes(day)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 hover:border-blue-400 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="availability.days"
                      value={day}
                      checked={formData.availability.days.includes(day)}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{day.slice(0, 3)}</span>
                    {formData.availability.days.includes(day) && (
                      <svg
                        className="w-4 h-4 mt-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-lg text-gray-700 font-semibold transition-all duration-200 bg-gray-100 hover:bg-gray-200 hover:shadow-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 rounded-lg text-white font-semibold transition-all duration-200 bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
          >
            Update Profile
          </button>
        </div>
      </form>
    </div>
  );
};

// Notifications List Component
export const NotificationsList = ({ notifications = [], markNotificationAsRead, markAllNotificationsAsRead, error }) => {
  console.log("[NotificationsList] Rendering, notifications:", notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Mark All as Read
          </button>
        )}
      </div>
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4 animate-fade-in">
          {error}
        </p>
      )}
      {notifications.length === 0 ? (
        <p className="text-gray-600">No notifications.</p>
      ) : (
        <>
          {notifications.every((n) => n.read) && (
            <p className="text-gray-600 mb-2">All notifications read.</p>
          )}
          <ul className="space-y-2">
            {notifications.map((notification) => (
              <li
                key={notification?._id || `notif-${Date.now()}`}
                className={`p-3 rounded-lg transition ${
                  notification.read ? "bg-gray-100" : "bg-blue-50"
                } hover:bg-blue-100`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-800">{notification?.message || "No message"}</p>
                    <p className="text-xs text-gray-500">
                      {notification?.createdAt
                        ? new Date(notification.createdAt).toLocaleString()
                        : "Unknown time"}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => markNotificationAsRead(notification._id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};