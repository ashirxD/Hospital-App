import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./BookAppointment.css";

export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [appointmentData, setAppointmentData] = useState({
    doctorId: doctorId || "",
    date: "",
    time: "",
    reason: "",
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const [requestId, setRequestId] = useState(null);

  // Validate doctorId format
  const isValidDoctorId = (id) => {
    return id && typeof id === "string" && id.trim() !== "" && /^[0-9a-fA-F]{24}$/.test(id);
  };

  // Fetch doctor details
 useEffect(() => {
    const fetchDoctor = async () => {
      setIsLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.log("[BookAppointmentPage] No token, redirecting to signin");
          dispatch(logout());
          navigate("/auth/signin", { replace: true });
          return;
        }

        // Validate doctorId
        if (!id || typeof id !== "string" || id.trim() === "" || !/^[0-9a-fA-F]{24}$/.test(id)) {
          console.error("[BookAppointmentPage] Invalid doctorId:", id);
          setError("Invalid doctor ID. Redirecting to dashboard...");
          setTimeout(() => navigate("/patient"), 2000);
          setIsLoading(false);
          return;
        }

        console.log("[BookAppointmentPage] Fetching doctor:", { doctorId: id });
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/doctors/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const text = await response.text();
          console.error("[BookAppointmentPage] Failed to fetch doctor:", text);
          setError("Failed to fetch doctor details");
          setIsLoading(false);
          return;
        }
        const data = await response.json();
        setDoctor(data);
      } catch (err) {
        console.error("[BookAppointmentPage] Error:", err);
        setError("Failed to connect to server");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDoctor();
  }, [id, navigate, dispatch]);

  // Fetch available slots
  const fetchAvailableSlots = async (date) => {
    if (!date) return;
    setIsSlotsLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/patient/doctors/${doctorId}/slots?date=${date}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      console.log("[fetchAvailableSlots] Response:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error("[fetchAvailableSlots] Failed:", data.message);
        setError(data.message || "Failed to fetch available slots");
        setAvailableSlots([]);
        setIsSlotsLoading(false);
        return;
      }

      setAvailableSlots(data);
      setAppointmentData((prev) => ({ ...prev, time: "" }));
    } catch (err) {
      console.error("[fetchAvailableSlots] Error:", err);
      setError("Failed to connect to server. Please try again.");
      setAvailableSlots([]);
    } finally {
      setIsSlotsLoading(false);
    }
  };

  // Fetch appointment request status
  const fetchRequestStatus = async (reqId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[fetchRequestStatus] No token found, redirecting to signin");
        setError("Please sign in to view request status.");
        setTimeout(() => navigate("/auth/signin"), 2000);
        return;
      }

      console.log("[fetchRequestStatus] Fetching status for requestId:", reqId);
      const response = await fetch("http://localhost:5000/api/patient/appointments", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      console.log("[fetchRequestStatus] Response:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error("[fetchRequestStatus] Failed:", data.message);
        setError(data.message || "Failed to fetch request status");
        return;
      }

      const request = data.find((req) => req._id === reqId);
      if (request) {
        console.log("[fetchRequestStatus] Found request:", request);
        setRequestStatus({
          status: request.status,
          date: request.date,
          time: request.time,
          doctorName: request.doctor?.name || "Unknown Doctor",
        });
      } else {
        console.warn("[fetchRequestStatus] Request not found:", reqId);
        setError("Appointment request not found.");
      }
    } catch (err) {
      console.error("[fetchRequestStatus] Error:", err);
      setError("Failed to connect to server. Please try again.");
    }
  };

  useEffect(() => {
    if (doctorId) {
      console.log("[useEffect] Processing doctorId:", doctorId);
      fetchDoctor();
    } else {
      console.log("[useEffect] No doctorId, redirecting to patient-dashboard");
      setError("No doctor selected. Please select a doctor.");
      setTimeout(() => navigate("/patient-dashboard"), 2000);
    }
  }, [doctorId, navigate]);

  useEffect(() => {
    if (appointmentData.date) {
      fetchAvailableSlots(appointmentData.date);
    } else {
      setAvailableSlots([]);
      setAppointmentData((prev) => ({ ...prev, time: "" }));
    }
  }, [appointmentData.date, doctorId]);

  // Refresh status every 10 seconds if pending
  useEffect(() => {
    let interval;
    if (requestId && requestStatus?.status === "pending") {
      interval = setInterval(() => {
        console.log("[useEffect] Polling status for requestId:", requestId);
        fetchRequestStatus(requestId);
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [requestId, requestStatus]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log("[handleInputChange] Input:", { name, value });
    setAppointmentData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle time slot selection
  const handleSlotSelect = (slotStart) => {
    console.log("[handleSlotSelect] Selected slot:", slotStart);
    setAppointmentData((prev) => ({ ...prev, time: slotStart }));
  };

  // Handle appointment request submission
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    setRequestStatus(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[handleBookAppointment] No token found, redirecting to signin");
        setError("Please sign in to book an appointment.");
        setTimeout(() => navigate("/auth/signin"), 2000);
        return;
      }

      const { doctorId, date, time, reason } = appointmentData;
      console.log("[handleBookAppointment] Submitting:", { doctorId, date, time, reason });
      if (!doctorId || !date || !time || !reason) {
        console.error("[handleBookAppointment] Validation failed: All fields required");
        setError("Please fill in all fields.");
        setIsLoading(false);
        return;
      }

      if (!isValidDoctorId(doctorId)) {
        console.error("[handleBookAppointment] Invalid doctorId format:", doctorId);
        setError("Invalid doctor ID. Please select a valid doctor.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("http://localhost:5000/api/patient/appointment/request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doctorId, date, time, reason }),
      });

      const data = await response.json();
      console.log("[handleBookAppointment] Response:", JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error("[handleBookAppointment] Failed:", data.message);
        setError(data.message || "Failed to send appointment request");
        setIsLoading(false);
        if (response.status === 401) {
          console.log("[handleBookAppointment] Unauthorized, clearing token");
          localStorage.removeItem("token");
          setTimeout(() => navigate("/auth/signin"), 2000);
        }
        if (data.message === "This time slot is already booked") {
          fetchAvailableSlots(appointmentData.date);
        }
        return;
      }

      setSuccess("Appointment request sent successfully!");
      setRequestId(data.requestId);
      setAppointmentData({ doctorId: doctorId, date: "", time: "", reason: "" });
      setAvailableSlots([]);
      setIsLoading(false);
      if (data.requestId) {
        fetchRequestStatus(data.requestId);
      }
    } catch (err) {
      console.error("[handleBookAppointment] Error:", err);
      setError("Failed to connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Book an Appointment</h2>
        {success && (
          <p className="text-green-700 bg-green-50 border border-green-200 rounded-lg p-4 mb-6 animate-slide-in">
            {success}
          </p>
        )}
        {error && (
          <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4 mb-6 animate-slide-in">
            {error}
          </p>
        )}
        {doctor && (
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900">{doctor.name}</h3>
            <p className="text-gray-600">
              Specialization: {doctor.specialization || "Not specified"}
            </p>
            {doctor.availability && doctor.availability.days?.length > 0 && (
              <p className="text-gray-600">
                Availability: {doctor.availability.days.join(", ")},{" "}
                {doctor.availability.startTime} - {doctor.availability.endTime}
              </p>
            )}
          </div>
        )}
        <form onSubmit={handleBookAppointment}>
          <div className="mb-6">
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Date *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={appointmentData.date}
              onChange={handleInputChange}
              min={new Date().toISOString().split("T")[0]}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
              required
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Time *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {availableSlots.map((slot, index) => (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  aria-label={`Time slot ${slot.start} to ${slot.end}`}
                  aria-selected={appointmentData.time === slot.start}
                  onClick={() => handleSlotSelect(slot.start)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleSlotSelect(slot.start);
                    }
                  }}
                  className={`flex items-center justify-center w-32 h-12 rounded-full text-sm font-medium transition duration-200 transform ${
                    appointmentData.time === slot.start
                      ? "bg-indigo-600 text-white animate-pulse shadow-lg"
                      : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 hover:from-indigo-100 hover:to-indigo-200 hover:scale-105"
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                >
                  {slot.start} - {slot.end}
                </div>
              ))}
            </div>
            {isSlotsLoading && <p className="text-gray-600 mt-4">Loading available slots...</p>}
            {!isSlotsLoading && appointmentData.date && availableSlots.length === 0 && (
              <p className="text-red-600 mt-4">No slots available for this date.</p>
            )}
          </div>
          <div className="mb-6">
            <label
              htmlFor="reason"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Reason for Appointment *
            </label>
            <textarea
              id="reason"
              name="reason"
              value={appointmentData.reason}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
              rows="4"
              required
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              disabled={isLoading || !appointmentData.time || !appointmentData.reason}
              className={`flex-1 p-3 rounded-lg font-semibold transition duration-200 ${
                isLoading || !appointmentData.time || !appointmentData.reason
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-lg"
              }`}
            >
              {isLoading ? "Sending..." : "Send Appointment Request"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/patient-dashboard")}
              className="flex-1 p-3 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 hover:scale-105 font-semibold transition duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
        {requestStatus && (
          <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Appointment Request Status
            </h3>
            <p className="text-gray-600">
              <span className="font-medium">Status:</span>{" "}
              <span
                className={`capitalize ${
                  requestStatus.status === "accepted"
                    ? "text-green-600"
                    : requestStatus.status === "rejected"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              >
                {requestStatus.status}
              </span>
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Doctor:</span> {requestStatus.doctorName}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Date:</span>{" "}
              {new Date(requestStatus.date).toISOString().split("T")[0]}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Time:</span> {requestStatus.time}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}