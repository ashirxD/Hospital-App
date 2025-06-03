import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import io from "socket.io-client";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function ResponseDetails() {
  const { id } = useParams(); // AppointmentRequest ID
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reviewData, setReviewData] = useState({ rating: 0, comment: "" });
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // API client for reusable fetch logic
  const apiClient = {
    async get(url) {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/auth/signin");
        throw new Error("Unauthorized: Please sign in again");
      }
      const response = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/auth/signin");
          throw new Error("Unauthorized: Please sign in again");
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to fetch appointment (Status: ${response.status})`);
      }
      return response.json();
    },
    async post(url, body) {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/auth/signin");
        throw new Error("Unauthorized: Please sign in again");
      }
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/auth/signin");
          throw new Error("Unauthorized: Please sign in again");
        }
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to submit review (Status: ${response.status})`);
      }
      return response.json();
    },
  };

  // Fetch appointment details
  const fetchAppointmentDetails = async () => {
    setError("");
    setIsLoading(true);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/patient/appointments/${id}`;
      console.log("[ResponseDetails] Fetching:", apiUrl);
      const data = await apiClient.get(apiUrl);
      console.log("[ResponseDetails] Data:", {
        appointmentId: data._id,
        status: data.status,
        prescriptions: data.prescriptions?.length || 0,
        hasReview: !!data.review,
        timestamp: new Date().toISOString(),
      });
      setAppointment(data);
    } catch (err) {
      console.error("[ResponseDetails] Fetch error:", err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit review
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError("");
    setReviewSuccess("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/appointments/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(reviewData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit review");
      }

      // Update the appointment state with the new review
      setAppointment(prev => ({
        ...prev,
        review: {
          rating: reviewData.rating,
          comment: reviewData.comment.trim(),
          createdAt: new Date().toISOString()
        }
      }));

      setReviewSuccess("Review submitted successfully");
      setReviewData({ rating: 0, comment: "" });
    } catch (error) {
      console.error("Error submitting review:", error);
      setReviewError(error.message || "Failed to submit review");
    }
  };

  // Handle review input changes
  const handleReviewChange = (e) => {
    const { name, value } = e.target;
    setReviewData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle rating selection
  const handleRatingChange = (rating) => {
    setReviewData((prev) => ({ ...prev, rating }));
  };

  // Initialize Socket.IO and fetch data
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/auth/signin");
      return;
    }

    const socket = io(import.meta.env.VITE_API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected");
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO] Connection error:", err.message);
      if (err.message === "Authentication failed") {
        // Token might be invalid or expired
        localStorage.removeItem("token");
        navigate("/auth/signin");
      }
    });

    socket.on("appointmentUpdate", (data) => {
      console.log("[Socket.IO] Appointment update:", data);
      if (data.appointmentId === id) {
        setAppointment((prev) => ({
          ...prev,
          status: data.status || prev.status,
        }));
      }
    });

    socket.on("appointmentStatusUpdated", (data) => {
      console.log("[Socket.IO] Status updated:", data);
      if (data.appointmentId === appointment?.appointmentId) {
        setAppointment((prev) => ({
          ...prev,
          status: data.status || prev.status,
        }));
      }
    });

    socket.on("prescriptionAdded", (data) => {
      console.log("[Socket.IO] Prescription added:", data);
      if (data.appointmentId === appointment?.appointmentId) {
        fetchAppointmentDetails();
      }
    });

    socket.on("reviewAdded", (data) => {
      console.log("[Socket.IO] Review added:", data);
      if (data.appointmentId === appointment?.appointmentId) {
        fetchAppointmentDetails();
      }
    });

    fetchAppointmentDetails();

    return () => {
      socket.disconnect();
      console.log("[Socket.IO] Disconnected");
    };
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-md">
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4">
          {error || "Appointment not found"}
        </p>
        <button
          onClick={() => navigate("/patient-dashboard")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div 
        className="w-1/5 shadow-[inset_-10px_0_10px_-10px_rgba(0,0,0,0.2)]" 
        onClick={() => navigate("/patient-dashboard")}
      ></div>
      <div className="w-4/5 h-full bg-white overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm">
          <h2 className="text-2xl font-semibold text-gray-800">Appointment Details</h2>
          <button
            onClick={() => navigate("/patient-dashboard")}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Debugging Info */}
          <div className="mb-6 text-sm text-gray-600">
            <p><strong>Appointment Request ID:</strong> {appointment._id}</p>
            <p><strong>Appointment ID:</strong> {appointment.appointmentId || "Not assigned"}</p>
          </div>

        {/* Appointment Details */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Appointment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Doctor</p>
              <p className="text-gray-800">{appointment.doctor?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Specialization</p>
              <p className="text-gray-800">{appointment.doctor?.specialization || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Date</p>
              <p className="text-gray-800">
                {appointment.date ? format(new Date(appointment.date), "MMM dd, yyyy") : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Time</p>
              <p className="text-gray-800">{appointment.time || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  appointment.status === "Attended"
                    ? "bg-green-100 text-green-800"
                    : appointment.status === "Cancelled"
                    ? "bg-red-100 text-red-800"
                    : appointment.status === "Absent"
                    ? "bg-gray-100 text-gray-800"
                    : appointment.status === "Pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : appointment.status === "accepted"
                    ? "bg-blue-100 text-blue-800"
                    : appointment.status === "rejected"
                    ? "bg-red-200 text-red-900"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {appointment.status || "Unknown"}
              </span>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-gray-600">Reason</p>
              <p className="text-gray-800">{appointment.reason || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Prescriptions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Prescriptions</h3>
          {appointment.prescriptions?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medicine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dosage Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration (days)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prescribed At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointment.prescriptions.map((prescription, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {prescription.medicineName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <ul className="list-disc list-inside space-y-1">
                          {prescription.frequency.morning > 0 && (
                            <li>Morning: {prescription.frequency.morning} dose{prescription.frequency.morning > 1 ? 's' : ''}</li>
                          )}
                          {prescription.frequency.afternoon > 0 && (
                            <li>Afternoon: {prescription.frequency.afternoon} dose{prescription.frequency.afternoon > 1 ? 's' : ''}</li>
                          )}
                          {prescription.frequency.evening > 0 && (
                            <li>Evening: {prescription.frequency.evening} dose{prescription.frequency.evening > 1 ? 's' : ''}</li>
                          )}
                          {prescription.frequency.night > 0 && (
                            <li>Night: {prescription.frequency.night} dose{prescription.frequency.night > 1 ? 's' : ''}</li>
                          )}
                        </ul>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {prescription.durationDays}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(prescription.prescribedAt), "MMM dd, yyyy HH:mm")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">No prescriptions available.</p>
          )}
        </div>

        {/* Review Section */}
        {appointment.status === "attended" || appointment.status === "completed" ? (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Review</h3>
            {appointment.review ? (
              <div className="bg-white rounded-lg p-4 shadow">
                <div className="flex items-center mb-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${
                          i < appointment.review.rating
                            ? "text-yellow-400"
                            : "text-gray-300"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-gray-600">
                    {format(new Date(appointment.review.createdAt), "MMM dd, yyyy")}
                  </span>
                </div>
                <p className="text-gray-700">{appointment.review.comment}</p>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="bg-white rounded-lg p-4 shadow">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating
                  </label>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewData(prev => ({ ...prev, rating: star }))}
                        className="focus:outline-none"
                      >
                        <svg
                          className={`w-8 h-8 ${
                            star <= reviewData.rating
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comment
                  </label>
                  <textarea
                    value={reviewData.comment}
                    onChange={(e) =>
                      setReviewData(prev => ({ ...prev, comment: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="4"
                    required
                  />
                </div>
                {reviewError && (
                  <div className="mb-4 text-red-600 text-sm">{reviewError}</div>
                )}
                {reviewSuccess && (
                  <div className="mb-4 text-green-600 text-sm">{reviewSuccess}</div>
                )}
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Submit Review
                </button>
              </form>
            )}
          </div>
        ) : null}

          {/* Mobile-friendly table styles */}
          <style jsx>{`
            @media (max-width: 640px) {
              table {
                display: block;
                overflow-x: auto;
              }
              thead {
                display: none;
              }
              tr {
                display: block;
                margin-bottom: 1rem;
                border-bottom: 1px solid #e5e7eb;
              }
              td {
                display: flex;
                justify-content: space-between;
                padding: 0.5rem 1rem;
                text-align: right;
              }
              td:before {
                content: attr(data-label);
                font-weight: 600;
                color: #4b5563;
                text-align: left;
                flex: 1;
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}