/**
 * PDF Generation Service
 * Creates professional PDF receipts/invoices for bookings
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import dayjs from 'dayjs';

/**
 * Generate booking receipt/invoice PDF
 */
export const generateBookingReceipt = async (booking, user, item) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Booking Receipt - ${booking._id}`,
          Author: 'My Guide',
          Subject: 'Booking Receipt',
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Generate QR code for booking
      const qrCodeUrl = `${process.env.FRONTEND_URL}/bookings/${booking._id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 150,
      });

      // Header with gradient background
      doc.rect(0, 0, doc.page.width, 150).fill('#667eea');

      // Logo/Company name
      doc.fillColor('#FFFFFF')
         .fontSize(32)
         .font('Helvetica-Bold')
         .text('My Guide', 50, 50);

      doc.fontSize(14)
         .font('Helvetica')
         .text('Travel & Adventure Experiences', 50, 90);

      // Receipt title
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#333333')
         .text('BOOKING RECEIPT', 50, 180);

      // Booking ID and status
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#666666')
         .text(`Booking ID: ${booking._id}`, 50, 215);

      doc.fontSize(10)
         .fillColor(booking.status === 'confirmed' ? '#10b981' : '#f59e0b')
         .text(`Status: ${booking.status.toUpperCase()}`, 50, 235);

      // Date issued
      doc.fillColor('#666666')
         .text(`Issued: ${dayjs().format('MMMM D, YYYY')}`, 50, 250);

      // QR Code (top right)
      const qrImage = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
      doc.image(qrImage, doc.page.width - 200, 170, { width: 120, height: 120 });

      // Horizontal line
      doc.moveTo(50, 310)
         .lineTo(doc.page.width - 50, 310)
         .strokeColor('#e0e0e0')
         .lineWidth(1)
         .stroke();

      let yPosition = 340;

      // Customer Information Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#667eea')
         .text('CUSTOMER INFORMATION', 50, yPosition);

      yPosition += 25;

      const customerName = user.name || booking.customer?.name || 'N/A';
      const customerEmail = user.email || booking.customer?.email || 'N/A';
      const customerPhone = user.phone || booking.customer?.phone || 'N/A';

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#333333')
         .text(`Name: ${customerName}`, 50, yPosition);

      yPosition += 18;
      doc.text(`Email: ${customerEmail}`, 50, yPosition);

      yPosition += 18;
      doc.text(`Phone: ${customerPhone}`, 50, yPosition);

      yPosition += 35;

      // Booking Details Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#667eea')
         .text('BOOKING DETAILS', 50, yPosition);

      yPosition += 25;

      const activityName = item.name || item.title || 'Activity';

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#333333')
         .text(activityName, 50, yPosition);

      yPosition += 20;

      // Create a table-like layout for booking info
      const leftColumn = 50;
      const rightColumn = 300;

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#666666')
         .text('Date:', leftColumn, yPosition);

      doc.font('Helvetica')
         .fillColor('#333333')
         .text(dayjs(booking.date).format('dddd, MMMM D, YYYY'), rightColumn, yPosition);

      yPosition += 18;

      doc.font('Helvetica-Bold')
         .fillColor('#666666')
         .text('Time:', leftColumn, yPosition);

      doc.font('Helvetica')
         .fillColor('#333333')
         .text(booking.time || 'To be confirmed', rightColumn, yPosition);

      yPosition += 18;

      doc.font('Helvetica-Bold')
         .fillColor('#666666')
         .text('Participants:', leftColumn, yPosition);

      doc.font('Helvetica')
         .fillColor('#333333')
         .text(`${booking.participants} ${booking.participants === 1 ? 'person' : 'people'}`, rightColumn, yPosition);

      if (item.location?.address) {
        yPosition += 18;
        doc.font('Helvetica-Bold')
           .fillColor('#666666')
           .text('Location:', leftColumn, yPosition);

        doc.font('Helvetica')
           .fillColor('#333333')
           .text(item.location.address, rightColumn, yPosition, { width: 250 });

        yPosition += Math.ceil(item.location.address.length / 40) * 12 + 6;
      }

      if (booking.specialRequests) {
        yPosition += 18;
        doc.font('Helvetica-Bold')
           .fillColor('#666666')
           .text('Special Requests:', leftColumn, yPosition);

        doc.font('Helvetica')
           .fillColor('#333333')
           .text(booking.specialRequests, rightColumn, yPosition, { width: 250 });

        yPosition += Math.ceil(booking.specialRequests.length / 40) * 12 + 6;
      }

      yPosition += 35;

      // Payment Summary Section
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#667eea')
         .text('PAYMENT SUMMARY', 50, yPosition);

      yPosition += 25;

      // Payment details table
      const pricing = booking.pricing || {};
      const tableLeft = 50;
      const tableRight = doc.page.width - 150;

      // Subtotal
      if (pricing.subtotal) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#333333')
           .text('Subtotal', tableLeft, yPosition);

        doc.text(`₹${pricing.subtotal}`, tableRight, yPosition, { align: 'right' });
        yPosition += 18;
      }

      // Tax
      if (pricing.tax) {
        doc.text('Tax (18%)', tableLeft, yPosition);
        doc.text(`₹${pricing.tax}`, tableRight, yPosition, { align: 'right' });
        yPosition += 18;
      }

      // Service Fee
      if (pricing.serviceFee) {
        doc.text('Service Fee (5%)', tableLeft, yPosition);
        doc.text(`₹${pricing.serviceFee}`, tableRight, yPosition, { align: 'right' });
        yPosition += 18;
      }

      // Promo discount
      if (pricing.promoOff && pricing.promoOff > 0) {
        doc.fillColor('#10b981')
           .text('Promo Discount', tableLeft, yPosition);
        doc.text(`-₹${pricing.promoOff}`, tableRight, yPosition, { align: 'right' });
        yPosition += 18;
      }

      // Divider line
      yPosition += 5;
      doc.moveTo(tableLeft, yPosition)
         .lineTo(doc.page.width - 50, yPosition)
         .strokeColor('#e0e0e0')
         .lineWidth(1)
         .stroke();

      yPosition += 15;

      // Total Amount
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#667eea')
         .text('TOTAL AMOUNT', tableLeft, yPosition);

      doc.fontSize(16)
         .text(`₹${booking.totalAmount || pricing.total || 0}`, tableRight, yPosition, { align: 'right' });

      yPosition += 30;

      // Payment Status
      const paymentStatusColor = booking.paymentStatus === 'paid' ? '#10b981' : '#f59e0b';
      const paymentStatusText = booking.paymentStatus.toUpperCase();

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(paymentStatusColor)
         .text(`Payment Status: ${paymentStatusText}`, tableLeft, yPosition);

      // Footer
      const footerY = doc.page.height - 100;
      doc.moveTo(50, footerY)
         .lineTo(doc.page.width - 50, footerY)
         .strokeColor('#e0e0e0')
         .lineWidth(1)
         .stroke();

      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#999999')
         .text('Thank you for choosing My Guide!', 50, footerY + 15, {
           align: 'center',
           width: doc.page.width - 100
         });

      doc.fontSize(8)
         .text('For questions or support, contact us at support@myguide.com', 50, footerY + 35, {
           align: 'center',
           width: doc.page.width - 100
         });

      doc.text(`Generated on ${dayjs().format('MMMM D, YYYY [at] h:mm A')}`, 50, footerY + 50, {
        align: 'center',
        width: doc.page.width - 100
      });

      // Finalize PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

export default {
  generateBookingReceipt,
};
