import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, TextField, Button, Grid, Paper, MenuItem, Alert, Snackbar } from '@mui/material';
import { 
  Bloodtype as BloodIcon,
  MonitorHeart as HeartIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as MedicalIcon,
  Save as SaveIcon,
  Height as HeightIcon,
  Scale as ScaleIcon,
  Female as FemaleIcon,
  Male as MaleIcon,
  Transgender as OtherIcon
} from '@mui/icons-material';
import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// Add request interceptor to update token if it changes
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const PatientRecords = () => {
  const [formData, setFormData] = useState({
    gender: '',
    bloodGroup: '',
    height: '',
    weight: '',
    allergies: '',
    currentMedications: '',
    chronicConditions: '',
    previousSurgeries: '',
    familyHistory: ''
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientRecords();
  }, []);

  const fetchPatientRecords = async () => {
    try {
      const response = await api.get('/api/patient/records');
      if (response.data) {
        setFormData({
          gender: response.data.gender || '',
          bloodGroup: response.data.bloodGroup || '',
          height: response.data.height || '',
          weight: response.data.weight || '',
          allergies: response.data.allergies || '',
          currentMedications: response.data.currentMedications || '',
          chronicConditions: response.data.chronicConditions || '',
          previousSurgeries: response.data.previousSurgeries || '',
          familyHistory: response.data.familyHistory || ''
        });
      }
    } catch (error) {
      console.error('Error fetching patient records:', error);
      setSnackbar({
        open: true,
        message: 'Error loading patient records',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/patient/records', formData);
      setSnackbar({
        open: true,
        message: 'Medical records saved successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving patient records:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error saving medical records',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const getGenderIcon = (gender) => {
    switch (gender) {
      case 'male': return <MaleIcon sx={{ mr: 1 }} />;
      case 'female': return <FemaleIcon sx={{ mr: 1 }} />;
      case 'other': return <OtherIcon sx={{ mr: 1 }} />;
      default: return null;
    }
  };

  // Common TextField styles to prevent resizing and ensure consistency
  const textFieldStyles = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: '#ffffff',
      '& fieldset': {
        borderColor: '#e0e0e0',
      },
      '&:hover fieldset': {
        borderColor: '#1a237e',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1a237e',
      },
      // Ensure consistent height
      minHeight: '56px',
      // Prevent width changes
      width: '100%',
      boxSizing: 'border-box',
    },
    '& .MuiInputBase-input': {
      padding: '14px',
      boxSizing: 'border-box',
    },
    '& .MuiInputLabel-root': {
      color: '#666',
      '&.Mui-focused': {
        color: '#1a237e',
      },
    },
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        py: { xs: 2, sm: 4 },
        backgroundColor: '#f5f7fa',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Container 
        maxWidth="md" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Paper 
          elevation={3} 
          sx={{ 
            p: { xs: 2, sm: 3, md: 4 },
            background: 'linear-gradient(to bottom right, #ffffff, #f8f9fa)',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header Section */}
          <Box sx={{ textAlign: 'center', mb: { xs: 3, sm: 4 } }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                fontWeight: 700,
                color: '#1a237e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.25rem' },
                mb: 1,
              }}
            >
              <MedicalIcon sx={{ fontSize: { xs: 28, sm: 32, md: 36 } }} />
              Medical Records
            </Typography>
            <Typography 
              variant="subtitle1" 
              color="text.secondary"
              sx={{ 
                fontSize: { xs: '0.875rem', sm: '1rem' },
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              Please provide your complete medical information for better healthcare
            </Typography>
          </Box>
          
          {/* Form Section */}
          <Box 
            component="form" 
            onSubmit={handleSubmit} 
            sx={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 3, sm: 4 },
            }}
          >
            {/* Medical Information Section */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#1a237e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  fontWeight: 600,
                }}
              >
                <HeartIcon />
                Medical Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    InputProps={{
                      startAdornment: getGenderIcon(formData.gender),
                    }}
                    sx={textFieldStyles}
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Blood Group"
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    required
                    InputProps={{
                      startAdornment: <BloodIcon sx={{ mr: 1, color: '#d32f2f' }} />,
                    }}
                    sx={textFieldStyles}
                  >
                    <MenuItem value="A+">A+</MenuItem>
                    <MenuItem value="A-">A-</MenuItem>
                    <MenuItem value="B+">B+</MenuItem>
                    <MenuItem value="B-">B-</MenuItem>
                    <MenuItem value="AB+">AB+</MenuItem>
                    <MenuItem value="AB-">AB-</MenuItem>
                    <MenuItem value="O+">O+</MenuItem>
                    <MenuItem value="O-">O-</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Height (cm)"
                    name="height"
                    type="number"
                    value={formData.height}
                    onChange={handleChange}
                    required
                    InputProps={{
                      startAdornment: <HeightIcon sx={{ mr: 1, color: '#1976d2' }} />,
                      inputProps: { min: 0, max: 300 },
                    }}
                    sx={{
                      ...textFieldStyles,
                      '& input[type=number]': {
                        '-moz-appearance': 'textfield',
                        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                          '-webkit-appearance': 'none',
                          margin: 0,
                        },
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Weight (kg)"
                    name="weight"
                    type="number"
                    value={formData.weight}
                    onChange={handleChange}
                    required
                    InputProps={{
                      startAdornment: <ScaleIcon sx={{ mr: 1, color: '#1976d2' }} />,
                      inputProps: { min: 0, max: 500 },
                    }}
                    sx={{
                      ...textFieldStyles,
                      '& input[type=number]': {
                        '-moz-appearance': 'textfield',
                        '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                          '-webkit-appearance': 'none',
                          margin: 0,
                        },
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Medical History Section */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: '#1a237e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  fontWeight: 600,
                }}
              >
                <HospitalIcon />
                Medical History
              </Typography>

              <Grid container spacing={2}>
                {[
                  { name: 'allergies', label: 'Allergies', placeholder: 'List any allergies (e.g., penicillin, nuts, etc.)' },
                  { name: 'currentMedications', label: 'Current Medications', placeholder: 'List all current medications and dosages' },
                  { name: 'chronicConditions', label: 'Chronic Conditions', placeholder: 'List any chronic conditions (e.g., diabetes, hypertension)' },
                  { name: 'previousSurgeries', label: 'Previous Surgeries', placeholder: 'List any previous surgeries with dates' },
                ].map((field) => (
                  <Grid item xs={12} sm={6} key={field.name}>
                    <TextField
                      fullWidth
                      label={field.label}
                      name={field.name}
                      multiline
                      rows={3}
                      value={formData[field.name]}
                      onChange={handleChange}
                      placeholder={field.placeholder}
                      sx={textFieldStyles}
                    />
                  </Grid>
                ))}

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Family Medical History"
                    name="familyHistory"
                    multiline
                    rows={3}
                    value={formData.familyHistory}
                    onChange={handleChange}
                    placeholder="List any relevant family medical history"
                    sx={textFieldStyles}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Submit Button */}
            <Box sx={{ mt: { xs: 2, sm: 3 } }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                startIcon={<SaveIcon />}
                sx={{
                  py: 1.5,
                  borderRadius: '12px',
                  background: 'linear-gradient(45deg, #1a237e 30%, #283593 90%)',
                  boxShadow: '0 3px 5px 2px rgba(26, 35, 126, .3)',
                  textTransform: 'none',
                  fontSize: { xs: '0.9rem', sm: '1rem' },
                  '&:hover': {
                    background: 'linear-gradient(45deg, #283593 30%, #1a237e 90%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 8px 2px rgba(26, 35, 126, .4)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {loading ? 'Saving...' : 'Save Medical Records'}
              </Button>
            </Box>
          </Box>
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity}
            sx={{ 
              width: '100%',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              bgcolor: snackbar.severity === 'success' ? '#e6ffed' : '#ffebee',
            }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default PatientRecords;