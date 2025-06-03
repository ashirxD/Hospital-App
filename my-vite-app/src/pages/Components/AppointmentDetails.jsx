import React, { useState, useEffect } from "react";
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";

export default function AppointmentDetails({ appointmentId, onClose }) {
  const [appointment, setAppointment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [prescription, setPrescription] = useState({
    medicineName: "",
    frequency: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    durationDays: "",
  });

  // Fetch appointment details
  const fetchAppointment = async () => {
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please sign in to view appointment details");
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointment/${appointmentId}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        setError(`Failed to fetch appointment details: ${text}`);
        return;
      }
      const data = await response.json();
      setAppointment(data);
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentId) {
      fetchAppointment();
    }
  }, [appointmentId]);

  // Handle prescription input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("frequency.")) {
      const timeOfDay = name.split(".")[1];
      setPrescription((prev) => ({
        ...prev,
        frequency: {
          ...prev.frequency,
          [timeOfDay]: value === "" ? "" : Math.max(0, Math.min(10, parseInt(value) || 0)),
        },
      }));
    } else {
      setPrescription((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Reset prescription form
  const resetForm = () => {
    setPrescription({
      medicineName: "",
      frequency: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      durationDays: "",
    });
    setError("");
    setSuccess("");
  };

  // Handle prescription submission
  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    const totalDoses = Object.values(prescription.frequency).reduce(
      (sum, dose) => sum + (parseInt(dose) || 0),
      0
    );
    if (totalDoses === 0) {
      setError("Please specify at least one dose for any time of day");
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please sign in to add prescription");
        setIsLoading(false);
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointment/${appointmentId}/prescription`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prescription),
      });

      if (!response.ok && response.status !== 201) {
        const text = await response.text();
        setError(`Failed to add prescription: ${text}`);
        await fetchAppointment();
        setIsLoading(false);
        return;
      }

      setSuccess("Prescription added successfully");
      resetForm();
      await fetchAppointment();
    } catch (err) {
      setError("Failed to connect to server");
      await fetchAppointment();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (status) => {
    if (appointment?.status && ["attended", "cancelled", "absent"].includes(appointment.status)) {
      return;
    }

    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please sign in to update status");
        setIsLoading(false);
        return;
      }
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/doctor/appointments/${appointmentId}/status`;
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const text = await response.text();
        setError(`Failed to update status: ${text}`);
        setIsLoading(false);
        return;
      }

      setSuccess(`Appointment marked as ${status}`);
      await fetchAppointment();
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  if (!appointmentId) {
    return null; // Don't render if no appointmentId
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!appointment || error) {
    return (
      <div className="fixed inset-y-0 right-0 w-[80vw] bg-white rounded-l-lg shadow-2xl p-6 transform transition-transform duration-300 ease-in-out translate-x-0 z-50 overflow-y-auto"
        style={{ width: '80vw', right: 0 }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
          aria-label="Close"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        <div className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4">
          {error || "Appointment not found"}
        </div>
        <button
          onClick={onClose}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isStatusFinal = appointment.status && ["attended", "cancelled", "absent"].includes(appointment.status);

  return (
    <div
      className="fixed inset-y-0 right-0 bg-white rounded-l-lg shadow-2xl p-6 z-50 overflow-y-auto appointment-details-drawer"
      style={{ width: '80vw', right: 0 }}
    >
      <style>{`
        .appointment-details-drawer {
          transition: transform 0.85s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateX(0);
          opacity: 1;
        }
        .appointment-details-drawer.closing {
          transform: translateX(100vw);
          opacity: 0;
        }
      `}</style>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
        aria-label="Close"
      >
        <XMarkIcon className="w-6 h-6" />
      </button>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Appointment Details</h2>
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-600 bg-green-100 border border-green-400 rounded p-3 mb-4">
          {success}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Patient Information</h3>
          <p><strong>Name:</strong> {appointment.patient?.name || "N/A"}</p>
          <p><strong>Email:</strong> {appointment.patient?.email || "N/A"}</p>
          <p><strong>Phone:</strong> {appointment.patient?.phoneNumber || "N/A"}</p>
          <p><strong>Medical Description:</strong> {appointment.patient?.medicalDescription || "No medical history provided"}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Appointment Information</h3>
          <p><strong>Date:</strong> {appointment.date ? new Date(appointment.date).toISOString().split("T")[0] : "N/A"}</p>
          <p><strong>Time:</strong> {appointment.time || "N/A"}</p>
          <p><strong>Reason:</strong> {appointment.reason || "N/A"}</p>
          <p><strong>Status:</strong> {appointment.status || "Pending"}</p>
        </div>
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Update Appointment Status</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => handleStatusUpdate("attended")}
            disabled={isLoading || isStatusFinal}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${
              isLoading || isStatusFinal
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            Mark as Attended
          </button>
          <button
            onClick={() => handleStatusUpdate("cancelled")}
            disabled={isLoading || isStatusFinal}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${
              isLoading || isStatusFinal
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            Cancel Appointment
          </button>
          <button
            onClick={() => handleStatusUpdate("absent")}
            disabled={isLoading || isStatusFinal}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${
              isLoading || isStatusFinal
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            Mark as Absent
          </button>
        </div>
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Prescriptions</h3>
        {appointment.prescriptions && appointment.prescriptions.length > 0 ? (
          <ul className="space-y-2">
            {appointment.prescriptions.map((pres, index) => (
              <li key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p><strong className="text-gray-600">Medicine:</strong> {pres.medicineName}</p>
                <p><strong className="text-gray-600">Dosage Schedule:</strong></p>
                <ul className="ml-4 list-disc text-gray-600">
                  {pres.frequency.morning > 0 && <li>Morning: {pres.frequency.morning} dose(s)</li>}
                  {pres.frequency.afternoon > 0 && <li>Afternoon: {pres.frequency.afternoon} dose(s)</li>}
                  {pres.frequency.evening > 0 && <li>Evening: {pres.frequency.evening} dose(s)</li>}
                  {pres.frequency.night > 0 && <li>Night: {pres.frequency.night} dose(s)</li>}
                </ul>
                <p><strong className="text-gray-600">Duration:</strong> {pres.durationDays} days</p>
                <p><strong className="text-gray-600">Prescribed At:</strong> {new Date(pres.prescribedAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 italic">No prescriptions added.</p>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Add Prescription</h3>
        <form onSubmit={handleSubmitPrescription} className="space-y-4">
          <div>
            <label htmlFor="medicineName" className="block text-sm font-medium text-gray-700 mb-1">
              Medicine Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="medicineName"
              name="medicineName"
              value={prescription.medicineName}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              required
              placeholder="Enter medicine name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage Schedule <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["morning", "afternoon", "evening", "night"].map((time) => (
                <div key={time}>
                  <label
                    htmlFor={`frequency.${time}`}
                    className="block text-xs font-medium text-gray-600 capitalize mb-1"
                  >
                    {time}
                  </label>
                  <input
                    type="number"
                    id={`frequency.${time}`}
                    name={`frequency.${time}`}
                    value={prescription.frequency[time]}
                    onChange={handleInputChange}
                    min="0"
                    max="10"
                    className="w-full p-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 rounded-full text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 hover:shadow-sm transition-all duration-200"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="durationDays"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Duration (days) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="durationDays"
              name="durationDays"
              value={prescription.durationDays}
              onChange={handleInputChange}
              min="1"
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              required
              placeholder="Enter number of days"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-semibold transition-colors ${
                isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLoading ? "Adding..." : "Add Prescription"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                isLoading ? "bg-gray-300 cursor-not-allowed text-gray-500" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Review</h3>
        {appointment.reviews && appointment.reviews.length > 0 ? (
          <div className="space-y-4">
            {appointment.reviews.map((review, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {review.reviewer?.profilePicture ? (
                      <img
                        src={review.reviewer.profilePicture}
                        alt={review.reviewer.name}
                        className="w-8 h-8 rounded-full mr-2"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 mr-2 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">
                          {review.reviewer?.name?.charAt(0) || "?"}
                        </span>
                      </div>
                    )}
                    <span className="font-medium text-gray-700">{review.reviewer?.name || "Anonymous"}</span>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-xl ${star <= review.rating ? "text-yellow-400" : "text-gray-300"}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-gray-800">{review.comment}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Reviewed on {format(new Date(review.createdAt), "MMM dd, yyyy")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">
            {appointment.status === "attended" || appointment.status === "completed"
              ? "No review submitted yet."
              : "Reviews will appear here after the appointment is attended."}
          </p>
        )}
      </div>
    </div>
  );
}