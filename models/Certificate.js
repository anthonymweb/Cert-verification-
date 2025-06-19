const mongoose = require('mongoose');

const certSchema = new mongoose.Schema({
  certId: String,
  firstName: String,
  lastName: String,
  course: String,
  Issueddate: String,
  status: String
});

module.exports = mongoose.model('Certificate', certSchema);