import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import io from "socket.io-client"
import {
  PatientSidebar,
  PatientHeader,
  AppointmentsSection,
  MedicalRecordsSection,
  EditProfileSection,
  DoctorsSection,

  DoctorSlotsPage,
} from "./Components/PatientComponents";
import { PatientChat } from "./Components/PatientChat";
import ResponseDetail from "./Components/ResponseDetails";
import PatientRecords from "./Components/PatientRecords";



// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-600 bg-red-100 border border-red-400 rounded p-3">
          <h3>Render Error</h3>
          <p>{this.state.error?.message || "Unknown rendering error"}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}



export default function PatientDashboard() {
  console.log("[PatientDashboard] Rendering");
  const [userData, setUserData] = useState({
    name: "",
    role: "",
    phoneNumber: "",
    profilePicture: null,
    twoFAEnabled: false,
    _id: "",
  });
  const [editData, setEditData] = useState({
    name: "",
    phoneNumber: "",
    profilePicture: null,
    twoFAEnabled: false,
  });
  const [previewUrl, setPreviewUrl] = useState("");
  const [hasProfilePicture, setHasProfilePicture] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("appointments");
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [timeFilter, setTimeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const reduxUser = useSelector((state) => state.auth.user) || null;

  // Compute unread count for Header
  const unreadCount = useMemo(() => {
    const count = notifications.filter((n) => !n.read).length;
    console.log("[PatientDashboard] Computed unreadCount:", count, {
      timestamp: new Date().toISOString(),
      notificationIds: notifications.map((n) => n._id),
    });
    return count;
  }, [notifications]);

  // Initialize Socket.IO
  const socket = useMemo(() => {
    const token = localStorage.getItem("token")?.replace(/^Bearer\s+/i, "") || "";
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    console.log("[Socket.IO] Initializing with URL:", apiUrl, "token:", token.slice(0, 20) + "...");
    return io(apiUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: false,
    });
  }, []);

  // Debounced notification update
  const debouncedSetNotifications = useCallback(
    debounce((newNotifications) => {
      setNotifications(newNotifications);
    }, 500),
    []
  );

  // Debounced fetch appointments
  const debouncedFetchAppointments = useCallback(
    debounce((filters) => {
      fetchAppointments(filters);
    }, 500),
    []
  );

  // Fetch user data
  const fetchUserData = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchUserData] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/user`;
      console.log("[fetchUserData] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[fetchUserData] Failed:", response.status, text);
        setError("Failed to fetch user data");
        localStorage.removeItem("token");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const data = await response.json();
      console.log("[fetchUserData] Data:", data);
      if (data.role !== "patient") {
        console.error("[fetchUserData] Access denied: Not a patient");
        setError("Access denied: Not a patient");
        localStorage.removeItem("token");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const profilePicture = data.profilePicture || null;
      const userInfo = {
        name: data.name || "",
        role: data.role || "",
        phoneNumber: data.phoneNumber || "",
        profilePicture,
        twoFAEnabled: !!data.twoFAEnabled,
        _id: data._id || "",
      };
      setUserData(userInfo);
      setEditData({
        name: data.name || "",
        phoneNumber: data.phoneNumber || "",
        profilePicture,
        twoFAEnabled: !!data.twoFAEnabled,
      });
      setHasProfilePicture(!!profilePicture);
    } catch (err) {
      console.error("[fetchUserData] Error:", err);
      setError("Failed to connect to server");
      localStorage.removeItem("token");
      dispatch(logout());
      navigate("/auth/signin", { replace: true });
    }
  };

  // Fetch appointments
  const fetchAppointments = async (filters = {}) => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchAppointments] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const queryParams = new URLSearchParams({
        timeFilter: filters.timeFilter || timeFilter,
        statusFilter: filters.statusFilter || statusFilter,
        doctorFilter: filters.doctorFilter || doctorFilter,
      }).toString();
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/appointments?${queryParams}`;
      console.log("[fetchAppointments] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[fetchAppointments] Failed:", response.status, text);
        setError("Failed to fetch appointments");
        setAppointments([]);
        return;
      }
      const data = await response.json();
      console.log("[fetchAppointments] Data:", data);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchAppointments] Error:", err);
      setError("Failed to fetch appointments");
      setAppointments([]);
    }
  };

  // Fetch doctors
  const fetchDoctors = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchDoctors] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/doctors`;
      console.log("[fetchDoctors] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[fetchDoctors] Failed:", response.status, text);
        setError("Failed to fetch doctors");
        setDoctors([]);
        return;
      }
      const data = await response.json();
      console.log("[fetchDoctors] Data:", data);
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchDoctors] Error:", err);
      setError("Failed to fetch doctors");
      setDoctors([]);
    }
  };

  // Fetch medical records
  const fetchMedicalRecords = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchMedicalRecords] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/medical-records`;
      console.log("[fetchMedicalRecords] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[fetchMedicalRecords] Failed:", response.status, text);
        setError("Failed to fetch medical records");
        setMedicalRecords([]);
        return;
      }
      const data = await response.json();
      console.log("[fetchMedicalRecords] Data:", data);
      setMedicalRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchMedicalRecords] Error:", err);
      setError("Failed to fetch medical records");
      setMedicalRecords([]);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchNotifications] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/notifications`;
      console.log("[fetchNotifications] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[fetchNotifications] Failed:", response.status, text);
        setError("Failed to fetch notifications");
        return;
      }
      const data = await response.json();
      console.log("[fetchNotifications] Data:", data);
      setNotifications((prev) => {
        const merged = [...data, ...prev.filter((n) => !data.some((d) => d._id === n._id))];
        return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
      });
    } catch (err) {
      console.error("[fetchNotifications] Error:", err);
      setError("Failed to fetch notifications");
    }
  };

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[markNotificationAsRead] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/notifications/${notificationId}/read`;
      console.log("[markNotificationAsRead] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[markNotificationAsRead] Failed:", response.status, text);
        setError("Failed to mark notification as read");
        return;
      }
      console.log("[markNotificationAsRead] Success");
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (err) {
      console.error("[markNotificationAsRead] Error:", err);
      setError("Failed to mark notification as read");
    }
  }, [dispatch, navigate]);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[markAllNotificationsAsRead] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/notifications/read-all`;
      console.log("[markAllNotificationsAsRead] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[markAllNotificationsAsRead] Failed:", response.status, text);
        setError("Failed to mark notifications as read");
        return;
      }
      console.log("[markAllNotificationsAsRead] Success");
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
    } catch (err) {
      console.error("[markAllNotificationsAsRead] Error:", err);
      setError("Failed to mark notifications as read");
    }
  }, [dispatch, navigate]);

  // Token validation effect
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("[useEffect] No token, redirecting to signin");
      dispatch(logout());
      navigate("/auth/signin", { replace: true });
    }
  }, [navigate, dispatch]);

  // Initialization effect
  useEffect(() => {
    console.log("[useEffect] Active section changed:", activeSection);
    const initialize = async () => {
      setIsLoading(true);
      try {
        const fetchPromises = [fetchUserData(), fetchNotifications()];
        if (activeSection === "appointments") {
          fetchPromises.push(fetchAppointments({ timeFilter, statusFilter, doctorFilter }));
        }
        if (activeSection === "doctors" || activeSection === "chat") {
          fetchPromises.push(fetchDoctors());
        }
        if (activeSection === "medicalRecords") {
          fetchPromises.push(fetchMedicalRecords());
        }
        await Promise.all(fetchPromises);
      } catch (err) {
        console.error("[useEffect] Initialization error:", err);
        setError("Initialization failed");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, [activeSection, dispatch, navigate, timeFilter, statusFilter, doctorFilter]);

  // Fallback polling for notifications
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[useEffect] Polling notifications");
      fetchNotifications();
    }, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Socket.IO effect
  useEffect(() => {
    console.log("[useEffect] Setting up Socket.IO", {
      reduxUserId: reduxUser?._id,
      userDataId: userData._id,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected to server");
      setSocketStatus("connected");
      const token = localStorage.getItem("token")?.replace(/^Bearer\s+/i, "") || "";
      console.log("[Socket.IO] Emitting authenticate with token:", token.slice(0, 20) + "...");
      socket.emit("authenticate", token);
      const userId = (reduxUser?._id || userData._id || "unknown").toString();
      console.log("[Socket.IO] Emitting join with userId:", userId);
      socket.emit("join", userId);
    });

    socket.on("authenticated", () => {
      console.log("[Socket.IO] Successfully authenticated");
      setSocketStatus("authenticated");
    });

    socket.on("error", (error) => {
      console.error("[Socket.IO] Server error:", error);
      setError(`Socket error: ${error}`);
      setSocketStatus("error");
      if (error === "Authentication failed") {
        console.log("[Socket.IO] Authentication failed, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
      }
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO] Connection error:", {
        message: err.message,
        cause: err.cause,
        context: err.context,
      });
      setError(`Socket connection failed: ${err.message}`);
      setSocketStatus("disconnected");
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected from server:", reason);
      setSocketStatus("disconnected");
    });

    socket.on("reconnect_attempt", (attempt) => {
      console.log("[Socket.IO] Reconnection attempt:", attempt);
      setSocketStatus(`reconnecting (${attempt})`);
    });

    socket.onAny((event, ...args) => {
      console.log("[Socket.IO] Received event:", event, { args, timestamp: new Date().toISOString() });
    });

    socket.on("appointmentUpdate", (data) => {
      console.log("[Socket.IO] Received appointmentUpdate:", { data, timestamp: new Date().toISOString() });
      debouncedSetNotifications((prev) => {
        const newNotification = {
          _id: data.notificationId || `temp-${Date.now()}`,
          message: data.message || `Appointment ${data.status}`,
          type: data.status === "accepted" ? "appointment_accepted" : "appointment_rejected",
          appointmentId: data.requestId,
          createdAt: new Date(data.createdAt || Date.now()),
          read: false,
        };
        const updated = [
          newNotification,
          ...prev.filter((n) => n._id !== newNotification._id),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
        console.log("[Socket.IO] Updated notifications:", updated.length, {
          timestamp: new Date().toISOString(),
          notificationIds: updated.map((n) => n._id),
        });
        return updated;
      });
      debouncedFetchAppointments({ timeFilter, statusFilter, doctorFilter });
      fetchNotifications();
    });

    socket.on("newAppointmentRequest", (data) => {
      console.log("[Socket.IO] Received newAppointmentRequest:", { data, timestamp: new Date().toISOString() });
      debouncedSetNotifications((prev) => {
        const newNotification = {
          _id: data.notificationId || `temp-${Date.now()}`,
          message: data.message || `Appointment request sent to ${data.doctor?.name || "Unknown"}`,
          type: "appointment_request_sent",
          appointmentId: data.requestId,
          createdAt: new Date(data.createdAt || Date.now()),
          read: false,
        };
        const updated = [
          newNotification,
          ...prev.filter((n) => n._id !== newNotification._id),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
        console.log("[Socket.IO] Updated notifications:", updated.length, {
          timestamp: new Date().toISOString(),
          notificationIds: updated.map((n) => n._id),
        });
        return updated;
      });
      debouncedFetchAppointments({ timeFilter, statusFilter, doctorFilter });
      fetchNotifications();
    });

    socket.on("appointmentRequestSent", (data) => {
      console.log("[Socket.IO] Received appointmentRequestSent:", { data, timestamp: new Date().toISOString() });
      debouncedSetNotifications((prev) => {
        const newNotification = {
          _id: data.notificationId || `temp-${Date.now()}`,
          message: data.message || `Appointment request sent`,
          type: "appointment_request_sent",
          appointmentId: data.requestId,
          createdAt: new Date(data.createdAt || Date.now()),
          read: false,
        };
        const updated = [
          newNotification,
          ...prev.filter((n) => n._id !== newNotification._id),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
        console.log("[Socket.IO] Updated notifications:", updated.length, {
          timestamp: new Date().toISOString(),
          notificationIds: updated.map((n) => n._id),
        });
        return updated;
      });
      debouncedFetchAppointments({ timeFilter, statusFilter, doctorFilter });
      fetchNotifications();
    });

    socket.connect();

    return () => {
      console.log("[useEffect] Cleaning up Socket.IO");
      socket.offAny();
      socket.off("connect");
      socket.off("authenticated");
      socket.off("error");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.off("reconnect_attempt");
      socket.off("appointmentUpdate");
      socket.off("newAppointmentRequest");
      socket.off("appointmentRequestSent");
      socket.disconnect();
    };
  }, [socket, dispatch, navigate, reduxUser, userData._id, timeFilter, statusFilter, doctorFilter]);

  // Log render loop debugging
  useEffect(() => {
    console.log("[useEffect] Render loop check - unreadCount:", unreadCount, "showNotifications:", showNotifications);
  }, [unreadCount, showNotifications]);

  // Handle logout
  const handleLogout = () => {
    console.log("[handleLogout] Logging out");
    localStorage.removeItem("token");
    socket.disconnect();
    dispatch(logout());
    navigate("/auth/signin", { replace: true });
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log("[handleInputChange] Input:", { name, value, type, checked });
    setEditData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle profile picture file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEditData((prev) => ({ ...prev, profilePicture: file }));
      setPreviewUrl(url);
      setHasProfilePicture(true);
      console.log("[handleFileChange] Selected file:", file.name);
    } else {
      setEditData((prev) => ({ ...prev, profilePicture: null }));
      setPreviewUrl("");
      setHasProfilePicture(false);
      console.log("[handleFileChange] No file selected");
    }
  };

  // Handle profile picture removal
  const handleRemovePicture = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("[handleRemovePicture] No token found");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }

      // Create FormData for the request
      const formData = new FormData();
      formData.append("name", editData.name);
      formData.append("phoneNumber", editData.phoneNumber || "");
      formData.append("twoFAEnabled", editData.twoFAEnabled.toString());
      formData.append("profilePicture", "null");

      // Update local state first
      setEditData(prev => ({
        ...prev,
        profilePicture: null
      }));
      setPreviewUrl("");
      setHasProfilePicture(false);

      // Then update on server
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("[handleRemovePicture] Failed to remove profile picture:", responseData);
        // Revert local state if server update fails
        setEditData(prev => ({
          ...prev,
          profilePicture: userData.profilePicture
        }));
        setPreviewUrl(userData.profilePicture ? `${import.meta.env.VITE_API_URL}${userData.profilePicture}` : "");
        setHasProfilePicture(!!userData.profilePicture);
        throw new Error(responseData.message || "Failed to remove profile picture");
      }

      // Update Redux state
      dispatch({ type: "auth/updateProfilePicture", payload: null });

      // Update local state
      setUserData(prev => ({
        ...prev,
        profilePicture: null
      }));

      // Update localStorage
      const authState = JSON.parse(localStorage.getItem('authState') || '{}');
      if (authState.user) {
        authState.user.profilePicture = null;
        localStorage.setItem('authState', JSON.stringify(authState));
      }

      setSuccess("Profile picture removed successfully");
      console.log("[handleRemovePicture] Profile picture removed successfully");
    } catch (err) {
      console.error("[handleRemovePicture] Error:", err);
      setError(err.message || "Failed to remove profile picture. Please try again.");
    }
  };

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[handleProfileUpdate] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }

      const formData = new FormData();
      formData.append("name", editData.name);
      formData.append("phoneNumber", editData.phoneNumber);
      formData.append("twoFAEnabled", editData.twoFAEnabled.toString());
      
      // Only append profilePicture if it's a File object
      if (editData.profilePicture instanceof File) {
        formData.append("profilePicture", editData.profilePicture);
      } else if (editData.profilePicture === null) {
        formData.append("profilePicture", "null");
      }

      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/profile`;
      console.log("[handleProfileUpdate] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[handleProfileUpdate] Failed:", response.status, text);
        setError(text || "Failed to update profile");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log("[handleProfileUpdate] Data:", data);
      setUserData({
        ...userData,
        name: data.name || editData.name,
        phoneNumber: data.phoneNumber || editData.phoneNumber,
        profilePicture: data.profilePicture || null,
        twoFAEnabled: data.twoFAEnabled || editData.twoFAEnabled,
      });
      setEditData({
        name: data.name || editData.name,
        phoneNumber: data.phoneNumber || editData.phoneNumber,
        profilePicture: data.profilePicture || null,
        twoFAEnabled: data.twoFAEnabled || editData.twoFAEnabled,
      });
      setHasProfilePicture(!!data.profilePicture);
      setPreviewUrl(data.profilePicture ? `${import.meta.env.VITE_API_URL}${data.profilePicture}?t=${Date.now()}` : "");
      dispatch({ type: "auth/updateProfilePicture", payload: data.profilePicture || null });
      setSuccess("Profile updated successfully");
    } catch (err) {
      console.error("[handleProfileUpdate] Error:", err);
      setError("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (filters) => {
    setTimeFilter(filters.timeFilter);
    setStatusFilter(filters.statusFilter);
    setDoctorFilter(filters.doctorFilter);
    debouncedFetchAppointments(filters);
  };

  // Clear filters
  const clearFilters = () => {
    setTimeFilter("");
    setStatusFilter("");
    setDoctorFilter("");
    debouncedFetchAppointments({ timeFilter: "", statusFilter: "", doctorFilter: "" });
  };

  // Toggle notifications
  const toggleNotifications = () => {
    setShowNotifications((prev) => {
      console.log("[toggleNotifications] showNotifications:", !prev);
      return !prev;
    });
  };

  // Update handleSectionChange function
  const handleSectionChange = (section) => {
    console.log("[handleSectionChange] Changing section to:", section);
    setActiveSection(section);
    
    // Force navigation to the correct route
    switch (section) {
      case "appointments":
        navigate("/patient-dashboard", { replace: true });
        break;
      case "medicalRecords":
        navigate("/patient-dashboard/medical-records", { replace: true });
        break;
      case "doctors":
        navigate("/patient-dashboard/doctors", { replace: true });
        break;
      case "edit-profile":
        navigate("/patient-dashboard/edit-profile", { replace: true });
        break;
      case "chat":
        navigate("/patient-dashboard/chat", { replace: true });
        break;
      default:
        navigate("/patient-dashboard", { replace: true });
    }
  };

  // Render appointments table
  const renderAppointmentsTable = () => {
    if (appointments.length === 0) {
      return (
        <p className="text-gray-600 bg-gray-100 border border-gray-200 rounded p-3">
          No appointments found.
        </p>
      );
    }

    return (
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Doctor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {appointments.map((appointment) => (
              <tr key={appointment._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {appointment.doctor?.name || "Unknown"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {appointment.date ? new Date(appointment.date).toISOString().split('T')[0] : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {appointment.time}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      appointment.status === "accepted"
                        ? "bg-green-100 text-green-800"
                        : appointment.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : appointment.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : appointment.status === "attended" || appointment.status === "completed"
                        ? "bg-blue-100 text-blue-800"
                        : appointment.status === "cancelled"
                        ? "bg-red-100 text-red-800"
                        : appointment.status === "absent"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {appointment.status === "attended" || appointment.status === "completed"
                      ? "completed"
                      : appointment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {appointment.reason}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => navigate(`/patient-dashboard/appointments/${appointment._id}`)}
                    className="text-blue-600 hover:text-blue-800"
                    title="View Details"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Update renderContent function
  const renderContent = () => {
    console.log("[renderContent] Rendering, current path:", window.location.pathname);
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    return (
      <ErrorBoundary>
        <div className="relative">
          <Routes>
            <Route path="/appointments/:id" element={<ResponseDetail />} />
            <Route
              path="*"
              element={
                <div className={window.location.pathname.includes('/appointments/') ? 'w-1/5' : 'w-full'}>
                  {activeSection === "appointments" && (
                    <AppointmentsSection
                      error={error}
                      appointmentsTable={renderAppointmentsTable()}
                      setActiveSection={setActiveSection}
                      timeFilter={timeFilter}
                      statusFilter={statusFilter}
                      doctorFilter={doctorFilter}
                      handleFilterChange={handleFilterChange}
                      clearFilters={clearFilters}
                      doctors={doctors}
                      navigate={navigate}
                    />
                  )}
                  {activeSection === "medicalRecords" && (
                    <PatientRecords />
                  )}
                  {activeSection === "doctors" && (
                    <DoctorsSection
                      doctors={doctors}
                      error={error}
                      navigate={navigate}
                    />
                  )}
                  {activeSection === "edit-profile" && (
                    <EditProfileSection
                      success={success}
                      error={error}
                      editData={editData}
                      handleInputChange={handleInputChange}
                      handleFileChange={handleFileChange}
                      handleRemovePicture={handleRemovePicture}
                      handleProfileUpdate={handleProfileUpdate}
                      isLoading={isLoading}
                      hasProfilePicture={hasProfilePicture}
                      previewUrl={previewUrl}
                      userData={userData}
                    />
                  )}
                  {activeSection === "chat" && (
                    <PatientChat userData={userData} socket={socket} appointments={appointments} />
                  )}
                </div>
              }
            />
          </Routes>
        </div>
      </ErrorBoundary>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex">
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in {
            animation: fadeIn 0.3s ease-out;
          }
        `}
      </style>
      <PatientSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        handleLogout={handleLogout}
      />
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <PatientHeader
            key={`header-${unreadCount}`}
            userData={userData}
            notifications={notifications}
            unreadCount={unreadCount}
            toggleNotifications={toggleNotifications}
            showNotifications={showNotifications}
            markNotificationAsRead={markNotificationAsRead}
            markAllNotificationsAsRead={markAllNotificationsAsRead}
            socketStatus={socketStatus}
          />
          <div className="text-sm text-gray-600 mb-4">
            Socket Status: <span className={socketStatus === "authenticated" ? "text-green-600" : "text-red-600"}>{socketStatus}</span>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}