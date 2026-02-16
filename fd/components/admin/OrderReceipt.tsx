'use client';

import { useRef } from 'react';
import { Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderItem {
  product: { name: string; price?: number; code?: string };
  quantity: number;
  price: number;
  size?: string;
}

interface Order {
  _id: string;
  user?: {
    name: string;
    phoneNumber: string;
    email?: string;
  };
  phoneNumber?: string;
  email?: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  deliveryAddress: {
    address: string;
    additionalInfo?: string;
  };
  paymentMethod?: string;
  orderCode?: string;
  status: string;
  createdAt: string;
}

interface OrderReceiptProps {
  order: Order;
}

export default function OrderReceipt({ order }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year} оны ${month} сарын ${day} өдөр`;
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Захиалгын баримт - ${order.orderCode || order._id}</title>
              <style>
                @media print {
                  @page {
                    size: A4;
                    margin: 1.5cm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .receipt-container {
                    max-width: 100% !important;
                    padding: 0 !important;
                  }
                }
                body {
                  font-family: Arial, sans-serif;
                  font-size: 11px;
                  line-height: 1.3;
                }
                .receipt-container {
                  max-width: 210mm;
                  margin: 0 auto;
                  padding: 15px;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 15px 0;
                  font-size: 10px;
                }
                th, td {
                  border: 1px solid #000;
                  padding: 4px;
                  text-align: left;
                }
                th {
                  font-weight: bold;
                  text-align: center;
                  background-color: #fff;
                }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current || typeof window === 'undefined') return;

    try {
      // Use Function constructor to create a truly dynamic import
      // This prevents Next.js from analyzing the import at build time
      const dynamicImport = (moduleName: string) => {
        // @ts-ignore - Dynamic import that may not exist
        return new Function('return import("' + moduleName + '")')();
      };

      let html2canvas: any;
      let jsPDF: any;

      try {
        const h2c = await dynamicImport('html2canvas');
        html2canvas = h2c.default;
      } catch (e) {
        console.error('html2canvas not found:', e);
      }

      try {
        const jspdf = await dynamicImport('jspdf');
        jsPDF = jspdf.default;
      } catch (e) {
        console.error('jspdf not found:', e);
      }

      if (!html2canvas || !jsPDF) {
        alert('PDF функц ашиглахын тулд эхлээд дараах командыг ажиллуулна уу:\n\ncd fd\nyarn add html2canvas jspdf\n\nyarn dev');
        // Fallback to print
        handlePrint();
        return;
      }

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Захиалгын_баримт_${order.orderCode || order._id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to print if PDF generation fails
      handlePrint();
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 no-print">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Хэвлэх
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          PDF татах
        </Button>
      </div>

      <div ref={receiptRef} className="receipt-container bg-white p-6" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '210mm', margin: '0 auto' }}>
        {/* Top Header Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '10px' }}>
          <div>НХМаягт БМ-3</div>
          <div style={{ textAlign: 'right', maxWidth: '50%' }}>
            Сангийн сайдын 2017 оны 12 дугаар сарын 5-ны өдрийн<br />
            347 тоот тушаалын хавсралт
          </div>
        </div>

        {/* Main Title */}
        <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase' }}>
          ЗАРЛАГЫН БАРИМТ № {order.orderCode || order._id.slice(-8)}
        </div>

        {/* Organization and Buyer Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '11px' }}>
          <div style={{ flex: 1, marginRight: '20px' }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', marginBottom: '3px' }}>(байгууллагын нэр)</div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '18px' }}>
                Az Souvenir
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', marginBottom: '3px' }}>Регистрийн №</div>
              <div style={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} style={{ width: '15px', height: '18px', border: '1px solid #000', display: 'inline-block' }}></div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', marginBottom: '3px' }}>(худалдан авагчийн нэр)</div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '18px' }}>
                {order.user?.name || order.customerName || 'Зочин'}
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '10px', marginBottom: '3px' }}>Регистрийн №</div>
              <div style={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} style={{ width: '15px', height: '18px', border: '1px solid #000', display: 'inline-block' }}></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Date and Carrier Info */}
        <div style={{ marginBottom: '15px', fontSize: '11px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span>{formatDate(order.createdAt)}</span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '10px', marginBottom: '3px' }}>(тээвэрлэгчийн хаяг, албан тушаал, нэр)</div>
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '18px' }}>
              {order.deliveryAddress?.address || '-'}
            </div>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '20px 0', fontSize: '10px', border: '1px solid #000' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '4%', fontSize: '10px' }}>№</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '38%', fontSize: '10px' }}>
                Материалын үнэт зүйлийн нэр, зэрэг, дугаар
              </th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '8%', fontSize: '10px' }}>Код</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '8%', fontSize: '10px' }}>
                Хэм-<br />жих нэгж
              </th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '8%', fontSize: '10px' }}>Тоо</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '12%', fontSize: '10px' }}>
                Худалдах<br />Нэгжийн үнэ
              </th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '12%', fontSize: '10px' }}>Нийт дүн</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}>{item.product?.name || 'Устгагдсан бараа'}</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>
                  {item.product?.code || '-'}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>ш</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>{item.quantity}</td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontSize: '10px' }}>
                  ₮{(item.price || 0).toLocaleString()}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right', fontSize: '10px' }}>
                  ₮{((item.price || 0) * (item.quantity || 0)).toLocaleString()}
                </td>
              </tr>
            ))}
            {/* Fill remaining rows up to 20 */}
            {Array.from({ length: Math.max(0, 20 - (order.items || []).length) }).map((_, index) => (
              <tr key={`empty-${index}`}>
                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>
                  {(order.items || []).length + index + 1}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
              </tr>
            ))}
            {/* Total Row */}
            <tr>
              <td colSpan={4} style={{ border: '1px solid #000', padding: '6px', fontSize: '10px', fontWeight: 'bold' }}>
                Дүн
              </td>
              <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}></td>
              <td style={{ border: '1px solid #000', padding: '6px', fontSize: '10px' }}></td>
              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontSize: '11px', fontWeight: 'bold' }}>
                ₮{(order.total || 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div className="footer" style={{ marginTop: '30px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Left side - Stamp */}
            <div style={{ width: '30%' }}>
              <div style={{ fontSize: '10px', marginBottom: '5px' }}>Тэмдэг</div>
              <div style={{ width: '100px', height: '100px', border: '1px solid #000', borderStyle: 'dashed' }}></div>
            </div>

            {/* Right side - Signatures */}
            <div style={{ width: '65%' }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '10px', marginBottom: '5px' }}>Хүлээлгэн өгсөн эд хариуцагч</div>
                <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '20px', marginBottom: '10px' }}></div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '10px', marginBottom: '5px' }}>Хүлээн авагч</div>
                <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '20px', marginBottom: '10px' }}></div>
              </div>
              <div>
                <div style={{ fontSize: '10px', marginBottom: '5px' }}>Шалгасан нягтлан бодогч</div>
                <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '20px' }}></div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
