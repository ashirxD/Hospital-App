import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import moment from "moment";
import { useDispatch } from "react-redux";
import { logout } from "../../redux/slices/authSlice";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { FaExclamationCircle, FaCheckCircle } from "react-icons/fa";

import React from 'react';
import {
  CalendarIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  XMarkIcon,
  UserGroupIcon,
  BellIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

// Sidebar Component
// import { CalendarIcon, DocumentTextIcon, UserGroupIcon, PencilIcon, ArrowRightOnRectangleIcon, ChatBubbleLeftRightIcon,BellIcon } from "@heroicons/react/24/outline";

export function PatientSidebar({ activeSection, setActiveSection, handleLogout }) {
  console.log("[PatientSidebar] Rendering, activeSection:", activeSection);
  return (
    <div className="w-64 bg-white shadow p-6 flex flex-col justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-8">
          Patient Dashboard
        </h2>
        <nav className="space-y-2">
          <button
            onClick={() => setActiveSection("appointments")}
            className={`w-full flex items-center p-3 rounded text-gray-700 hover:bg-blue-100 ${
              activeSection === "appointments" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <CalendarIcon className="w-6 h-6 mr-3" />
            Appointments
          </button>
          <button
            onClick={() => setActiveSection("medicalRecords")}
            className={`w-full flex items-center p-3 rounded text-gray-700 hover:bg-blue-100 ${
              activeSection === "medicalRecords" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <DocumentTextIcon className="w-6 h-6 mr-3" />
            Medical Records
          </button>
          <button
            onClick={() => setActiveSection("doctors")}
            className={`w-full flex items-center p-3 rounded text-gray-700 hover:bg-blue-100 ${
              activeSection === "doctors" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <UserGroupIcon className="w-6 h-6 mr-3" />
            Doctors
          </button>
          <button
            onClick={() => setActiveSection("edit-profile")}
            className={`w-full flex items-center p-3 rounded text-gray-700 hover:bg-blue-100 ${
              activeSection === "edit-profile" ? "bg-blue-100 text-blue-600" : ""
            }`}
          >
            <PencilIcon className="w-6 h-6 mr-3" />
            Edit Profile
          </button>
          <button
            onClick={() => setActiveSection("chat")}
            className={`w-full flex items-center p-3 rounded text-gray-700 hover:bg-blue-100 ${
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
        className="flex items-center p-3 text-white bg-red-600 rounded hover:bg-red-700 transition"
      >
        <ArrowRightOnRectangleIcon className="w-6 h-6 mr-3" />
        Logout
      </button>
    </div>
  );
}

// Header Component
export function PatientHeader({
  userData = {},
  notifications = [],
  unreadCount = 0,
  toggleNotifications,
  showNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  socketStatus,
}) {
  console.log("[PatientHeader] Rendering, props:", {
    userData: userData.name,
    unreadCount,
    notificationsLength: notifications.length,
    notificationIds: notifications.map(n => n._id),
    showNotifications,
    socketStatus,
  });
  console.log("[PatientHeader] showNotifications state:", showNotifications);

  return (
    <div key={`header-${unreadCount}`} className="mb-8 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {userData.profilePicture && userData.profilePicture !== "" && (
          <img
            src={`${import.meta.env.VITE_API_URL}${userData.profilePicture}?t=${Date.now()}`}
            alt="Profile"
            className="w-12 h-12 rounded-full object-cover"
            onError={(e) => {
              e.target.src = "/fallback-profile.png";
              console.error("[PatientHeader] Image error:", userData.profilePicture, e);
            }}
          />
        )}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome, {userData.name || "Loading..."}!
          </h1>
          <p className="text-gray-600">
            Manage your health and appointments from your dashboard.
          </p>
        </div>
      </div>
      <div className="relative">
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
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto animate-fade-in">
            <div className="p-4">
              <NotificationsList
                notifications={notifications}
                markNotificationAsRead={markNotificationAsRead}
                markAllNotificationsAsRead={markAllNotificationsAsRead}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsList({
  notifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
}) {
  return (
    <div>
      <button
        onClick={markAllNotificationsAsRead}
        className="w-full text-sm text-blue-600 hover:text-blue-800 p-2 text-center border-b border-gray-200"
      >
        Mark All as Read
      </button>
      {notifications.length === 0 ? (
        <p className="text-gray-600 p-2 text-center">No notifications</p>
      ) : (
        notifications.map((notification) => (
          <div
            key={notification._id}
            className={`p-3 border-b border-gray-200 hover:bg-gray-50 flex justify-between items-center ${
              notification.read ? "opacity-50" : ""
            }`}
          >
            <div>
              <p className="text-sm text-gray-800">{notification.message}</p>
              <p className="text-xs text-gray-500">
                {new Date(notification.createdAt).toLocaleString()}
              </p>
            </div>
            {!notification.read && (
              <button
                onClick={() => markNotificationAsRead(notification._id)}
                className="text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Mark as Read
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// Appointments Section
export function AppointmentsSection({
  error,
  appointmentsTable,
  setActiveSection,
  timeFilter,
  statusFilter,
  doctorFilter,
  handleFilterChange,
  clearFilters,
  doctors,
  navigate, // Add navigate prop
}) {
  console.log("[AppointmentsSection] Rendering, filters:", { timeFilter, statusFilter, doctorFilter });
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-800">
          Appointment Requests
        </h3>
        <button
          onClick={() => setActiveSection("doctors")}
          className="p-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Book Appointment
        </button>
      </div>
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4 animate-fade-in">
          {error}
        </p>
      )}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-gray-800">Filter Appointments</h4>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-blue-600 text-sm font-medium rounded-md hover:bg-blue-50 transition"
            >
              Clear Filters
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="timeFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Time Period
              </label>
              <select
                id="timeFilter"
                value={timeFilter}
                onChange={(e) =>
                  handleFilterChange({
                    timeFilter: e.target.value,
                    statusFilter,
                    doctorFilter,
                  })
                }
                className="w-full p-2.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition"
              >
                <option value="">All Time</option>
                <option value="3days">Last 3 Days</option>
                <option value="week">Last Week</option>
                <option value="15days">Last 15 Days</option>
                <option value="month">Last Month</option>
              </select>
            </div>
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) =>
                  handleFilterChange({
                    timeFilter,
                    statusFilter: e.target.value,
                    doctorFilter,
                  })
                }
                className="w-full p-2.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition"
              >
                <option value="">All Statuses</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
                <option value="attended">Completed</option>
                {/* <option value="completed">Completed</option> */}
                <option value="cancelled">Cancelled</option>
                <option value="absent">Absent</option>
              </select>
            </div>
            <div>
              <label htmlFor="doctorFilter" className="block text-sm font-medium text-gray-700 mb-1">
                Doctor
              </label>
              <select
                id="doctorFilter"
                value={doctorFilter}
                onChange={(e) =>
                  handleFilterChange({
                    timeFilter,
                    statusFilter,
                    doctorFilter: e.target.value,
                  })
                }
                className="w-full p-2.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-blue-400 transition"
              >
                <option value="">All Doctors</option>
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      {appointmentsTable}
    </div>
  );
}

// Medical Records Section
export function MedicalRecordsSection({ medicalRecords }) {
  console.log("[MedicalRecordsSection] Rendering, records:", medicalRecords.length);
  return (
    <div>
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">
        Medical Records
      </h3>
      <div className="space-y-6">
        {medicalRecords.map((record) => (
          <div
            key={record.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
          >
            <h4 className="text-lg font-semibold text-gray-800">
              {record.diagnosis}
            </h4>
            <p className="text-gray-600">Date: {record.date}</p>
            <p className="text-gray-600">Doctor: {record.doctor}</p>
            <p className="text-gray-600">Notes: {record.notes}</p>
            <button className="mt-4 text-blue-600 hover:text-blue-800">
              View Full Record
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Edit Profile Section
export function EditProfileSection({
  success,
  error,
  editData,
  handleInputChange,
  handleFileChange,
  handleRemovePicture,
  handleProfileUpdate,
  isLoading,
  hasProfilePicture,
  previewUrl,
  userData,
}) {
  console.log("[EditProfileSection] Rendering, editData:", editData);
  return (
    <div>
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">
        Edit Profile
      </h3>
      <div className="bg-white rounded-lg shadow p-6 max-w-md">
        {success && (
          <p className="text-green-600 bg-green-100 border border-green-400 rounded p-3 mb-4">
            {success}
          </p>
        )}
        {error && (
          <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4">
            {error}
          </p>
        )}
        <form onSubmit={handleProfileUpdate}>
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-gray-700 font-medium mb-2"
            >
              Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={editData.name || ""}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="phoneNumber"
              className="block text-gray-700 font-medium mb-2"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={editData.phoneNumber || ""}
              onChange={handleInputChange}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., +1234567890 or 123-456-7890"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="profilePicture"
              className="block text-gray-700 font-medium mb-2"
            >
              Profile Picture
            </label>
            {hasProfilePicture && (previewUrl || userData.profilePicture) && (
              <div className="relative mb-2 w-24 h-24">
                <img
                  src={
                    previewUrl ||
                    `${import.meta.env.VITE_API_URL}${userData.profilePicture}?t=${Date.now()}`
                  }
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-full object-cover"
                  onError={(e) => {
                    e.target.src = "/fallback-profile.png";
                    console.error("[EditProfileSection] Image error:", userData.profilePicture, e);
                  }}
                />
                <button
                  type="button"
                  onClick={handleRemovePicture}
                  className="absolute top-[-8px] right-[-8px] bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"
                  title="Remove Picture"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            {!hasProfilePicture && (
              <input
                type="file"
                id="profilePicture"
                name="profilePicture"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full p-2 border rounded"
              />
            )}
          </div>
          <div className="mb-4 flex items-center space-x-4">
            <label
              htmlFor="twoFAEnabled"
              className="text-gray-700 font-medium"
            >
              Two-Factor Authentication
            </label>
            <div className="relative inline-block w-12 h-6">
              <input
                type="checkbox"
                id="twoFAEnabled"
                name="twoFAEnabled"
                checked={editData.twoFAEnabled || false}
                onChange={handleInputChange}
                className="absolute opacity-0 w-full h-full cursor-pointer"
              />
              <div
                className={`w-full h-full rounded-full transition-colors duration-200 ${
                  editData.twoFAEnabled ? "bg-blue-500" : "bg-gray-300"
                }`}
              ></div>
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  editData.twoFAEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              ></div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full p-2 rounded text-white ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isLoading ? "Updating..." : "Update Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Doctors Section
// In PatientComponents.jsx
export function DoctorsSection({ doctors, error, navigate }) {
  console.log("[DoctorsSection] Rendering, doctors:", doctors.map(d => ({ id: d._id, name: d.name })));
  return (
    <div>
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">
        Available Doctors
      </h3>
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-400 rounded p-3 mb-4 animate-fade-in">
          {error}
        </p>
      )}
      {doctors.length === 0 ? (
        <p className="text-gray-600">No doctors available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <div
              key={doctor._id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => {
                if (doctor._id && typeof doctor._id === "string" && /^[0-9a-fA-F]{24}$/.test(doctor._id)) {
                  navigate(`/doctor/${doctor._id}`);
                } else {
                  console.error("[DoctorsSection] Invalid doctor._id:", doctor._id);
                }
              }}
            >
              <div className="flex items-center space-x-4">
                {doctor.profilePicture && (
                  <img
                    src={`${import.meta.env.VITE_API_URL}${doctor.profilePicture}?t=${Date.now()}`}
                    alt={`${doctor.name}'s Profile`}
                    className="w-16 h-16 rounded-full object-cover"
                    onError={(e) => {
                      e.target.src = "/fallback-profile.png";
                      console.error("[DoctorsSection] Image error:", doctor.profilePicture, e);
                    }}
                  />
                )}
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    {doctor.name}
                  </h4>
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
              </div>
              <button
                className="mt-4 text-blue-600 hover:text-blue-800"
                onClick={(e) => {
                  e.stopPropagation();
                  if (doctor._id && typeof doctor._id === "string" && /^[0-9a-fA-F]{24}$/.test(doctor._id)) {
                    navigate(`/doctor/${doctor._id}/slots`);
                  } else {
                    console.error("[DoctorsSection] Invalid doctor._id for booking:", doctor._id);
                  }
                }}
              >
                Book Appointment
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// SlotCard Component
function SlotCard({ date, slot, doctorId, navigate }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center justify-between h-48 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-gray-100">
      <div className="text-center">
        <h4 className="text-lg font-semibold text-gray-800">
          {slot.start} - {slot.end}
        </h4>
        <p className="text-sm text-gray-500 mt-1">
          {moment(date).format("MMM Do, YYYY")}
        </p>
      </div>
      <button
        onClick={() => navigate(`/book-appointment/${doctorId}?date=${date}&time=${slot.start}`)}
        className="mt-4 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md"
      >
        Book Now
      </button>
    </div>
  );
}

// Doctor Slots Page
export function DoctorSlotsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [slots, setSlots] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [sliderDates, setSliderDates] = useState([]);
  const dispatch = useDispatch();
  const sliderRef = useRef(null);

  // Add handleLogout function
  const handleLogout = () => {
    dispatch(logout());
    navigate("/auth/signin", { replace: true });
  };

  // Add handleSectionChange function
  const handleSectionChange = (section) => {
    switch (section) {
      case "appointments":
        navigate("/patient");
        break;
      case "medicalRecords":
        navigate("/patient/medical-records");
        break;
      case "doctors":
        navigate("/patient/doctors");
        break;
      case "edit-profile":
        navigate("/patient/edit-profile");
        break;
      case "chat":
        navigate("/patient/chat");
        break;
      default:
        navigate("/patient");
    }
  };

  // Extend sliderDates when user clicks forward and reaches the end
  const handleSliderChange = (oldIndex, newIndex) => {
    console.log("[DoctorSlotsPage] Slider change:", { oldIndex, newIndex, totalSlides: sliderDates.length });
    
    // If user is moving forward and newIndex is near the end, add more future dates
    if (newIndex > oldIndex && sliderDates.length - newIndex <= 3) {
      const lastDate = moment(sliderDates[sliderDates.length - 1].date, "YYYY-MM-DD");
      const newDates = [];
      for (let i = 1; i <= 7; i++) {
        const date = lastDate.clone().add(i, "days");
        newDates.push({
          date: date.format("YYYY-MM-DD"),
          display: date.format("ddd, MMM D"),
        });
      }
      console.log("[DoctorSlotsPage] Adding new dates:", newDates);
      setSliderDates(prev => [...prev, ...newDates]);
    }
  };

  // Custom arrow components
  const NextArrow = ({ onClick, currentSlide, slideCount }) => {
    const isAtEnd = currentSlide >= slideCount - 1;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[DoctorSlotsPage] Next arrow clicked:", { currentSlide, slideCount });
          if (!isAtEnd) {
            onClick();
          }
        }}
        className={`absolute right-[-40px] top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full p-2 shadow-md transition-all z-10 ${
          isAtEnd ? 'opacity-50 cursor-not-allowed' : 'hover:from-blue-600 hover:to-blue-700'
        }`}
        disabled={isAtEnd}
        aria-disabled={isAtEnd}
      >
        <ChevronRightIcon className="w-6 h-6" />
      </button>
    );
  };

  // PrevArrow: pass through all props to support react-slick navigation
  // PrevArrow: always visible, only pass onClick and type (react-slick expects type="button")
  const PrevArrow = ({ onClick, currentSlide }) => {
    const isAtStart = currentSlide === 0;
    return (
      <button
        type="button"
        onClick={isAtStart ? undefined : onClick}
        className={`absolute left-[-40px] top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full p-2 shadow-md transition-all z-10 ${isAtStart ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'hover:from-blue-600 hover:to-blue-700'}`}
        disabled={isAtStart}
        aria-disabled={isAtStart}
        tabIndex={isAtStart ? -1 : 0}
      >
        <ChevronLeftIcon className="w-6 h-6" />
      </button>
    );
  };

  // Slider settings
  const sliderSettings = {
    infinite: false,
    speed: 500,
    slidesToShow: 7,
    slidesToScroll: 1,
    centerMode: false,
    centerPadding: "0",
    arrows: true,
    initialSlide: 0,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    beforeChange: handleSliderChange,
    afterChange: (currentSlide) => {
      console.log("[DoctorSlotsPage] After change:", { currentSlide, totalSlides: sliderDates.length });
      // If we're near the end, add more dates
      if (sliderDates.length - currentSlide <= 3) {
        const lastDate = moment(sliderDates[sliderDates.length - 1].date, "YYYY-MM-DD");
        const newDates = [];
        for (let i = 1; i <= 7; i++) {
          const date = lastDate.clone().add(i, "days");
          newDates.push({
            date: date.format("YYYY-MM-DD"),
            display: date.format("ddd, MMM D"),
          });
        }
        console.log("[DoctorSlotsPage] Adding new dates after change:", newDates);
        setSliderDates(prev => [...prev, ...newDates]);
      }
    },
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 5, centerMode: false, initialSlide: 0 } },
      { breakpoint: 768, settings: { slidesToShow: 3, centerMode: false, initialSlide: 0 } },
      { breakpoint: 640, settings: { slidesToShow: 1, centerMode: false, initialSlide: 0 } },
    ],
    ref: sliderRef,
  };

  // Add effect to handle initial dates
  useEffect(() => {
    const initialDates = [];
    const today = moment();
    for (let i = 0; i < 14; i++) { // Start with 14 days instead of 7
      const date = today.clone().add(i, "days");
      initialDates.push({
        date: date.format("YYYY-MM-DD"),
        display: date.format("ddd, MMM D"),
      });
    }
    console.log("[DoctorSlotsPage] Setting initial dates:", initialDates);
    setSliderDates(initialDates);
    setSelectedDate(today.format("YYYY-MM-DD"));
  }, []);

  useEffect(() => {
    const fetchDoctorAndSlots = async () => {
      setIsLoading(true);
      setError("");
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.log("[DoctorSlotsPage] No token, redirecting to signin");
          dispatch(logout());
          navigate("/auth/signin", { replace: true });
          return;
        }

        // Validate doctorId
        if (!id || typeof id !== "string" || id.trim() === "" || !/^[0-9a-fA-F]{24}$/.test(id)) {
          console.error("[DoctorSlotsPage] Invalid doctorId:", id);
          setError("Invalid doctor ID");
          setIsLoading(false);
          return;
        }

        console.log("[DoctorSlotsPage] Fetching doctor:", { doctorId: id });
        const doctorResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/doctors/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!doctorResponse.ok) {
          const text = await doctorResponse.text();
          console.error("[DoctorSlotsPage] Failed to fetch doctor:", text);
          setError("Failed to fetch doctor details");
          setIsLoading(false);
          return;
        }
        const doctorData = await doctorResponse.json();
        setDoctor(doctorData);

        const slotsData = {};
        const today = moment();
        for (let i = 0; i < 7; i++) {
          const date = today.clone().add(i, "days").format("YYYY-MM-DD");
          console.log("[DoctorSlotsPage] Fetching slots for:", { date, doctorId: id });
          const slotsResponse = await fetch(
            `${import.meta.env.VITE_API_URL}/api/patient/doctors/${id}/slots?date=${date}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (!slotsResponse.ok) {
            const text = await slotsResponse.text();
            console.error("[DoctorSlotsPage] Failed to fetch slots for", date, ":", text);
            slotsData[date] = [];
            continue;
          }
          const daySlots = await slotsResponse.json();
          console.log("[DoctorSlotsPage] Slots response for", date, ":", daySlots);
          slotsData[date] = Array.isArray(daySlots) ? daySlots : [];
        }
        setSlots(slotsData);
      } catch (err) {
        console.error("[DoctorSlotsPage] Error:", err);
        setError("Failed to connect to server");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDoctorAndSlots();
  }, [id, navigate, dispatch]);

  // Fetch slots for a specific date when selected
  const fetchSlotsForDate = async (date) => {
    if (slots[date]) return; // Skip if already fetched
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[DoctorSlotsPage] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }
      console.log("[DoctorSlotsPage] Fetching slots for:", { date, doctorId: id });
      const slotsResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/patient/doctors/${id}/slots?date=${date}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!slotsResponse.ok) {
        const text = await slotsResponse.text();
        console.error("[DoctorSlotsPage] Failed to fetch slots for", date, ":", text);
        setSlots((prev) => ({ ...prev, [date]: [] }));
        return;
      }
      const daySlots = await slotsResponse.json();
      console.log("[DoctorSlotsPage] Slots response for", date, ":", daySlots);
      setSlots((prev) => ({
        ...prev,
        [date]: Array.isArray(daySlots) ? daySlots : [],
      }));
    } catch (err) {
      console.error("[DoctorSlotsPage] Error fetching slots for", date, ":", err);
      setSlots((prev) => ({ ...prev, [date]: [] }));
    }
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    fetchSlotsForDate(date);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-100 border border-red-400 rounded-lg p-4 mb-6 animate-fade-in max-w-2xl mx-auto">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <PatientSidebar
        activeSection="doctors"
        setActiveSection={handleSectionChange}
        handleLogout={handleLogout}
      />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Current Date Top Right */}
          <div className="absolute right-6 top-6 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg shadow text-lg font-semibold">
            {moment(selectedDate).format("dddd, MMMM Do YYYY")}
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-6 text-center bg-gradient-to-r from-blue-500 to-purple-600 text-transparent bg-clip-text">
            Available Slots for Dr. {doctor?.name || "Loading..."}
          </h3>

          {/* Slider for today + next 6 days only */}
          <div className="mb-6 relative">
            <Slider ref={sliderRef} {...sliderSettings}>
              {sliderDates.map((item) => (
                <div key={item.date} className="px-2">
                  <button
                    onClick={() => handleDateSelect(item.date)}
                    className={`w-full p-2 rounded-lg text-center transition-all duration-200 ${
                      selectedDate === item.date
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {item.display}
                  </button>
                </div>
              ))}
            </Slider>
          </div>

          {/* Slots Display */}
          {Object.keys(slots).length === 0 || Object.values(slots).every((slotsForDate) => slotsForDate.length === 0) ? (
            <p className="text-gray-600 text-center text-lg">No available slots for the next 7 days.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(slots)
                .filter(([date, slotsForDate]) => {
                  return (
                    Array.isArray(slotsForDate) &&
                    slotsForDate.length > 0 &&
                    selectedDate === date
                  );
                })
                .map(([date, slotsForDate]) => {
                  if (!moment(date, "YYYY-MM-DD", true).isValid()) {
                    console.warn("[DoctorSlotsPage] Invalid date key:", date);
                    return null;
                  }
                  return (
                    <div key={date} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <h4 className="text-xl font-semibold text-gray-800 mb-4">
                        {moment(date).format("dddd, MMMM Do YYYY")}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {slotsForDate.map((slot, index) => (
                          <SlotCard
                            key={`${date}-${slot.start}-${index}`}
                            date={date}
                            slot={slot}
                            doctorId={id}
                            navigate={navigate}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Book Appointment Page
// In PatientComponents.jsx

// In PatientComponents.jsx

// In PatientComponents.jsx
;

console.log("[BookAppointmentPage] react-icons imported:", { FaCheckCircle, FaExclamationCircle });

export function BookAppointmentPage() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const date = queryParams.get("date");
  const time = queryParams.get("time");
  const [reason, setReason] = useState("");
  const [doctor, setDoctor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("[BookAppointmentPage] URL params:", { doctorId, location: location.pathname, query: location.search });
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

        if (!doctorId || typeof doctorId !== "string" || doctorId.trim() === "" || !/^[0-9a-fA-F]{24}$/.test(doctorId)) {
          console.error("[BookAppointmentPage] Invalid doctorId:", doctorId);
          setError("Invalid doctor ID. Redirecting to dashboard...");
          setTimeout(() => navigate("/patient"), 2000);
          setIsLoading(false);
          return;
        }

        console.log("[BookAppointmentPage] Fetching doctor:", { doctorId });
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/doctors/${doctorId}`, {
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
  }, [doctorId, navigate, dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("[BookAppointmentPage] No token, redirecting to signin");
        dispatch(logout());
        navigate("/auth/signin", { replace: true });
        return;
      }

      if (!doctorId || !/^[0-9a-fA-F]{24}$/.test(doctorId)) {
        console.error("[BookAppointmentPage] Invalid doctorId on submit:", doctorId);
        setError("Invalid doctor ID");
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patient/appointment/request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doctorId, date, time, reason }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[BookAppointmentPage] Failed to book appointment:", text);
        setError("Failed to book appointment: " + text);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log("[BookAppointmentPage] Appointment booked:", data);
      setSuccess("Appointment request sent successfully!");
      setReason("");
      setIsLoading(false);
    } catch (err) {
      console.error("[BookAppointmentPage] Error:", err);
      setError("Failed to connect to server");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (!date || !time) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <FaExclamationCircle className="text-red-500 text-3xl mx-auto mb-4" />
          <p className="text-red-600 text-lg font-medium">Invalid date or time selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-8 px-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6">
          <h3 className="text-2xl md:text-3xl font-bold text-white text-center">
            Book Appointment with Dr. {doctor?.name || "Loading..."}
          </h3>
          <p className="text-blue-200 text-center mt-2 text-sm md:text-base">
            Schedule your visit easily and securely
          </p>
        </div>
        <div className="p-6 md:p-8">
          {success && (
            <div className="flex items-center bg-green-100 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg animate-fade-in">
              <FaCheckCircle className="text-green-500 mr-3 text-xl" />
              <p className="text-green-700 text-sm md:text-base">{success}</p>
            </div>
          )}
          {error && (
            <div className="flex items-center bg-red-100 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg animate-fade-in">
              <FaExclamationCircle className="text-red-500 mr-3 text-xl" />
              <p className="text-red-700 text-sm md:text-base">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-medium text-sm md:text-base mb-2">
                Selected Date
              </label>
              <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm md:text-base">
                {moment(date).format("MMMM Do YYYY")}
              </div>
            </div>
            <div>
              <label className="block text-gray-700 font-medium text-sm md:text-base mb-2">
                Selected Time
              </label>
              <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm md:text-base">
                {time}
              </div>
            </div>
            <div>
              <label htmlFor="reason" className="block text-gray-700 font-medium text-sm md:text-base mb-2">
                Reason for Appointment <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm md:text-base resize-none"
                rows="5"
                required
                placeholder="Describe the reason for your visit..."
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-lg font-medium text-white text-sm md:text-base transition-all duration-300 ${
                isLoading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl"
              }`}
            >
              {isLoading ? "Submitting..." : "Book Appointment"}
            </button>
          </form>
          <button
            onClick={() => navigate("/patient")}
            className="mt-4 w-full py-3 rounded-lg font-medium text-blue-600 border border-blue-600 hover:bg-blue-50 transition-all duration-300 text-sm md:text-base"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

console.log("[BookAppointmentPage] react-icons imported:", { FaCheckCircle, FaExclamationCircle });
