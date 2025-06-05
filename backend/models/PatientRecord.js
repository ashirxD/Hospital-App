const mongoose = require('mongoose');

const patientRecordSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  height: {
    type: Number,
    required: true,
    min: 0,
    max: 300
  },
  weight: {
    type: Number,
    required: true,
    min: 0,
    max: 500
  },
  allergies: {
    type: String,
    default: ''
  },
  currentMedications: {
    type: String,
    default: ''
  },
  chronicConditions: {
    type: String,
    default: ''
  },
  previousSurgeries: {
    type: String,
    default: ''
  },
  familyHistory: {
    type: String,
    default: ''
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create a compound index to ensure one record per patient
patientRecordSchema.index({ patient: 1 }, { unique: true });

module.exports = mongoose.model('PatientRecord', patientRecordSchema); 