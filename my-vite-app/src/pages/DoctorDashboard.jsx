import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout, setAvailability as setReduxAvailability } from "../redux/slices/authSlice";
import { useAvailability } from "../context/AvailabilityContext";
import { DoctorChat } from "./Components/DoctorChat";
import io from "socket.io-client";
import {
  Sidebar,
  Header,
  AppointmentsTable,
  PatientsList,
  AppointmentRequestsTable,
  EditProfileForm,
  NotificationsList,
} from "./Components/DoctorComponents";

// Log API URL for debugging
console.log("[DoctorDashboard] VITE_API_URL:", import.meta.env.VITE_API_URL);

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

export default function DoctorDashboard() {
  console.log("[DoctorDashboard] Rendering");
  const { availability, dispatch: contextDispatch } = useAvailability() || {};
  const [userData, setUserData] = useState({
    _id: "",
    name: "",
    role: "",
    specialization: "",
    profilePicture: null,
    twoFAEnabled: false,
  });
  const [editData, setEditData] = useState({
    name: "",
    specialization: "",
    profilePicture: null,
    twoFAEnabled: false,
  });
  const [previewUrl, setPreviewUrl] = useState("");
  const [hasProfilePicture, setHasProfilePicture] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("appointments");
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const reduxUser = useSelector((state) => state.auth.user) || null;

  // Compute unread count for Header
  const unreadCount = useMemo(() => {
    const count = notifications.filter((n) => !n.read).length;
    console.log("[DoctorDashboard] Computed unreadCount:", count);
    return count;
  }, [notifications]);

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
    console.log("[DoctorDashboard] Toggled showNotifications");
  };

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

  // Normalize time format
  const normalizeTime = (time) => {
    if (!time || typeof time !== "string" || time.trim() === "") {
      console.warn("[normalizeTime] Invalid time:", time);
      return "";
    }
    try {
      const [hours, minutes] = time.split(":").slice(0, 2);
      return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    } catch (err) {
      console.error("[normalizeTime] Error:", time, err);
      return time;
    }
  };

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
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/user`;
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
      if (data.role !== "doctor") {
        console.error("[fetchUserData] Access denied: Not a doctor");
        setError("Access denied: Not a doctor");
        localStorage.removeItem("token");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const profilePicture = data.profilePicture || null;
      const userInfo = {
        _id: data._id || "",
        name: data.name || "",
        role: data.role || "",
        specialization: data.specialization || "",
        profilePicture,
        twoFAEnabled: !!data.twoFAEnabled,
      };
      setUserData(userInfo);
      setEditData({
        name: data.name || "",
        specialization: data.specialization || "",
        profilePicture,
        twoFAEnabled: !!data.twoFAEnabled,
      });
      setHasProfilePicture(!!profilePicture);
      if (data.availability) {
        dispatch(setReduxAvailability({
          days: data.availability.days || [],
          startTime: data.availability.startTime || "",
          endTime: data.availability.endTime || "",
        }));
      }
    } catch (err) {
      console.error("[fetchUserData] Error:", err);
      setError("Failed to connect to server");
      localStorage.removeItem("token");
      dispatch(logout());
      navigate("/auth/signin", { replace: true });
    }
  };

  // Fetch appointment requests
  const fetchAppointmentRequests = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchAppointmentRequests] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointment/requests`;
      console.log("[fetchAppointmentRequests] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[fetchAppointmentRequests] Failed:", response.status, text);
        setError("Failed to fetch appointment requests");
        setAppointmentRequests([]);
        return;
      }
      const data = await response.json();
      console.log("[fetchAppointmentRequests] Data:", data);
      setAppointmentRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchAppointmentRequests] Error:", err);
      setError("Failed to fetch appointment requests");
      setAppointmentRequests([]);
    }
  };

  // Fetch appointments
  const fetchAppointments = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchAppointments] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointments`;
      console.log("[fetchAppointments] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("[fetchAppointments] Invalid JSON:", text);
        setError("Invalid server response");
        setAppointments([]);
        return;
      }
      if (!response.ok) {
        console.error("[fetchAppointments] Failed:", response.status, data.message || text);
        setError(data.message || "Failed to fetch appointments");
        setAppointments([]);
        return;
      }
      console.log("[fetchAppointments] Data:", data);
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[fetchAppointments] Error:", err);
      setError("Failed to fetch appointments");
      setAppointments([]);
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
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/notifications`;
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
        return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/notifications/${notificationId}/read`;
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
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/notifications/read-all`;
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
        setError("Failed to mark all notifications as read");
        return;
      }
      console.log("[markAllNotificationsAsRead] Success");
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
    } catch (err) {
      console.error("[markAllNotificationsAsRead] Error:", err);
      setError("Failed to mark all notifications as read");
    }
  }, [dispatch, navigate]);

  // Debounced notification update
  const debouncedSetNotifications = useCallback(
    debounce((newNotifications) => {
      setNotifications(newNotifications);
    }, 500),
    []
  );

  // Token validation effect
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("[useEffect] No token, redirecting to signin");
      navigate("/auth/signin", { replace: true });
    }
  }, [navigate]);

  // Initialization effect
  useEffect(() => {
    console.log("[useEffect] Active section changed:", activeSection);
    const initialize = async () => {
      setIsLoading(true);
      try {
        const fetchPromises = [fetchUserData(), fetchNotifications()];
        if (activeSection === "appointment-requests") {
          fetchPromises.push(fetchAppointmentRequests());
        }
        if (activeSection === "patients" || activeSection === "appointments" || activeSection === "chat") {
          fetchPromises.push(fetchAppointments());
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
  }, [activeSection, dispatch, navigate]);

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

    socket.on("newAppointmentRequest", (request) => {
      console.log("[Socket.IO] New appointment request:", request);
      debouncedSetNotifications((prev) => {
        const newNotification = {
          _id: request.notificationId || request._id || `temp-${Date.now()}`,
          message: request.message || `New appointment request from ${request.patient?.name || "Unknown"}`,
          type: "appointment_request",
          appointmentId: request._id,
          read: false,
          createdAt: new Date(request.createdAt || Date.now()),
        };
        const updated = [
          newNotification,
          ...prev.filter((n) => n._id !== newNotification._id),
        ];
        console.log("[Socket.IO] Updated notifications:", updated);
        return updated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
      if (activeSection === "appointment-requests") {
        fetchAppointmentRequests();
      }
    });

    socket.on("appointmentUpdate", ({ requestId, status, message, notificationId }) => {
      console.log("[Socket.IO] Appointment update:", { requestId, status, message, notificationId });
      debouncedSetNotifications((prev) => {
        const newNotification = {
          _id: notificationId || `temp-${Date.now()}`,
          message: message || `Appointment ${status}`,
          type: `appointment_${status}`,
          appointmentId: requestId,
          read: false,
          createdAt: new Date(),
        };
        const updated = [
          newNotification,
          ...prev.filter((n) => n._id !== newNotification._id),
        ];
        console.log("[Socket.IO] Updated notifications:", updated);
        return updated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      });
      if (activeSection === "appointment-requests") {
        fetchAppointmentRequests();
      }
      if (activeSection === "appointments" && status === "accepted") {
        fetchAppointments();
      }
    });

    socket.on("notificationsMarkedAsRead", ({ userId, timestamp }) => {
      console.log("[Socket.IO] Notifications marked as read:", { userId, timestamp });
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
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
      socket.off("newAppointmentRequest");
      socket.off("appointmentUpdate");
      socket.off("notificationsMarkedAsRead");
      socket.disconnect();
    };
  }, [socket, dispatch, navigate, reduxUser, userData._id, activeSection]);

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
    if (name === "days") {
      const newDays = checked
        ? [...(availability?.days || []), value]
        : (availability?.days || []).filter((day) => day !== value);
      if (contextDispatch) {
        contextDispatch({ type: "SET_AVAILABILITY", payload: { ...availability, days: newDays } });
      }
      dispatch(setReduxAvailability({ ...availability, days: newDays }));
    } else if (name === "startTime" || name === "endTime") {
      if (contextDispatch) {
        contextDispatch({ type: "SET_AVAILABILITY", payload: { ...availability, [name]: value } });
      }
      dispatch(setReduxAvailability({ ...availability, [name]: value }));
    } else {
      setEditData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
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
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[handleRemovePicture] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      if (!editData.name) {
        console.error("[handleRemovePicture] Name missing:", editData);
        setError("Cannot remove picture: User name is missing");
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/profile`;
      console.log("[handleRemovePicture] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profilePicture: null,
          name: editData.name,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[handleRemovePicture] Failed:", response.status, text);
        setError("Failed to remove profile picture");
        return;
      }
      const data = await response.json();
      console.log("[handleRemovePicture] Data:", data);
      setUserData((prev) => ({ ...prev, profilePicture: null }));
      setEditData((prev) => ({ ...prev, profilePicture: null }));
      setPreviewUrl("");
      setHasProfilePicture(false);
      setSuccess("Profile picture removed successfully");
      dispatch({ type: "auth/updateProfilePicture", payload: null });
    } catch (err) {
      console.error("[handleRemovePicture] Error:", err);
      setError("Failed to connect to server");
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
    if (!availability?.startTime || !availability?.endTime) {
      setError("Please provide both start and end times");
      setIsLoading(false);
      return;
    }
    if (!availability?.days || availability.days.length === 0) {
      setError("Please select at least one shift day");
      setIsLoading(false);
      return;
    }
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
      formData.append("specialization", editData.specialization);
      formData.append("twoFAEnabled", editData.twoFAEnabled.toString());
      formData.append("startTime", availability.startTime);
      formData.append("endTime", availability.endTime);
      formData.append("days", JSON.stringify(availability.days));
      if (editData.profilePicture instanceof File) {
        formData.append("profilePicture", editData.profilePicture);
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/profile`;
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
        setError("Failed to update profile");
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      console.log("[handleProfileUpdate] Data:", data);
      setUserData({
        ...userData,
        name: data.user.name || editData.name,
        specialization: data.user.specialization || editData.specialization,
        profilePicture: data.user.profilePicture || null,
        twoFAEnabled: data.user.twoFAEnabled || editData.twoFAEnabled,
      });
      setEditData({
        name: data.user.name || editData.name,
        specialization: data.user.specialization || editData.specialization,
        profilePicture: data.user.profilePicture || null,
        twoFAEnabled: data.user.twoFAEnabled || editData.twoFAEnabled,
      });
      setHasProfilePicture(!!data.user.profilePicture);
      setPreviewUrl(data.user.profilePicture ? `${import.meta.env.VITE_API_URL}${data.user.profilePicture}?t=${Date.now()}` : "");
      dispatch({ type: "auth/updateProfilePicture", payload: data.user.profilePicture || null });
      dispatch(setReduxAvailability({
        startTime: data.user.availability?.startTime || availability.startTime,
        endTime: data.user.availability?.endTime || availability.endTime,
        days: data.user.availability?.days || availability.days,
      }));
      setSuccess("Profile updated successfully");
    } catch (err) {
      console.error("[handleProfileUpdate] Error:", err);
      setError("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle accept appointment request
  const handleAcceptRequest = async (requestId) => {
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[handleAcceptRequest] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointment/accept`;
      console.log("[handleAcceptRequest] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[handleAcceptRequest] Failed:", response.status, text);
        setError("Failed to accept appointment request");
        return;
      }
      const data = await response.json();
      console.log("[handleAcceptRequest] Data:", data);
      setAppointmentRequests((prev) => prev.filter((req) => req._id !== requestId));
      setSuccess("Appointment request accepted");
      if (activeSection === "appointments") {
        fetchAppointments();
      }
    } catch (err) {
      console.error("[handleAcceptRequest] Error:", err);
      setError("Failed to accept the request");
    }
  };

  // Handle reject appointment request
  const handleRejectRequest = async (requestId) => {
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[handleRejectRequest] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointment/reject`;
      console.log("[handleRejectRequest] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("[handleRejectRequest] Failed:", response.status, text);
        setError("Failed to reject appointment request");
        return;
      }
      const data = await response.json();
      console.log("[handleRejectRequest] Data:", data);
      setAppointmentRequests((prev) => prev.filter((req) => req._id !== requestId));
      setSuccess("Appointment request rejected");
      if (activeSection === "appointment-requests") {
        fetchAppointmentRequests();
      }
    } catch (err) {
      console.error("[handleRejectRequest] Error:", err);
      setError("Failed to reject the request");
    }
  };

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (activeSection) {
      case "appointments":
        return (
          <ErrorBoundary>
            <AppointmentsTable
              appointments={appointments}
              error={error}
              normalizeTime={normalizeTime}
            />
          </ErrorBoundary>
        );
      case "patients":
        return (
          <ErrorBoundary>
            <PatientsList
              appointments={appointments}
              error={error}
            />
          </ErrorBoundary>
        );
      case "appointment-requests":
        return (
          <ErrorBoundary>
            <AppointmentRequestsTable
              appointmentRequests={appointmentRequests}
              handleAcceptRequest={handleAcceptRequest}
              handleRejectRequest={handleRejectRequest}
              error={error}
              normalizeTime={normalizeTime}
            />
          </ErrorBoundary>
        );
      case "edit-profile":
        return (
          <ErrorBoundary>
            <EditProfileForm
              editData={editData}
              handleInputChange={handleInputChange}
              handleFileChange={handleFileChange}
              handleRemovePicture={handleRemovePicture}
              handleProfileUpdate={handleProfileUpdate}
              availability={availability}
              previewUrl={previewUrl}
              hasProfilePicture={hasProfilePicture}
              isLoading={isLoading}
              error={error}
              success={success}
            />
          </ErrorBoundary>
        );
      case "chat":
        return (
          <ErrorBoundary>
            <DoctorChat userData={userData} socket={socket} appointments={appointments} />
          </ErrorBoundary>
        );
      default:
        return (
          <div className="text-gray-600">
            Invalid section selected. Please choose a valid section.
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex">
      <style jsx>{`
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
      `}</style>
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        handleLogout={handleLogout}
      />
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <Header
            userData={userData}
            notifications={notifications}
            unreadCount={unreadCount}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
            toggleNotifications={toggleNotifications}
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