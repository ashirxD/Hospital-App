import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Routes, Route, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  logout,
  setAvailability as setReduxAvailability,
} from "../redux/slices/authSlice";
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
import AppointmentDetails from "./Components/AppointmentDetails";
import axios from "axios";
import ViewRecords from './ViewRecords';

console.log("[DoctorDashboard] VITE_API_URL:", import.meta.env.VITE_API_URL);

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

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function DoctorDashboard() {
  const { patientId } = useParams();
  console.log("[DoctorDashboard] Mounted with patientId:", patientId);
  const { availability, dispatch: contextDispatch } = useAvailability() || {};
  const [userData, setUserData] = useState(() => {
    try {
      const savedData = localStorage.getItem("userData");
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
    return {
      _id: "",
      name: "",
      role: "",
      specialization: "",
      profilePicture: null,
      twoFAEnabled: false,
      availability: {
        startTime: "",
        endTime: "",
        days: [],
        slotDuration: 30,
        breakTime: 0,
        vacations: [],
      },
    };
  });

  const [editData, setEditData] = useState(() => {
    try {
      const savedData = localStorage.getItem("editData");
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (error) {
      console.error("Error loading edit data:", error);
    }
    return {
      name: userData.name || "",
      specialization: userData.specialization || "",
      profilePicture: userData.profilePicture,
      twoFAEnabled: userData.twoFAEnabled || false,
    };
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
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null); // New state
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const reduxUser = useSelector((state) => state.auth.user) || null;

  // Add new state for persisted data
  const [persistedData, setPersistedData] = useState(() => {
    try {
      const savedData = localStorage.getItem("doctorDashboardData");
      return savedData
        ? JSON.parse(savedData)
        : {
            appointments: [],
            appointmentRequests: [],
            notifications: [],
            activeSection: "appointments",
          };
    } catch (error) {
      console.error("Error loading persisted data:", error);
      return {
        appointments: [],
        appointmentRequests: [],
        notifications: [],
        activeSection: "appointments",
      };
    }
  });

  const unreadCount = useMemo(() => {
    const count = notifications.filter((n) => !n.read).length;
    console.log("[DoctorDashboard] Computed unreadCount:", count);
    return count;
  }, [notifications]);

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
    console.log("[DoctorDashboard] Toggled showNotifications");
  };

  const socket = useMemo(() => {
    const token =
      localStorage.getItem("token")?.replace(/^Bearer\s+/i, "") || "";
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    console.log(
      "[Socket.IO] Initializing with URL:",
      apiUrl,
      "token:",
      token.slice(0, 20) + "..."
    );
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

  // Save userData and editData to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("editData", JSON.stringify(editData));
    } catch (error) {
      console.error("Error saving data:", error);
    }
  }, [userData, editData]);

  // Update fetchUserData to properly handle state restoration
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

      // Fetch user data
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

      // Fetch ratings data
      const ratingsUrl = `${
        import.meta.env.VITE_API_URL
      }/api/doctor/reviews/stats`;
      console.log("[fetchUserData] Fetching ratings:", ratingsUrl);
      const ratingsResponse = await fetch(ratingsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (ratingsResponse.ok) {
        const ratingsData = await ratingsResponse.json();
        console.log("[fetchUserData] Ratings data:", ratingsData);
        setAverageRating(ratingsData.averageRating || 0);
        setTotalReviews(ratingsData.totalReviews || 0);
      } else {
        console.error(
          "[fetchUserData] Failed to fetch ratings:",
          await ratingsResponse.text()
        );
      }

      const profilePicture = data.profilePicture || null;
      const userInfo = {
        _id: data._id || "",
        name: data.name || "",
        role: data.role || "",
        specialization: data.specialization || "",
        profilePicture,
        twoFAEnabled: !!data.twoFAEnabled,
        availability: {
          startTime: data.availability?.startTime || "",
          endTime: data.availability?.endTime || "",
          days: data.availability?.days || [],
          slotDuration: data.availability?.slotDuration || 30,
          breakTime: data.availability?.breakTime || 0,
          vacations: data.availability?.vacations || [],
        },
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
        const availabilityData = {
          startTime: data.availability.startTime || "",
          endTime: data.availability.endTime || "",
          days: data.availability.days || [],
          slotDuration: data.availability.slotDuration || 30,
          breakTime: data.availability.breakTime || 0,
          vacations: data.availability.vacations || [],
        };

        dispatch(setReduxAvailability(availabilityData));
        if (contextDispatch) {
          contextDispatch({
            type: "SET_AVAILABILITY",
            payload: availabilityData,
          });
        }
      }
    } catch (err) {
      console.error("[fetchUserData] Error:", err);
      setError("Failed to connect to server");
      localStorage.removeItem("token");
      dispatch(logout());
      navigate("/auth/signin", { replace: true });
    }
  };

  const fetchAppointmentRequests = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log(
          "[fetchAppointmentRequests] No token, redirecting to signin"
        );
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${
        import.meta.env.VITE_API_URL
      }/api/doctor/appointment/requests`;
      console.log("[fetchAppointmentRequests] Fetching:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.error(
          "[fetchAppointmentRequests] Failed:",
          response.status,
          text
        );
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
        console.error(
          "[fetchAppointments] Failed:",
          response.status,
          data.message || text
        );
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
        const merged = [
          ...data,
          ...prev.filter((n) => !data.some((d) => d._id === n._id)),
        ];
        return merged.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
      });
    } catch (err) {
      console.error("[fetchNotifications] Error:", err);
      setError("Failed to fetch notifications");
    }
  };

  const markNotificationAsRead = useCallback(
    async (notificationId) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.log(
            "[markNotificationAsRead] No token, redirecting to signin"
          );
          dispatch(logout());
          navigate("/auth/signin", { replace: true });
          return;
        }
        const apiUrl = `${
          import.meta.env.VITE_API_URL
        }/api/notifications/${notificationId}/read`;
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
          console.error(
            "[markNotificationAsRead] Failed:",
            response.status,
            text
          );
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
    },
    [dispatch, navigate]
  );

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log(
          "[markAllNotificationsAsRead] No token, redirecting to signin"
        );
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      const apiUrl = `${
        import.meta.env.VITE_API_URL
      }/api/doctor/notifications/read-all`;
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
        console.error(
          "[markAllNotificationsAsRead] Failed:",
          response.status,
          text
        );
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

  const debouncedSetNotifications = useCallback(
    debounce((newNotifications) => {
      setNotifications(newNotifications);
    }, 500),
    []
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("[useEffect] No token, redirecting to signin");
      navigate("/auth/signin", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    console.log("[useEffect] Active section changed:", activeSection);
    const initialize = async () => {
      setIsLoading(true);
      try {
        const fetchPromises = [fetchUserData(), fetchNotifications()];
        if (activeSection === "appointment-requests") {
          fetchPromises.push(fetchAppointmentRequests());
        }
        if (
          activeSection === "patients" ||
          activeSection === "appointments" ||
          activeSection === "chat"
        ) {
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

  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[useEffect] Polling notifications");
      fetchNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log("[useEffect] Setting up Socket.IO", {
      reduxUserId: reduxUser?._id,
      userDataId: userData._id,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected to server");
      setSocketStatus("connected");
      const token =
        localStorage.getItem("token")?.replace(/^Bearer\s+/i, "") || "";
      console.log(
        "[Socket.IO] Emitting authenticate with token:",
        token.slice(0, 20) + "..."
      );
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
      console.log("[Socket.IO] Received event:", event, {
        args,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("newAppointmentRequest", (request) => {
      console.log("[Socket.IO] New appointment request:", request);
      debouncedSetNotifications((prev) => {
        const newNotification = {
          _id: request.notificationId || request._id || `temp-${Date.now()}`,
          message:
            request.message ||
            `New appointment request from ${
              request.patient?.name || "Unknown"
            }`,
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
        return updated.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
      });
      if (activeSection === "appointment-requests") {
        fetchAppointmentRequests();
      }
    });

    socket.on(
      "appointmentUpdate",
      ({ requestId, status, message, notificationId }) => {
        console.log("[Socket.IO] Appointment update:", {
          requestId,
          status,
          message,
          notificationId,
        });
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
          return updated.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
        });
        if (activeSection === "appointment-requests") {
          fetchAppointmentRequests();
        }
        if (activeSection === "appointments" && status === "accepted") {
          fetchAppointments();
        }
      }
    );

    socket.on("notificationsMarkedAsRead", ({ userId, timestamp }) => {
      console.log("[Socket.IO] Notifications marked as read:", {
        userId,
        timestamp,
      });
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

  useEffect(() => {
    console.log(
      "[useEffect] Render loop check - unreadCount:",
      unreadCount,
      "showNotifications:",
      showNotifications
    );
  }, [unreadCount, showNotifications]);

  // Initialize availability from Redux
  useEffect(() => {
    if (reduxUser?.availability) {
      const newAvailability = {
        startTime: reduxUser.availability.startTime || "",
        endTime: reduxUser.availability.endTime || "",
        days: reduxUser.availability.days || [],
        slotDuration: reduxUser.availability.slotDuration || 30,
        breakTime: reduxUser.availability.breakTime || 0,
      };

      // Update context state
      if (contextDispatch) {
        contextDispatch({
          type: "SET_AVAILABILITY",
          payload: newAvailability,
        });
      }
    }
  }, [reduxUser, contextDispatch]);

  // Update handleLogout to clear all persisted data
  const handleLogout = () => {
    console.log("[handleLogout] Logging out");
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    localStorage.removeItem("editData");
    localStorage.removeItem("doctorDashboardData");
    socket.disconnect();
    dispatch(logout());
    navigate("/auth/signin", { replace: true });
  };

  const handleInputChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target;
      console.log("[handleInputChange] Input:", { name, value, type, checked });

      if (name === "days") {
        const newDays = checked
          ? [...(availability?.days || []), value]
          : (availability?.days || []).filter((day) => day !== value);

        const newAvailability = { ...availability, days: newDays };

        // Update both context and Redux
        if (contextDispatch) {
          contextDispatch({
            type: "SET_AVAILABILITY",
            payload: newAvailability,
          });
        }
        dispatch(setReduxAvailability(newAvailability));
      } else if (
        name === "startTime" ||
        name === "endTime" ||
        name === "slotDuration" ||
        name === "breakTime"
      ) {
        const newAvailability = {
          ...availability,
          [name]: name === "breakTime" ? parseInt(value) : value,
        };

        // Update both context and Redux
        if (contextDispatch) {
          contextDispatch({
            type: "SET_AVAILABILITY",
            payload: newAvailability,
          });
        }
        dispatch(setReduxAvailability(newAvailability));
      } else {
        setEditData((prev) => ({
          ...prev,
          [name]: type === "checkbox" ? checked : value,
        }));
      }
    },
    [availability, contextDispatch, dispatch]
  );

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
          name: userData.name,
          specialization: userData.specialization,
          availability: userData.availability,
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

      // Update all relevant states
      setUserData((prev) => ({ ...prev, profilePicture: null }));
      setEditData((prev) => ({ ...prev, profilePicture: null }));
      setPreviewUrl("");
      setHasProfilePicture(false);
      setSuccess("Profile picture removed successfully");

      // Update Redux state
      dispatch({ type: "auth/updateProfilePicture", payload: null });

      // Update localStorage
      const updatedUserData = { ...userData, profilePicture: null };
      const updatedEditData = { ...editData, profilePicture: null };
      localStorage.setItem("userData", JSON.stringify(updatedUserData));
      localStorage.setItem("editData", JSON.stringify(updatedEditData));
      localStorage.removeItem("editProfileFormData");

      // Force a re-render of the form
      setActiveSection((prev) => {
        const newSection = prev === "edit-profile" ? "appointments" : prev;
        setTimeout(() => setActiveSection("edit-profile"), 0);
        return newSection;
      });
    } catch (err) {
      console.error("[handleRemovePicture] Error:", err);
      setError("Failed to connect to server");
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleProfileUpdate = async (formData) => {
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

      const data = new FormData();
      data.append("name", formData.name);
      data.append("specialization", formData.specialization);
      data.append("startTime", formData.availability.startTime);
      data.append("endTime", formData.availability.endTime);
      data.append("days", JSON.stringify(formData.availability.days));
      data.append("slotDuration", formData.availability.slotDuration);
      data.append("breakTime", formData.availability.breakTime);
      data.append("vacations", JSON.stringify(formData.availability.vacations));

      // Handle profile picture
      if (formData.profilePicture === null) {
        // If profile picture is null, send it as null to remove it
        data.append("profilePicture", "null");
      } else if (formData.profilePicture instanceof File) {
        // If it's a new file, append it
        data.append("profilePicture", formData.profilePicture);
      }

      console.log("[handleProfileUpdate] Sending data:", {
        name: formData.name,
        specialization: formData.specialization,
        profilePicture: formData.profilePicture === null ? "null" : "file",
        availability: {
          startTime: formData.availability.startTime,
          endTime: formData.availability.endTime,
          days: formData.availability.days,
          slotDuration: formData.availability.slotDuration,
          breakTime: formData.availability.breakTime,
          vacations: formData.availability.vacations,
        },
      });

      const response = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/doctor/profile`,
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.user) {
        // Update Redux state with new availability including vacations
        dispatch(
          setReduxAvailability({
            startTime: formData.availability.startTime,
            endTime: formData.availability.endTime,
            days: formData.availability.days,
            slotDuration: formData.availability.slotDuration,
            breakTime: formData.availability.breakTime,
            vacations: formData.availability.vacations,
          })
        );

        // Update context state
        if (contextDispatch) {
          contextDispatch({
            type: "SET_AVAILABILITY",
            payload: {
              startTime: formData.availability.startTime,
              endTime: formData.availability.endTime,
              days: formData.availability.days,
              slotDuration: formData.availability.slotDuration,
              breakTime: formData.availability.breakTime,
              vacations: formData.availability.vacations,
            },
          });
        }

        // Update user data
        const updatedUserData = {
          ...userData,
          name: formData.name,
          specialization: formData.specialization,
          profilePicture:
            formData.profilePicture === null
              ? null
              : response.data.user.profilePicture || userData.profilePicture,
          availability: {
            startTime: formData.availability.startTime,
            endTime: formData.availability.endTime,
            days: formData.availability.days,
            slotDuration: formData.availability.slotDuration,
            breakTime: formData.availability.breakTime,
            vacations: formData.availability.vacations,
          },
        };

        setUserData(updatedUserData);
        setEditData({
          name: formData.name,
          specialization: formData.specialization,
          profilePicture:
            formData.profilePicture === null
              ? null
              : response.data.user.profilePicture || userData.profilePicture,
          twoFAEnabled: userData.twoFAEnabled,
        });

        // Update localStorage
        localStorage.setItem("userData", JSON.stringify(updatedUserData));
        localStorage.setItem(
          "editData",
          JSON.stringify({
            name: formData.name,
            specialization: formData.specialization,
            profilePicture:
              formData.profilePicture === null
                ? null
                : response.data.user.profilePicture || userData.profilePicture,
            twoFAEnabled: userData.twoFAEnabled,
          })
        );

        setSuccess("Profile updated successfully!");
        setError(null);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setError(error.response?.data?.message || "Failed to update profile");
      setSuccess(null);
    } finally {
      setIsLoading(false);
    }
  };

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
      const apiUrl = `${
        import.meta.env.VITE_API_URL
      }/api/doctor/appointment/accept`;
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
      setAppointmentRequests((prev) =>
        prev.filter((req) => req._id !== requestId)
      );
      setSuccess("Appointment request accepted");
      if (activeSection === "appointments") {
        fetchAppointments();
      }
    } catch (err) {
      console.error("[handleAcceptRequest] Error:", err);
      setError("Failed to accept the request");
    }
  };

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
      const apiUrl = `${
        import.meta.env.VITE_API_URL
      }/api/doctor/appointment/reject`;
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
      setAppointmentRequests((prev) =>
        prev.filter((req) => req._id !== requestId)
      );
      setSuccess("Appointment request rejected");
      if (activeSection === "appointment-requests") {
        fetchAppointmentRequests();
      }
    } catch (err) {
      console.error("[handleRejectRequest] Error:", err);
      setError("Failed to reject the request");
    }
  };

  const handleViewDetails = (appointmentId) => {
    setSelectedAppointmentId(appointmentId);
    console.log("[handleViewDetails] Selected appointment:", appointmentId);
  };

  const handleCloseDetails = () => {
    setSelectedAppointmentId(null);
    console.log("[handleCloseDetails] Closed appointment details");
  };

  const renderContent = () => {
    const currentPath = window.location.pathname;
    console.log("[renderContent] Rendering, current path:", currentPath);
    
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    // Check if we're on the records view path
    const isRecordsView = currentPath.includes('/doctor-dashboard/patients/') && currentPath.includes('/records');
    console.log("[renderContent] Is records view:", isRecordsView, "patientId:", patientId);
    
    if (isRecordsView) {
      console.log("[renderContent] Rendering records view for patient:", patientId);
      return (
        <ErrorBoundary>
          <ViewRecords />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        {activeSection === "appointments" && (
          <AppointmentsTable
            appointments={appointments}
            error={error}
            normalizeTime={normalizeTime}
            onViewDetails={handleViewDetails}
          />
        )}
        {activeSection === "patients" && (
          <PatientsList appointments={appointments} error={error} />
        )}
        {activeSection === "appointment-requests" && (
          <AppointmentRequestsTable
            appointmentRequests={appointmentRequests}
            handleAcceptRequest={handleAcceptRequest}
            handleRejectRequest={handleRejectRequest}
            error={error}
            normalizeTime={normalizeTime}
          />
        )}
        {activeSection === "edit-profile" && (
          <EditProfileForm
            user={userData}
            onUpdate={handleProfileUpdate}
            onCancel={() => setActiveSection("appointments")}
          />
        )}
        {activeSection === "chat" && (
          <DoctorChat
            userData={userData}
            socket={socket}
            appointments={appointments}
          />
        )}
        {selectedAppointmentId && (
          <>
            <div
              className="fixed inset-0 z-10"
              style={{
                background: "rgba(107, 114, 128, 0.2)",
                width: "80vw",
                left: 0,
                right: "20vw",
              }}
              onClick={handleCloseDetails}
            ></div>
            <AppointmentDetails
              appointmentId={selectedAppointmentId}
              onClose={handleCloseDetails}
            />
          </>
        )}
      </ErrorBoundary>
    );
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
      <div className="flex-1 p-8 relative">
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
            availability={availability}
            averageRating={averageRating}
            totalReviews={totalReviews}
          />
          <div className="text-sm text-gray-600 mb-4">
            Socket Status:{" "}
            <span
              className={
                socketStatus === "authenticated"
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              {socketStatus}
            </span>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
