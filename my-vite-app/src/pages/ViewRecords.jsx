import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Container, Typography, Paper, Grid, CircularProgress, Alert, Button, Divider, Avatar,
  Fade, Zoom
} from '@mui/material';
import { 
  Bloodtype as BloodIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as MedicalIcon,
  Height as HeightIcon,
  Scale as ScaleIcon,
  Female as FemaleIcon,
  Male as MaleIcon,
  Transgender as OtherIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';
import { styled } from '@mui/material/styles';

// Create axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// Custom styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 1.5,
  border: 'none',
  background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
  boxShadow: '0 3px 15px rgba(0,0,0,0.08)',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 5px 20px rgba(0,0,0,0.1)'
  }
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
    transform: 'translateY(-1px)'
  },
  transition: 'all 0.3s ease'
}));

const InfoItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.grey[50],
  marginBottom: theme.spacing(1),
  transition: 'background-color 0.3s ease',
  '&:hover': {
    backgroundColor: theme.palette.grey[100]
  }
}));

const ProfileImage = styled('img')(({ theme }) => ({
  width: 100,
  height: 100,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '3px solid #e3f2fd',
  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  backgroundColor: '#e3f2fd',
  [theme.breakpoints.down('sm')]: {
    width: 80,
    height: 80
  }
}));

const ViewRecords = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientData, setPatientData] = useState(null);
  const [records, setRecords] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Function to validate and format image URL
  const getValidImageUrl = (url) => {
    if (!url) return null;
    try {
      // If it's already a full URL, return it
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      // If it's a relative URL, prepend the API base URL
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${url.startsWith('/') ? url : `/${url}`}`;
    } catch (err) {
      console.error('[ViewRecords] Error formatting image URL:', err);
      return null;
    }
  };

  useEffect(() => {
    console.log("[ViewRecords] Component mounted with patientId:", patientId);
    const fetchPatientData = async () => {
      const urlPatientId = window.location.pathname.split('/patients/')[1]?.split('/records')[0];
      const finalPatientId = patientId || urlPatientId;
      
      if (!finalPatientId) {
        console.error("[ViewRecords] No patientId found in URL params or path");
        setError('Patient ID is missing');
        setLoading(false);
        return;
      }

      try {
        console.log("[ViewRecords] Fetching data for patient:", finalPatientId);
        const patientResponse = await api.get(`/api/doctor/patients/${finalPatientId}`);
        console.log("[ViewRecords] Patient data received:", patientResponse.data);
        
        // Format the profile picture URL
        const formattedData = {
          ...patientResponse.data,
          profilePicture: getValidImageUrl(patientResponse.data.profilePicture)
        };
        console.log("[ViewRecords] Formatted profile picture URL:", formattedData.profilePicture);
        
        setPatientData(formattedData);
        setImageError(false);

        const recordsResponse = await api.get(`/api/doctor/patients/${finalPatientId}/records`);
        console.log("[ViewRecords] Records data received:", recordsResponse.data);
        setRecords(recordsResponse.data);
      } catch (err) {
        console.error('[ViewRecords] Error fetching patient data:', err);
        setError(err.response?.data?.message || 'Failed to fetch patient records');
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [patientId]);

  const handleBack = () => {
    console.log("[ViewRecords] Navigating back to patients list");
    navigate('/doctor-dashboard/patients');
  };

  const handleImageError = (e) => {
    console.log("[ViewRecords] Image load error:", e);
    setImageError(true);
    e.target.onerror = null;
    e.target.src = fallbackImage;
  };

  const getGenderIcon = (gender) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return <MaleIcon sx={{ mr: 0.8, color: '#2196f3', fontSize: '1.2rem' }} />;
      case 'female':
        return <FemaleIcon sx={{ mr: 0.8, color: '#f06292', fontSize: '1.2rem' }} />;
      case 'other':
        return <OtherIcon sx={{ mr: 0.8, color: '#7b1fa2', fontSize: '1.2rem' }} />;
      default:
        return <OtherIcon sx={{ mr: 0.8, color: '#7b1fa2', fontSize: '1.2rem' }} />;
    }
  };

  // Fallback image URL
  const fallbackImage = 'https://via.placeholder.com/80?text=Patient';

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        bgcolor: '#f5f7fa'
      }}>
        <CircularProgress size={40} thickness={4} sx={{ color: '#1a237e' }} />
        <Typography sx={{ mt: 1.5, color: '#1a237e', fontSize: '0.9rem' }}>
          Loading patient records...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4, mb: 3 }}>
        <Alert 
          severity="error" 
          sx={{ 
            borderRadius: 1.5, 
            fontSize: '0.9rem', 
            bgcolor: '#ffebee',
            '& .MuiAlert-icon': { fontSize: '1.2rem' }
          }}
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ py: 4, bgcolor: '#f5f7fa', minHeight: '100vh' }}>
      <Container maxWidth="lg">
        {/* Header Section */}
        <Fade in timeout={500}>
          <Box sx={{ 
            mb: 4, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5 
          }}>
            <StyledButton
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
            >
              Back to Patients
            </StyledButton>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                color: '#1a237e', 
                fontWeight: 700,
                fontSize: { xs: '1.6rem', md: '2.2rem' }
              }}
            >
              Patient Medical Records
            </Typography>
          </Box>
        </Fade>

        {/* Patient Info Card */}
        {patientData && (
          <Zoom in timeout={700}>
            <StyledPaper sx={{ p: { xs: 2, md: 3 }, mb: 4 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 3,
                flexWrap: 'wrap'
              }}>
                <Box sx={{ position: 'relative' }}>
                  {patientData.profilePicture && !imageError ? (
                    <ProfileImage
                      src={patientData.profilePicture}
                      alt={patientData.name || 'Patient'}
                      onError={handleImageError}
                    />
                  ) : (
                    <Avatar
                      sx={{
                        width: 100,
                        height: 100,
                        border: '3px solid #e3f2fd',
                        bgcolor: '#e3f2fd',
                        [theme.breakpoints.down('sm')]: {
                          width: 80,
                          height: 80
                        }
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 60, color: '#1a237e' }} />
                    </Avatar>
                  )}
                </Box>
                <Box>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 700, 
                      color: '#1a237e', 
                      mb: 0.5,
                      fontSize: { xs: '1.4rem', md: '1.8rem' }
                    }}
                  >
                    {patientData.name || 'Unknown Patient'}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary',
                      fontSize: '0.9rem'
                    }}
                  >
                    {patientData.email || 'No email provided'}
                  </Typography>
                </Box>
              </Box>
            </StyledPaper>
          </Zoom>
        )}

        {/* Medical Records Section */}
        {records ? (
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12} md={6}>
              <Zoom in timeout={900}>
                <StyledPaper sx={{ p: 3, height: '100%' }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#1a237e', 
                      mb: 2, 
                      display: 'flex', 
                      alignItems: 'center',
                      fontWeight: 600,
                      fontSize: '1.2rem'
                    }}
                  >
                    <MedicalIcon sx={{ mr: 1, fontSize: 24 }} />
                    Basic Information
                  </Typography>
                  <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
                  <Box>
                    <InfoItem>
                      {getGenderIcon(records.gender)}
                      <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                        Gender: {records.gender ? records.gender.charAt(0).toUpperCase() + records.gender.slice(1) : 'Not specified'}
                      </Typography>
                    </InfoItem>
                    <InfoItem>
                      <BloodIcon sx={{ mr: 0.8, color: '#d32f2f', fontSize: '1.2rem' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                        Blood Group: {records.bloodGroup || 'Not specified'}
                      </Typography>
                    </InfoItem>
                    <InfoItem>
                      <HeightIcon sx={{ mr: 0.8, color: '#2196f3', fontSize: '1.2rem' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                        Height: {records.height ? `${records.height} cm` : 'Not specified'}
                      </Typography>
                    </InfoItem>
                    <InfoItem>
                      <ScaleIcon sx={{ mr: 0.8, color: '#2196f3', fontSize: '1.2rem' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
                        Weight: {records.weight ? `${records.weight} kg` : 'Not specified'}
                      </Typography>
                    </InfoItem>
                  </Box>
                </StyledPaper>
              </Zoom>
            </Grid>

            {/* Medical History */}
            <Grid item xs={12} md={6}>
              <Zoom in timeout={1100}>
                <StyledPaper sx={{ p: 3, height: '100%' }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: '#1a237e', 
                      mb: 2, 
                      display: 'flex', 
                      alignItems: 'center',
                      fontWeight: 600,
                      fontSize: '1.2rem'
                    }}
                  >
                    <HospitalIcon sx={{ mr: 1, fontSize: 24 }} />
                    Medical History
                  </Typography>
                  <Divider sx={{ mb: 2, borderColor: '#e0e0e0' }} />
                  <Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: '#1a237e', fontWeight: 600, mb: 0.5, fontSize: '0.9rem' }}>
                        Allergies
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        {records.allergies || 'No known allergies'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: '#1a237e', fontWeight: 600, mb: 0.5, fontSize: '0.9rem' }}>
                        Current Medications
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        {records.currentMedications || 'No current medications'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: '#1a237e', fontWeight: 600, mb: 0.5, fontSize: '0.9rem' }}>
                        Chronic Conditions
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        {records.chronicConditions || 'No chronic conditions'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ color: '#1a237e', fontWeight: 600, mb: 0.5, fontSize: '0.9rem' }}>
                        Previous Surgeries
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        {records.previousSurgeries || 'No previous surgeries'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: '#1a237e', fontWeight: 600, mb: 0.5, fontSize: '0.9rem' }}>
                        Family Medical History
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        {records.familyHistory || 'No family medical history recorded'}
                      </Typography>
                    </Box>
                  </Box>
                </StyledPaper>
              </Zoom>
            </Grid>

            {/* Last Updated */}
            <Grid item xs={12}>
              <Typography 
                variant="caption" 
                sx={{ 
                  display: 'block', 
                  textAlign: 'right', 
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  mt: 1.5
                }}
              >
                Last Updated: {records.lastUpdated ? new Date(records.lastUpdated).toLocaleString() : 'Not specified'}
              </Typography>
            </Grid>
          </Grid>
        ) : (
          <Alert 
            severity="info" 
            sx={{ 
              borderRadius: 1.5, 
              fontSize: '0.9rem',
              bgcolor: '#e3f2fd',
              '& .MuiAlert-icon': { fontSize: '1.2rem' }
            }}
          >
            No medical records found for this patient.
          </Alert>
        )}
      </Container>
    </Box>
  );
};

export default ViewRecords;