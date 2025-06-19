const QRCode = require('qrcode');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Certificate = require('./models/Certificate');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const PDFDocument = require('pdfkit');
const fs = require('fs');

// 🔐 Connect to MongoDB (from Replit Secrets or inline for now)

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// 🔁 Redirect root to /verify
app.get('/', (req, res) => {
  res.redirect('/verify');
});

// 🧾 GET form page
app.get('/verify', async (req, res) => {
  const certId = req.query.certId;

  if (certId) {
    const cert = await Certificate.findOne({ certId });

    if (cert && cert.status === 'valid') {
      return res.render('verify', { cert, error: null });
    } else {
      return res.render('verify', { cert: null, error: '❌ Certificate not found or invalid.' });
    }
  }

  res.render('verify', { cert: null, error: null });
});

// 🔍 POST: search for cert in DB
app.post('/verify', async (req, res) => {
  const certId = req.body.certId.trim();
  const cert = await Certificate.findOne({ certId });

  if (cert && cert.status === 'valid') {
    res.render('verify', { cert, error: null });
  } else {
    res.render('verify', { cert: null, error: '❌ Certificate not found or invalid.' });
  }
});

// qrcode generation endpoint 
app.get('/generate-qr/:certId', async (req, res) => {
  const certId = req.params.certId;
  const url = `https://your-app-name.username.repl.co/verify?certId=${certId}`;

  try {
    const qrImage = await QRCode.toDataURL(url);
    res.send(`
      <h2>QR Code for Certificate ID: ${certId}</h2>
      <img src="${qrImage}" />
      <p>Scan this QR to verify certificate instantly.</p>
      <p><a href="${url}" target="_blank">Go to Verification Page</a></p>
    `);
  } catch (err) {
    res.send("Failed to generate QR: " + err);
  }
});

// GET: admin cert creation form
app.get('/admin', (req, res) => {
  res.render('admin', { success: null, error: null });
});

app.post('/admin', async (req, res) => {
  const { firstName, lastName, course, Issueddate, certId } = req.body;

  try {
    const newCert = await Certificate.create({
      firstName,
      lastName,
      course,
      Issueddate,
      certId,
      status: "valid"
    });

    const qrLink = `https://your-app-name.username.repl.co/verify?certId=${certId}`;
    const qrImage = await QRCode.toDataURL(qrLink);

    res.render('admin', {
      success: {
        cert: newCert,
        qrImage,
        qrLink
      },
      error: null
    });
  } catch (err) {
    res.render('admin', {
      success: null,
      error: "❌ Failed to create certificate: " + err.message
    });
  }
});

app.get('/generate-pdf/:certId', async (req, res) => {
  const certId = req.params.certId;
  const cert = await Certificate.findOne({ certId });

  if (!cert) return res.send("❌ Certificate not found");

  const verifyLink = `https://your-app.repl.co/verify?certId=${certId}`;
  const qrDataURL = await QRCode.toDataURL(verifyLink);

  const doc = new PDFDocument({ size: 'A4' });
  const filename = `Certificate_${certId}.pdf`;
  const filepath = `/tmp/${filename}`;
  const stream = fs.createWriteStream(filepath);

  doc.pipe(stream);

  // Style and Content
  doc.fontSize(22).fillColor('crimson').text('Certificate of Completion', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).fillColor('black').text(`This is to certify that`, { align: 'center' });
  doc.fontSize(20).text(`${cert.firstName} ${cert.lastName}`, { align: 'center', underline: true });
  doc.fontSize(14).text(`has successfully completed the course`, { align: 'center' });
  doc.fontSize(18).text(`${cert.course}`, { align: 'center', underline: true });
  doc.fontSize(12).text(`Issued on: ${cert.Issueddate}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Certificate ID: ${cert.certId}`, { align: 'center' });

  // QR code
  doc.image(Buffer.from(qrDataURL.split(",")[1], 'base64'), 250, 500, { width: 100 });

  doc.end();

  stream.on('finish', () => {
    res.download(filepath, filename);
  });
});

// 🚀 Run server
app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
