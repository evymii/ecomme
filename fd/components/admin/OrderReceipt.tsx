'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 20;

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
  } | string;
  paymentMethod?: string;
  payment?: {
    method?: string;
    paymentMethod?: string;
  };
  address?: {
    deliveryAddress?: string;
    additionalInfo?: string;
  } | string;
  orderCode?: string;
  status: string;
  createdAt: string;
}

interface OrderReceiptProps {
  order: Order;
}

function chunkOrderItems(items: OrderItem[]): OrderItem[][] {
  const list = items || [];
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE) || 1);
  const chunks: OrderItem[][] = [];
  for (let p = 0; p < pageCount; p++) {
    const start = p * PAGE_SIZE;
    chunks.push(list.slice(start, start + PAGE_SIZE));
  }
  return chunks;
}

const PRINT_EMBEDDED_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  @media print {
    html, body {
      width: 190mm;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
    .receipt-print-root {
      width: 190mm !important;
      max-width: 190mm !important;
      min-height: 277mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    .receipt-a4-page {
      display: block !important;
      width: 190mm !important;
      min-height: 277mm !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .receipt-a4-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .receipt-print-table {
      width: 190mm !important;
      max-width: 190mm !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .receipt-print-table th,
    .receipt-print-table td {
      border: 1px solid #000 !important;
      padding: 4px !important;
      font-size: 10px !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
    }
    .receipt-print-table thead th {
      font-weight: bold !important;
      text-align: center !important;
      background-color: #fff !important;
    }
    .receipt-col-no { width: 8mm !important; }
    .receipt-col-name { width: 72mm !important; }
    .receipt-col-code { width: 16mm !important; }
    .receipt-col-unit { width: 14mm !important; }
    .receipt-col-qty { width: 14mm !important; }
    .receipt-col-price { width: 22mm !important; }
    .receipt-col-total { width: 24mm !important; }
  }
  @media screen {
    .receipt-a4-page {
      width: 210mm;
      max-width: 100%;
      min-height: 297mm;
      box-sizing: border-box;
      margin: 0 auto 16px;
      padding: 8mm;
      background: #fff;
      border: 1px solid #e5e7eb;
    }
  }
  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.3;
  }
  table {
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
`;

export default function OrderReceipt({ order }: OrderReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [receiptPage, setReceiptPage] = useState(1);

  const items = order.items || [];
  const chunks = useMemo(() => chunkOrderItems(items), [items]);
  const totalPages = chunks.length;

  useEffect(() => {
    setReceiptPage(1);
  }, [order._id]);

  useEffect(() => {
    if (receiptPage > totalPages) setReceiptPage(totalPages);
  }, [receiptPage, totalPages]);

  const getOrderDeliveryAddress = () => {
    if (!order.deliveryAddress) return '-';
    if (typeof order.deliveryAddress === 'string') return order.deliveryAddress;
    if (order.deliveryAddress.address) return order.deliveryAddress.address;
    if (typeof order.address === 'string') return order.address;
    if (order.address?.deliveryAddress) return order.address.deliveryAddress;
    return '-';
  };

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
              <meta charset="utf-8" />
              <meta name="viewport" content="width=210, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
              <title>Захиалгын баримт - ${order.orderCode || order._id}</title>
              <style>${PRINT_EMBEDDED_STYLES}</style>
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
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const pages = receiptRef.current.querySelectorAll<HTMLElement>('.receipt-a4-page');
      if (pages.length === 0) return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;

      for (let i = 0; i < pages.length; i++) {
        const el = pages[i];
        const canvas = await (html2canvas as (el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>)(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: el.offsetWidth,
          height: el.offsetHeight,
        });

        const imgData = canvas.toDataURL('image/png');
        let drawW = pageWidth;
        let drawH = (canvas.height * drawW) / canvas.width;
        if (drawH > pageHeight) {
          drawH = pageHeight;
          drawW = (canvas.width * drawH) / canvas.height;
        }
        const offsetX = (pageWidth - drawW) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', offsetX, 0, drawW, drawH);
      }

      pdf.save(`Захиалгын_баримт_${order.orderCode || order._id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      handlePrint();
    }
  };

  const renderHeaderBlock = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '10px' }}>
        <div>НХМаягт БМ-3</div>
        <div style={{ textAlign: 'right', maxWidth: '95mm' }}>
          Сангийн сайдын 2017 оны 12 дугаар сарын 5-ны өдрийн<br />
          347 тоот тушаалын хавсралт
        </div>
      </div>

      <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px', textTransform: 'uppercase' }}>
        ЗАРЛАГЫН БАРИМТ № {order.orderCode || order._id.slice(-8)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '11px', gap: '5mm' }}>
        <div style={{ flex: 1, marginRight: 0, minWidth: 0 }}>
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
        <div style={{ flex: 1, minWidth: 0 }}>
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

      <div style={{ marginBottom: '15px', fontSize: '11px' }}>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <span>{formatDate(order.createdAt)}</span>
        </div>
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '10px', marginBottom: '3px' }}>(тээвэрлэгчийн хаяг, албан тушаал, нэр)</div>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: '2px', minHeight: '18px' }}>
            {getOrderDeliveryAddress()}
          </div>
        </div>
      </div>
    </>
  );

  const renderFooterBlock = () => (
    <div className="footer" style={{ marginTop: '30px', fontSize: '11px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6mm' }}>
        <div style={{ width: '58mm', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', marginBottom: '5px' }}>Тэмдэг</div>
          <div style={{ width: '26mm', height: '26mm', border: '1px solid #000', borderStyle: 'dashed' }}></div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
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
  );

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 no-print items-center">
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="w-4 h-4 mr-2" />
          Хэвлэх
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          PDF татах
        </Button>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-sm ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={receiptPage <= 1}
              onClick={() => setReceiptPage((p) => Math.max(1, p - 1))}
            >
              Өмнөх
            </Button>
            <span className="text-gray-700 whitespace-nowrap">
              {receiptPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={receiptPage >= totalPages}
              onClick={() => setReceiptPage((p) => Math.min(totalPages, p + 1))}
            >
              Дараах
            </Button>
          </div>
        )}
      </div>

      <div
        ref={receiptRef}
        className="receipt-print-root receipt-container bg-white"
        style={{
          fontFamily: 'Arial, sans-serif',
          width: '210mm',
          minHeight: '297mm',
          maxWidth: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {chunks.map((chunk, pageIndex) => {
          const startIdx = pageIndex * PAGE_SIZE;
          const isLastPage = pageIndex === chunks.length - 1;
          const emptyRows = Math.max(0, PAGE_SIZE - chunk.length);
          const visibleOnScreen = receiptPage === pageIndex + 1;

          return (
            <div
              key={pageIndex}
              className="receipt-a4-page"
              style={{
                display: visibleOnScreen ? 'block' : 'none',
              }}
            >
              {renderHeaderBlock()}

              <table
                className="receipt-print-table"
                style={{
                  width: '190mm',
                  maxWidth: '100%',
                  borderCollapse: 'collapse',
                  margin: '20px 0',
                  fontSize: '10px',
                  border: '1px solid #000',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col className="receipt-col-no" />
                  <col className="receipt-col-name" />
                  <col className="receipt-col-code" />
                  <col className="receipt-col-unit" />
                  <col className="receipt-col-qty" />
                  <col className="receipt-col-price" />
                  <col className="receipt-col-total" />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>№</th>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>
                      Материалын үнэт зүйлийн нэр, зэрэг, дугаар
                    </th>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>Код</th>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>
                      Хэм-<br />жих нэгж
                    </th>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>Тоо</th>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>
                      Худалдах<br />Нэгжийн үнэ
                    </th>
                    <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '10px' }}>Нийт дүн</th>
                  </tr>
                </thead>
                <tbody>
                  {chunk.map((item, index) => {
                    const rowNum = startIdx + index + 1;
                    return (
                      <tr key={`${pageIndex}-${index}`}>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>{rowNum}</td>
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
                    );
                  })}
                  {Array.from({ length: emptyRows }).map((_, index) => {
                    const rowNum = startIdx + chunk.length + index + 1;
                    return (
                      <tr key={`empty-${pageIndex}-${index}`}>
                        <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', fontSize: '10px' }}>{rowNum}</td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                        <td style={{ border: '1px solid #000', padding: '5px', fontSize: '10px' }}></td>
                      </tr>
                    );
                  })}
                  {isLastPage && (
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
                  )}
                </tbody>
              </table>

              {isLastPage && renderFooterBlock()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
